import {fetchPage,parseIndex,parseDetail} from './berlin-source.mjs';
import {normalizeMarket} from '../public/market-parser.js';
import {validDataset} from '../public/dataset.js';
export async function updateMarkets(previous,{fetchPage:read=fetchPage,now=()=>new Date().toISOString(),concurrency=4}={}){
 if(!validDataset(previous))throw Error('Invalid previous dataset');
 const overview=parseIndex(await read('/'));
 if(overview.markets.length>500)throw Error('Unexpected number of market listings');
 const queue=[...overview.markets],byUrl=new Map(previous.markets.map(m=>[m.url,m])),updated=new Map(),failures=[];
 async function consume(){while(queue.length){const entry=queue.shift(),old=byUrl.get(entry.url);try{const raw=parseDetail(await read(entry.path),entry.path);updated.set(entry.url,normalizeMarket(raw,old,overview.seasonYear))}catch{failures.push(entry.url);updated.set(entry.url,old?{...old,refreshFailed:true}:{id:'berlin-'+entry.path.match(/\/(\d+)-/)?.[1],name:entry.name,url:entry.url,district:'',dates:[],hours:null,dateText:'',hoursText:'',fee:'',closed:[],exceptions:{},coords:null,address:'',refreshFailed:true})}}}
 await Promise.all(Array.from({length:Math.max(1,Math.min(4,concurrency))},consume));
 if(failures.length===overview.markets.length)throw Error('None of the current market listings could be refreshed');
 const result={version:1,seasonYear:overview.seasonYear,checkedAt:now(),kind:failures.length?'partial':'live',failed:failures.length,markets:overview.markets.map(m=>updated.get(m.url))};
 if(!validDataset(result))throw Error('Updated data failed validation');
 return result;
}
