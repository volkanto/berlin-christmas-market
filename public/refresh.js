import {validDataset} from './dataset.js';
const calendar=window.MarketCalendar,button=document.getElementById('refresh-data'),status=document.getElementById('refresh-status'),stamp=document.getElementById('data-updated');
const dataUrl=new URL('./markets.json',import.meta.url),CACHE_KEY='berlin-markets-pages-v1:'+dataUrl.pathname;
let loading=false;
function showStamp(data){
 const date=new Date(data.checkedAt);
 if(data.kind==='snapshot')stamp.textContent='Saved snapshot · '+new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',day:'numeric',month:'short',year:'numeric'}).format(date);
 else stamp.textContent=(data.kind==='partial'?'Partly checked · ':'Checked · ')+new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(date);
 stamp.title='Source check: '+data.checkedAt;
}
function apply(data){calendar.replace(data.markets,data.seasonYear);showStamp(data)}
try{const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(validDataset(cached))apply(cached)}catch{}
async function refresh(){
 if(loading)return;loading=true;button.disabled=true;button.setAttribute('aria-busy','true');status.className='';status.textContent='Loading the latest published market data…';
 try{
  const url=new URL(dataUrl);url.searchParams.set('v',String(Date.now()));
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Data unavailable');
  const data=await response.json();if(!validDataset(data))throw Error('Invalid published dataset');
  apply(data);try{localStorage.setItem(CACHE_KEY,JSON.stringify(data))}catch{}
  if(data.lastAttempt?.status==='failed'){status.className='refresh-warning';status.textContent='The latest Berlin.de update failed. Showing the last published data.'}
  else if(data.kind==='partial'){status.className='refresh-warning';status.textContent=`${data.failed||0} listings could not be refreshed. Saved details are shown where available.`}
  else if(data.kind==='snapshot'){status.className='';status.textContent='Published snapshot loaded. Run the GitHub data update to check Berlin.de.'}
  else{status.className='refresh-success';status.textContent=`Latest published data loaded · ${data.markets.length} markets.`}
 }catch{status.className='refresh-warning';status.textContent='Couldn’t load published data. Showing saved market data.'}
 finally{loading=false;button.disabled=false;button.setAttribute('aria-busy','false')}
}
button.onclick=refresh;
fetch(new URL('./app-config.json',import.meta.url),{cache:'no-store'}).then(r=>r.ok?r.json():null).then(config=>{if(typeof config?.workflowUrl==='string'&&/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/workflows\/pages\.yml$/.test(config.workflowUrl)){const link=document.getElementById('run-data-update');link.href=config.workflowUrl;link.hidden=false}}).catch(()=>{});
refresh();
