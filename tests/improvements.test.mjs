import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {distanceKm,openNow,sharedState,stateUrl,clusterPoints,freshness} from '../public/calendar-utils.js';
import {updateMarkets} from '../lib/update-markets.mjs';
const seed=JSON.parse(fs.readFileSync(new URL('./fixtures/baseline-2026.json',import.meta.url),'utf8'));
const sample=seed.markets.slice(0,3),now='2026-11-09T12:00:00.000Z';
const feed=records=>({type:'FeatureCollection',properties:{title:'Christmas Markets 2026'},features:records.map(m=>({type:'Feature',geometry:{type:'Point',coordinates:[13.4,52.5]},properties:{title:m.name,url:m.url,modified:'2026-11-09T08:00:00Z'}}))});
const detail='<h1 class="article__title">Market</h1><dl><dt>Dates</dt><dd>November 6 to December 20, 2026</dd><dt>Opening Hours</dt><dd>2 pm to 10 pm</dd><dt>Admission Fee</dt><dd>Free</dd></dl>';
test('open now excludes unknown hours and other dates, includes an overnight slot',()=>{
 const slot={h:[14,22],unknown:false};assert(openNow(slot,'2026-11-09','2026-11-09',15*60));assert(!openNow(slot,'2026-11-09','2026-11-09',22*60));assert(!openNow({...slot,unknown:true},'2026-11-09','2026-11-09',900));assert(!openNow(slot,'2026-11-10','2026-11-09',900));assert(openNow({h:[16,26],unknown:false,overnight:true},'2026-11-09','2026-11-09',60));
});
test('shared URLs restore day, map and filters without carrying location',()=>{
 const url=stateUrl('https://example.com/calendar/?theme=dark',{date:'2026-11-29',view:'map',favorites:true,open:false});
 assert.deepEqual(sharedState(new URL(url).search,'2026-11-09'),{date:'2026-11-29',view:'map',favorites:true,open:false});assert(url.includes('theme=dark'));assert(!url.includes('latitude'));
 assert.equal(sharedState('?date=2026-02-31&view=invalid','2026-11-09').date,'2026-11-09');assert(!sharedState('?date=2026-11-08&open=1','2026-11-09').open);
});
test('distance sorting has zero identity and sensible Berlin distances',()=>{assert.equal(distanceKm([52.5,13.4],[52.5,13.4]),0);const km=distanceKm([52.5,13.4],[52.6,13.4]);assert(km>11&&km<11.2)});
test('overlapping map locations cluster; separated pins remain separate',()=>{
 const items=[[0,0],[10,10],[200,200]].map((coords,id)=>({m:{id,coords}}));const groups=clusterPoints(items,([x,y])=>({x,y}));assert.deepEqual(groups.map(g=>g.items.length),[2,1]);assert.equal(clusterPoints(items,([x,y])=>({x:x*10,y:y*10})).length,3);
});
test('freshness uses actual per-market checks and identifies saved or missing details',()=>{
 assert(!freshness({fetchedAt:now},Date.parse(now)).warning);assert(freshness({fetchedAt:'2026-11-06T12:00:00Z'},Date.parse(now)).warning);assert(freshness({fetchedAt:now,refreshFailed:true},Date.parse(now)).text.includes('unavailable'));assert.equal(freshness({}).text,'Hours & entry check date unavailable');
});
test('recent unchanged details are reused without a detail request',async()=>{
 const prior={...seed,markets:[{...sample[0],fetchedAt:'2026-11-09T10:00:00Z',detailsSourceModified:'2026-11-09T08:00:00Z'}]};
 const out=await updateMarkets(prior,{intervalMs:0,now:()=>now,fetchFeed:async()=>feed(prior.markets),fetchPage:async()=>{throw Error('Should not be requested')}});
 assert.equal(out.reused,1);assert.equal(out.refreshed,0);assert.equal(out.kind,'live');assert.equal(out.markets[0].fetchedAt,prior.markets[0].fetchedAt);
});
test('changed details are fetched before old unchanged details and respect the budget',async()=>{
 const prior={...seed,markets:sample.map((m,i)=>({...m,fetchedAt:'2026-11-05T10:00:00Z',detailsSourceModified:i===1?'2026-11-08T08:00:00Z':'2026-11-09T08:00:00Z'}))};const calls=[];
 const out=await updateMarkets(prior,{intervalMs:0,maxDetails:1,now:()=>now,fetchFeed:async()=>feed(prior.markets),fetchPage:async path=>{calls.push(path);return detail}});
 assert.equal(calls[0],new URL(sample[1].url).pathname);assert.equal(calls.length,1);assert.equal(out.deferred,2);assert.equal(out.refreshed,1);assert.equal(out.markets[1].fetchedAt,now);assert(!out.markets[1].refreshPending);
});
test('failed detail attempts rotate behind older unattempted listings on the next run',async()=>{
 const prior={...seed,markets:sample.slice(0,2).map((m,i)=>({...m,refreshFailed:true,detailAttemptAt:i===0?now:'2026-11-08T08:00:00Z'}))};const calls=[];
 await updateMarkets(prior,{intervalMs:0,maxDetails:1,now:()=>now,fetchFeed:async()=>feed(prior.markets),fetchPage:async path=>{calls.push(path);return detail}});
 assert.equal(calls[0],new URL(sample[1].url).pathname);
});
