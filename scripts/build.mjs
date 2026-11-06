import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadDataset} from '../lib/dataset.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist');
const data=await loadDataset(root);
try{const report=JSON.parse(await fs.readFile(path.join(root,'.cache/refresh-report.json'),'utf8'));if(report&&['failed','partial','live'].includes(report.status))data.lastAttempt=report}catch{}
await fs.rm(dist,{recursive:true,force:true});await fs.cp(path.join(root,'public'),dist,{recursive:true});
await fs.writeFile(path.join(dist,'markets.json'),JSON.stringify(data)+'\n');
await fs.writeFile(path.join(dist,'data.js'),'const MARKETS = '+JSON.stringify(data.markets)+';\n');
const repo=process.env.GITHUB_REPOSITORY||'';const validRepo=/^[\w.-]+\/[\w.-]+$/.test(repo)&&!repo.split('/').some(s=>s==='.'||s==='..');
await fs.writeFile(path.join(dist,'app-config.json'),JSON.stringify({repositoryUrl:validRepo?'https://github.com/'+repo:null,workflowUrl:validRepo?'https://github.com/'+repo+'/actions/workflows/pages.yml':null})+'\n');
let html=await fs.readFile(path.join(dist,'index.html'),'utf8');html=html.replace(/BERLIN · \d{4} \/ \d{2}/,`BERLIN · ${data.seasonYear} / ${String(data.seasonYear+1).slice(-2)}`).replace('href="/favicon.svg"','href="./favicon.svg"');await fs.writeFile(path.join(dist,'index.html'),html);
let app=await fs.readFile(path.join(dist,'app.js'),'utf8');app=app.replace(/let MIN_DATE='\d{4}-10-01',MAX_DATE='\d{4}-02-28';/,`let MIN_DATE='${data.seasonYear}-10-01',MAX_DATE='${data.seasonYear+1}-02-28';`);await fs.writeFile(path.join(dist,'app.js'),app);
await fs.writeFile(path.join(dist,'.nojekyll'),'');console.log(`Built dist/ with ${data.markets.length} markets (${data.kind}, checked ${data.checkedAt}).`);
