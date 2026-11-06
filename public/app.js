const $=id=>document.getElementById(id);
const TZ='Europe/Berlin';
function today(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(t=>p.find(x=>x.type===t).value).join('-')}
function minute(){const p=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());return +p.find(x=>x.type==='hour').value*60 + +p.find(x=>x.type==='minute').value}
const asDate=k=>new Date(k+'T12:00:00Z');
const key=d=>d.toISOString().slice(0,10);
function add(k,n){let d=asDate(k);d.setUTCDate(d.getUTCDate()+n);return key(d)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function hour(v){return String(Math.floor(v)%24).padStart(2,'0')+':'+String(Math.round(v*60)%60).padStart(2,'0')}
function hours(m,k){if(!m.dates.includes(k)||m.closed.includes(k))return false;if(m.exceptions[k])return m.exceptions[k];if(!m.hours)return null;return m.hours[asDate(k).getUTCDay()]||false}
function slots(k){return MARKETS.map(m=>{let h=hours(m,k),prev=k===today()?hours(m,add(k,-1)):false;let overnight=prev&&prev[1]>24&&minute()<(prev[1]-24)*60;if(h===false&&!overnight)return null;return {m,h:overnight?prev:h,overnight,unknown:!h||h[1]===null||Boolean(m.uncertainEnd&&(m.endUncertainFrom?k>=m.endUncertainFrom:m.id===1?k>='2027-02-01':true))}}).filter(Boolean)}
let MIN_DATE='2026-10-01',MAX_DATE='2027-02-28';
let selected=today();
const dayStrip=$('days');
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const inlineMaps=new Map();
function clamp(k){return k<MIN_DATE?MIN_DATE:k>MAX_DATE?MAX_DATE:k}
function buildDays(){
 let markup='';
 for(let k=MIN_DATE;k<=MAX_DATE;k=add(k,1)){
  const d=asDate(k),n=slots(k).length;
  markup+=`<button class="date${k===today()?' today':''}${n?'':' no-markets'}" data-date="${k}" aria-label="${d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'})}, ${n} market${n===1?'':'s'}" aria-pressed="false" ${k===today()?'aria-current="date"':''} tabindex="-1"><span class="weekday">${d.toLocaleDateString('en-GB',{weekday:'short',timeZone:'UTC'})}</span><span class="number">${d.getUTCDate()}</span><span class="dot" aria-hidden="true"></span></button>`;
 }
 dayStrip.innerHTML=markup;
 dayStrip.querySelectorAll('button').forEach(b=>{
  b.onclick=()=>selectDate(b.dataset.date);
  b.onkeydown=e=>{
   if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
   e.preventDefault();
   const k=clamp(add(b.dataset.date,e.key==='ArrowLeft'?-1:1));
   selectDate(k);dayStrip.querySelector(`[data-date="${k}"]`).focus({preventScroll:true});
  };
 });
}
function scrollToDate(k,smooth=true){
 const button=dayStrip.querySelector(`[data-date="${k}"]`);
 if(!button)return;
 dayStrip.scrollTo({left:button.offsetLeft+button.offsetWidth/2-dayStrip.clientWidth/2,behavior:smooth&&!reducedMotion.matches?'smooth':'instant'});
}
function updateStripHeading(){
 const center=dayStrip.scrollLeft+dayStrip.clientWidth/2;
 const nearest=[...dayStrip.querySelectorAll('button')].reduce((best,b)=>Math.abs(b.offsetLeft+b.offsetWidth/2-center)<Math.abs(best.offsetLeft+best.offsetWidth/2-center)?b:best);
 $('month').textContent=asDate(nearest.dataset.date).toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
 $('previous').disabled=dayStrip.scrollLeft<=2;
 $('next').disabled=dayStrip.scrollLeft>=dayStrip.scrollWidth-dayStrip.clientWidth-2;
}
function selectDate(k,center=true){
 selected=clamp(k);
 dayStrip.querySelectorAll('button').forEach(b=>{const active=b.dataset.date===selected;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);b.tabIndex=active?0:-1});
 renderMarkets();if(center)scrollToDate(selected);
}
function marketStatus(s){
 let label='Scheduled',cls='',h=s.h;
 if(s.unknown){label='Check hours';cls='unknown'}
 else if(selected===today()){
  if(s.overnight||minute()>=h[0]*60&&minute()<h[1]*60)label='Open now';
  else{label=minute()<h[0]*60?'Opens later':'Closed for today';cls='closed'}
 }
 return {label,cls};
}
function admission(m,date){
 const raw=m.fee;
 if(typeof raw==='number')return Number.isFinite(raw)&&raw>=0?(raw===0?'Free entry':'Entry €'+raw):'';
 const fee=String(raw??'').trim();
 if(!fee||/^(?:not yet known|unknown|unconfirmed|tbc|tbd|n\/a|none|null|undefined|[-–—])$/i.test(fee))return '';
 const day=asDate(date).getUTCDay();
 if(m.id===3&&fee==='Wednesday and Thursday: €2; Friday to Sunday: €3')return 'Entry '+([3,4].includes(day)?'€2':'€3');
 if(m.id===6&&fee==='Tuesday to Friday: 3 euros, concessions 1.50 euros; Saturday and Sunday: 4 euros, concessions 2 euros; free on Mondays; free for children under five'){
  if(day===1)return 'Free entry';
  return 'Entry '+([0,6].includes(day)?'€4 · reduced €2':'€3 · reduced €1.50')+' · under 5 free';
 }
 if(/^free\b/i.test(fee))return /donation/i.test(fee)?'Free entry · donations welcome':'Free entry';
 if(/donation basis/i.test(fee))return 'Donation based';
 if(m.id===10&&fee==='Between €30 and €67, depending on the time of day and the day of the week')return 'Entry €30–€67 · varies by day and time';
 const normalized=fee.replace(/€\s+/g,'€').replace(/(\d+(?:[.,]\d+)?)\s*euros?\b/gi,'€$1');
 return 'Entry '+normalized;
}
function googleMapsUrl(m){
 return 'https://www.google.com/maps/dir/?'+new URLSearchParams({api:'1',destination:m.coords?m.coords.join(','):(m.address||m.name)+', Berlin',travelmode:'transit'});
}
function mapMarkup(m){
 const [lat,lon]=m.coords;
 const apple=new URLSearchParams({daddr:lat+','+lon,dirflg:'r'});
 return `<div class="market-map" id="map-canvas-${m.id}" role="region" aria-label="Map of ${esc(m.name)}"></div><p class="map-error" id="map-error-${m.id}" hidden>Map tiles are unavailable. Open directions below.</p><div class="map-address">${esc(m.address)}, Berlin</div><div class="map-links"><a href="https://maps.apple.com/?${apple}" target="_blank" rel="noopener">Apple Maps <span aria-hidden="true">↗</span></a></div>`;
}
function toggleMap(id){
 const button=$('toggle-'+id),panel=$('map-'+id),m=MARKETS.find(m=>String(m.id)===String(id)),open=panel.hidden;
 panel.hidden=!open;button.setAttribute('aria-expanded',open);button.querySelector('.toggle-label').textContent=open?'Hide map':'Show on map';
 if(open){
  panel.innerHTML=mapMarkup(m);
  if(typeof L==='undefined'){$('map-error-'+id).hidden=false;return}
  const map=L.map('map-canvas-'+id,{scrollWheelZoom:false,attributionControl:true}).setView(m.coords,15);
  inlineMaps.set(id,map);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  let errors=0;tiles.on('tileerror',()=>{if(++errors>3)$('map-error-'+id).hidden=false});tiles.on('tileload',()=>{$('map-error-'+id).hidden=true});
  L.circleMarker(m.coords,{radius:8,color:'#ffffff',weight:3,fillColor:'#db9558',fillOpacity:1}).addTo(map).bindTooltip(m.name,{direction:'top'});
 }else{inlineMaps.get(id)?.remove();inlineMaps.delete(id);panel.innerHTML=''}
}
function marketMarkup(s,grouped=false){
  const titleTag=grouped?'h4':'h3';
  const {label,cls}=marketStatus(s),h=s.h,fee=admission(s.m,selected);
  const time=!h?'Hours TBC':s.overnight?'Until '+hour(h[1]):h[1]===null?'From '+hour(h[0]):hour(h[0])+'–'+hour(h[1])+(h[1]>24?' +1':'');
  return `<article class="market"><div class="market-row"><div class="market-info"><${titleTag} class="market-title"><a href="${s.m.url}" target="_blank" rel="noopener" title="View market details on Berlin.de">${esc(s.m.name)}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8"/></svg></a></${titleTag}>${!grouped&&s.m.district?`<p>${esc(s.m.district)}</p>`:''}</div><div class="market-time"><span class="hours">${time}</span><span class="status ${cls}" data-status="${s.m.id}">${label}</span></div></div>${fee?`<p class="admission">${esc(fee)}</p>`:''}${s.m.refreshFailed?'<p class="saved-detail">Saved details · refresh unavailable</p>':''}<div class="market-actions">${s.m.coords?`<button class="map-toggle" id="toggle-${s.m.id}" aria-expanded="false" aria-controls="map-${s.m.id}" aria-label="Show or hide map for ${esc(s.m.name)}"><svg class="pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg><span class="toggle-label">Show on map</span><svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg></button>`:''}<a class="google-directions" href="${esc(googleMapsUrl(s.m))}" target="_blank" rel="noopener" aria-label="Navigate to ${esc(s.m.name)} with Google Maps">Google Maps <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8"/></svg></a></div><div class="inline-map" id="map-${s.m.id}" hidden></div></article>`;

}
function renderMarkets(){
 for(const map of inlineMaps.values())map.remove();inlineMaps.clear();
 const available=slots(selected).sort((a,b)=>Number(a.unknown)-Number(b.unknown)||(a.h?.[0]??99)-(b.h?.[0]??99)||a.m.name.localeCompare(b.m.name));
 $('day-title').textContent=(selected===today()?'Today, ':'')+asDate(selected).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'});
 $('count').textContent=available.length+' market'+(available.length===1?'':'s');
 const groups=new Map();
 for(const slot of available){
  const district=(slot.m.district||'').trim(),key=district.toLocaleLowerCase('de');
  if(!groups.has(key))groups.set(key,{label:district||'Other locations',unknown:!district,items:[]});
  groups.get(key).items.push(slot);
 }
 const grouped=[...groups.values()].some(group=>group.items.length>1);
 const ordered=[...groups.values()].sort((a,b)=>Number(a.unknown)-Number(b.unknown)||a.label.localeCompare(b.label,'de'));
 $('markets').innerHTML=available.length?(grouped?ordered.map((group,i)=>`<section class="district-group" aria-labelledby="district-${i}"><div class="district-heading"><h3 id="district-${i}">${esc(group.label)}</h3><span>${group.items.length} market${group.items.length===1?'':'s'}</span></div>${group.items.map(slot=>marketMarkup(slot,true)).join('')}</section>`).join(''):available.map(slot=>marketMarkup(slot)).join('')):'<p class="empty">No markets listed for this day.</p>';
 $('markets').querySelectorAll('.map-toggle').forEach(b=>b.onclick=()=>toggleMap(b.id.replace('toggle-','')));
}
let pending=false;
function handleScroll(){if(pending)return;pending=true;requestAnimationFrame(()=>{updateStripHeading();pending=false})}
dayStrip.addEventListener('scroll',handleScroll,{passive:true});
$('previous').onclick=()=>dayStrip.scrollBy({left:-dayStrip.clientWidth,behavior:reducedMotion.matches?'instant':'smooth'});
$('next').onclick=()=>dayStrip.scrollBy({left:dayStrip.clientWidth,behavior:reducedMotion.matches?'instant':'smooth'});
$('today').onclick=()=>selectDate(today());
window.addEventListener('resize',()=>{scrollToDate(selected,false);updateStripHeading()});
buildDays();selectDate(selected,false);scrollToDate(selected,false);updateStripHeading();
setInterval(()=>{for(const s of slots(selected)){const el=document.querySelector(`[data-status="${s.m.id}"]`);if(el){const state=marketStatus(s);el.textContent=state.label;el.className='status '+state.cls}}},60000);

window.MarketCalendar={
 snapshot(){return MARKETS.map(m=>({...m}))},
 replace(records,seasonYear){
  const offset=dayStrip.scrollLeft,openIds=[...inlineMaps.keys()],sameSeason=MIN_DATE.startsWith(String(seasonYear));
  MARKETS.splice(0,MARKETS.length,...records);
  MIN_DATE=`${seasonYear}-10-01`;MAX_DATE=`${seasonYear+1}-02-28`;
  const allDates=records.flatMap(m=>m.dates||[]).sort();
  if(allDates.length){if(allDates[0]<MIN_DATE)MIN_DATE=allDates[0];if(allDates.at(-1)>MAX_DATE)MAX_DATE=allDates.at(-1)}
  document.querySelector('.city').textContent=`BERLIN · ${seasonYear} / ${String(seasonYear+1).slice(-2)}`;
  buildDays();selectDate(selected,false);
  if(sameSeason)dayStrip.scrollTo({left:offset,behavior:'instant'});else scrollToDate(selected,false);
  updateStripHeading();
  for(const id of openIds)if($('toggle-'+id))toggleMap(id);
 }
};
