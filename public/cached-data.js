import './app.js';
import {validDataset} from './dataset.js';
const calendar=window.MarketCalendar,status=document.getElementById('data-status'),stamp=document.getElementById('data-updated');
const dataUrl=new URL('./markets.json',import.meta.url),CACHE_KEY='berlin-markets-published-v2:'+dataUrl.pathname;
function apply(data){
 calendar.replace(data.markets,data.seasonYear);
 stamp.textContent='Last fetched · '+new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(data.checkedAt));
 stamp.title='Last successful market index fetch: '+data.checkedAt;
 status.textContent=data.lastAttempt?.status==='failed'?'The latest scheduled update was unavailable. Saved published data is shown.':data.kind==='partial'?'Some market details use saved data while updates are pending.':'Updated automatically by GitHub Actions.';
}
apply(MARKET_DATA);
try{const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(validDataset(cached)&&Date.parse(cached.checkedAt)>Date.parse(MARKET_DATA.checkedAt))apply(cached)}catch{}
// One same-origin dataset load. Only GitHub Actions contacts Berlin.de.
try{
 const response=await fetch(dataUrl,{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Published data unavailable');
 const data=await response.json();if(!validDataset(data))throw Error('Invalid published dataset');
 apply(data);try{localStorage.setItem(CACHE_KEY,JSON.stringify(data))}catch{}
}catch{status.textContent='Using saved published data. The last successful fetch time is shown above.'}
