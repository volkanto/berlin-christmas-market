import {fetchPage,parseDetail} from './berlin-source.mjs';
import {fetchFeed,parseFeed,FEED} from './geojson.mjs';
import {normalizeMarket} from '../public/market-parser.js';
import {validDataset} from '../public/dataset.js';
export async function updateMarkets(previous,{fetchPage:read=fetchPage,fetchFeed:readFeed=fetchFeed,now=()=>new Date().toISOString(),intervalMs=1500,maxDetails=30,ttlMs=24*3600000}={}){
 if(!validDataset(previous))throw Error('Invalid previous dataset');
 const overview=parseFeed(await readFeed()),checkedAt=now(),clock=Date.parse(checkedAt);
 const byUrl=new Map(previous.markets.map(m=>[m.url,m])),updated=new Map(),due=[];
 let blocked=false,requests=0,refreshed=0,reused=0,deferred=0;
 for(const entry of overview.markets){
  const old=byUrl.get(entry.url),base=old||{id:'berlin-'+entry.path.match(/\/(\d+)-/)?.[1],district:'',dates:[],hours:null,dateText:'',hoursText:'',fee:'',closed:[],exceptions:{}};
  const record={...base,...entry,coords:entry.coords||base.coords||null,address:entry.address||base.address||''};
  const fetched=Date.parse(old?.fetchedAt),modified=old?.detailsSourceModified??(!old?.refreshFailed?old?.sourceModified:null);
  const changed=!!entry.sourceModified&&modified!==entry.sourceModified;
  const fresh=old&&!old.refreshFailed&&!old.refreshPending&&Number.isFinite(fetched)&&clock>=fetched&&clock-fetched<ttlMs&&!changed;
  updated.set(entry.url,record);
  if(fresh){reused++;continue}
  due.push({entry,old,record,rank:!old?0:changed&&(!old.detailAttemptAt||Date.parse(entry.sourceModified)>Date.parse(old.detailAttemptAt))?1:2,attempt:Date.parse(old?.detailAttemptAt)||0,fetched:Number.isFinite(fetched)?fetched:0});
 }
 // Oldest attempted records rotate to the front, including failures; a blocked
 // first listing must not starve every other market on each scheduled run.
 due.sort((a,b)=>a.rank-b.rank||a.attempt-b.attempt||a.fetched-b.fetched||a.entry.url.localeCompare(b.entry.url));
 for(const {entry,old,record} of due){
  if(blocked||requests>=maxDetails){updated.set(entry.url,{...record,refreshPending:true});deferred++;continue}
  if(requests++&&intervalMs>0)await new Promise(resolve=>setTimeout(resolve,intervalMs));
  try{
   const detail=parseDetail(await read(entry.path),entry.path),raw={...detail,...entry,coords:entry.coords||detail.coords,address:entry.address||detail.address,fetchedAt:checkedAt,detailAttemptAt:checkedAt,detailsSourceModified:entry.sourceModified,refreshPending:false};
   updated.set(entry.url,normalizeMarket(raw,old,overview.seasonYear));refreshed++;
  }catch(error){
   if(error.status===429||error.status===403)blocked=true;
   updated.set(entry.url,{...record,detailAttemptAt:checkedAt,refreshFailed:true,refreshPending:false});
  }
 }
 const markets=overview.markets.map(entry=>updated.get(entry.url)),failed=markets.filter(m=>m.refreshFailed||m.refreshPending).length;
 const result={version:1,source:FEED,seasonYear:overview.seasonYear,checkedAt,kind:failed?'partial':'live',failed,refreshed,reused,deferred,markets};
 if(!validDataset(result))throw Error('Updated data failed validation');
 return result;
}
