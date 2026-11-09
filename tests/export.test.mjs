import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';
import {updateMarkets} from '../lib/update-markets.mjs';import {validDataset} from '../public/dataset.js';import {loadDataset} from '../lib/dataset.mjs';
const root=path.resolve(import.meta.dirname,'..');const seed=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/baseline-2026.json'),'utf8'));
const sourcePath=new URL(seed.markets.find(m=>m.id===3).url).pathname;
const feed=(paths=[sourcePath])=>({type:'FeatureCollection',properties:{title:'Christmas Markets 2026'},features:paths.map(p=>({type:'Feature',geometry:{type:'Point',coordinates:[13.4269,52.5115]},properties:{title:'Market',url:'https://www.berlin.de'+p,address:'Feed address'}}))});
const detail='<h1 class="article__title">Heissa Holzmarkt</h1><dl><dt>Dates</dt><dd>November 7 to December 21, 2026</dd><dt>Opening Hours</dt><dd>Wednesday to Friday from 5 pm to 11 pm</dd><dt>Admission Fee</dt><dd>&euro;4</dd></dl><a href="?ADR_LOCATION=52.5115%2C13.4269">Map</a>';
test('a CI update changes published source fields and marks the actual check time',async()=>{const out=await updateMarkets(seed,{intervalMs:0,fetchFeed:async()=>feed(),fetchPage:async()=>detail,now:()=> '2026-11-07T05:17:00.000Z'});assert(validDataset(out));assert.equal(out.kind,'live');assert.equal(out.checkedAt,'2026-11-07T05:17:00.000Z');assert.equal(out.markets[0].fee,'€4');assert.deepEqual(out.markets[0].hours[5],[17,23]);assert.equal(out.markets[0].dates[0],'2026-11-07');assert.equal(seed.markets.find(m=>m.id===3).fee,'Wednesday and Thursday: €2; Friday to Sunday: €3')});
test('a source failure rejects the update without mutating saved data',async()=>{const before=JSON.stringify(seed);await assert.rejects(updateMarkets(seed,{intervalMs:0,fetchFeed:async()=>{throw Error('403 Forbidden')}}),/403/);assert.equal(JSON.stringify(seed),before)});
test('partial failures keep the failed market’s saved details',async()=>{const old=seed.markets.find(m=>m.id===2),p=new URL(old.url).pathname;const out=await updateMarkets(seed,{intervalMs:0,fetchFeed:async()=>feed([sourcePath,p]),fetchPage:async route=>route===sourcePath?detail:Promise.reject(Error('Unavailable'))});assert.equal(out.kind,'partial');assert.equal(out.failed,1);const retained=out.markets.find(m=>m.id===2);assert.equal(retained.fee,old.fee);assert(retained.refreshFailed)});
test('invalid cache files fall back to the bundled dataset',async()=>{const temp=await fs.mkdtemp(path.join(os.tmpdir(),'market-cache-'));try{await fs.mkdir(path.join(temp,'data'));await fs.mkdir(path.join(temp,'.cache'));await fs.writeFile(path.join(temp,'data/markets.json'),JSON.stringify(seed));await fs.writeFile(path.join(temp,'.cache/markets.json'),'{}');assert.equal((await loadDataset(temp)).markets.length,76)}finally{await fs.rm(temp,{recursive:true,force:true})}});
test('static export loads only published data and exposes no refresh or workflow controls',async()=>{
 execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root});
 const html=await fs.readFile(path.join(root,'dist/index.html'),'utf8'),loader=await fs.readFile(path.join(root,'dist/cached-data.js'),'utf8');
 assert(html.includes('href="./favicon.svg"'));assert(!/(?:src|href)="\/(?!\/)/.test(html));assert(!html.includes('refresh-data'));assert(!html.includes('run-data-update'));assert(!loader.includes('/api/markets'));assert(!loader.includes('https://www.berlin.de'));assert(loader.includes("new URL('./markets.json',import.meta.url)"));
 assert(validDataset(JSON.parse(await fs.readFile(path.join(root,'dist/markets.json'),'utf8'))));assert((await fs.stat(path.join(root,'dist/.nojekyll'))).isFile());
});

test('a rate limit stops remaining detail requests while keeping fresh feed locations',async()=>{
 let calls=0;const old=seed.markets.find(m=>m.id===2),p=new URL(old.url).pathname;
 const out=await updateMarkets(seed,{intervalMs:0,fetchFeed:async()=>feed([sourcePath,p]),fetchPage:async()=>{calls++;throw Object.assign(Error('Rate limited'),{status:429})}});
 assert.equal(calls,1);assert.equal(out.failed,2);assert.equal(out.kind,'partial');assert.deepEqual(out.markets[0].coords,[52.5115,13.4269]);assert.equal(out.markets[1].address,'Feed address');assert.equal(out.markets[1].fee,old.fee);
});
