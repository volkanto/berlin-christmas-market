import {distanceKm,openNow,sharedState,stateUrl,clusterPoints,freshness} from './calendar-utils.js';
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
function slots(k){return MARKETS.map(m=>{let h=hours(m,k),prev=k===today()?hours(m,add(k,-1)):false;let overnight=prev&&prev[1]>24&&minute()<(prev[1]-24)*60;if(h===false&&!overnight)return null;const effective=overnight?prev:h;return {m,h:effective,overnight,unknown:!effective||effective[1]===null||Boolean(m.uncertainEnd&&(m.endUncertainFrom?k>=m.endUncertainFrom:m.id===1?k>='2027-02-01':true))}}).filter(Boolean)}
let MIN_DATE='2026-10-01',MAX_DATE='2027-02-28';
const initial=sharedState(location.search,today());
let selected=initial.date,openOnly=initial.open,favoritesOnly=initial.favorites,origin=null,locating=false,locationMessage='';
let district=new URLSearchParams(location.search).get('district')||'';
let favorites=new Set();
try{const saved=JSON.parse(localStorage.getItem('berlin-market-favorites-v1')||'[]');if(Array.isArray(saved))favorites=new Set(saved.filter(x=>typeof x==='string'))}catch{}
const dayStrip=$('days');
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const inlineMaps=new Map();
const collapsedDistricts=new Set();
let view=initial.view,overviewMap=null,overviewMarkers=new Map(),overviewLayer=null,mapKey='',fitAll=null,redrawClusters=null,wirePopup=null,focusedMarket=null;
function clamp(k){return k<MIN_DATE?MIN_DATE:k>MAX_DATE?MAX_DATE:k}
function buildDays(){
 let markup='';
 for(let k=MIN_DATE;k<=MAX_DATE;k=add(k,1)){
  const d=asDate(k),n=slots(k).filter(s=>(!favoritesOnly||favorites.has(s.m.url))&&(!district||(s.m.district||'Other locations')===district)).length;
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
 selected=clamp(k);if(selected!==today())openOnly=false;
 syncUrl();
 dayStrip.querySelectorAll('button').forEach(b=>{const active=b.dataset.date===selected;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);b.tabIndex=active?0:-1});
 renderMarkets();if(center)scrollToDate(selected);
}
function syncUrl(){history.replaceState(null,'',stateUrl(location.href,{date:selected,view,favorites:favoritesOnly,open:openOnly,district}))}
function freshMarkup(m){const f=freshness(m);return `<p class="detail-freshness${f.warning?' saved-detail':''}" title="${esc(m.fetchedAt||'No detail check timestamp')}">${esc(f.text)}</p>`}
function distanceMarkup(m){if(!origin||!m.coords)return '';const km=distanceKm(origin,m.coords);return `<p class="distance">${km<1?Math.round(km*1000)+' m':km.toFixed(1)+' km'} away · straight line</p>`}
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
 return `<div class="market-map" id="map-canvas-${m.id}" role="region" aria-label="Map of ${esc(m.name)}"></div><p class="map-error" id="map-error-${m.id}" hidden>Map tiles are unavailable. Open directions below.</p><div class="map-address">${esc(m.address||m.name)}</div><div class="map-links"><a href="https://maps.apple.com/?${apple}" target="_blank" rel="noopener">Apple Maps <span aria-hidden="true">↗</span></a></div>`;
}
function toggleMap(id){
 const button=$('toggle-'+id),panel=$('map-'+id),m=MARKETS.find(m=>String(m.id)===String(id)),open=panel.hidden;
 panel.hidden=!open;button.setAttribute('aria-expanded',open);button.querySelector('.toggle-label').textContent=open?'Hide map':'Map';
 if(open){
  panel.innerHTML=mapMarkup(m);
  if(typeof L==='undefined'){$('map-error-'+id).hidden=false;return}
  const map=L.map('map-canvas-'+id,{scrollWheelZoom:false,attributionControl:true}).setView(m.coords,15);
  inlineMaps.set(id,map);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  let errors=0;tiles.on('tileerror',()=>{if(++errors>3)$('map-error-'+id).hidden=false});tiles.on('tileload',()=>{$('map-error-'+id).hidden=true});
  L.circleMarker(m.coords,{radius:8,color:'#ffffff',weight:3,fillColor:getComputedStyle(document.documentElement).getPropertyValue('--pin').trim(),fillOpacity:1}).addTo(map).bindTooltip(m.name,{direction:'top'});
 }else{inlineMaps.get(id)?.remove();inlineMaps.delete(id);panel.innerHTML=''}
}
const ICONS={external:'<path d="M14 3h7v7M21 3 10 14M10 3H3v18h18v-7"/>',clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',ticket:'<path d="M3 7h18v4a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4Z"/><path d="M15 7v11"/>',map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z"/><path d="M9 3v16M15 5v16"/>',go:'<path d="m3 10 18-7-7 18-3-8Z"/>',bookmark:'<path d="M6 3h12v18l-6-4-6 4Z"/>',share:'<path d="M12 16V3m-4 4 4-4 4 4M5 12v9h14v-9"/>'};
function icon(name){return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||''}</svg>`}
function timeLabel(s){const h=s.h;return !h?'Hours unconfirmed':s.overnight?'Until '+hour(h[1]):h[1]===null?'From '+hour(h[0]):hour(h[0])+'–'+hour(h[1])+(h[1]>24?' +1':'')}
function feeLabel(m){return admission(m,selected).replace(/^Entry /,'').replace(/^Free entry/,'Free')}
function openBadge(s){const state=marketStatus(s);if(state.label==='Open now')return '<span class="open-badge"><i aria-hidden="true"></i>Open</span>';return selected===today()&&!s.unknown&&state.label==='Opens later'?'<span class="opening-hint">Opens '+hour(s.h[0])+'</span>':''}
function saveButton(m){return `<button class="favorite-toggle" data-favorite="${esc(m.id)}" aria-pressed="${favorites.has(m.url)}" aria-label="${favorites.has(m.url)?'Remove':'Save'} ${esc(m.name)} ${favorites.has(m.url)?'from':'to'} favorites" title="${favorites.has(m.url)?'Remove from favorites':'Save market'}">${icon('bookmark')}</button>`}
function marketMarkup(s,grouped=false){
 const tag=grouped?'h4':'h3',m=s.m,fee=feeLabel(m);
 return `<article class="market" id="market-${m.id}"><div class="card-heading"><${tag} class="market-title"><a href="${esc(m.url)}" target="_blank" rel="noopener" title="Details on Berlin.de">${esc(m.name)}${icon('external')}</a></${tag}>${saveButton(m)}</div>${!grouped&&m.district?`<p class="card-district">${esc(m.district)}</p>`:''}<div class="card-meta"><span class="card-hours${s.unknown?' unconfirmed':''}">${icon('clock')}<span>${esc(timeLabel(s))}</span></span>${openBadge(s)}${fee?`<span class="card-fee" aria-label="Admission: ${esc(fee)}">${icon('ticket')}<span>${esc(fee)}</span></span>`:''}</div>${distanceMarkup(m)}<div class="market-actions">${m.coords?`<button class="map-toggle" id="toggle-${m.id}" aria-expanded="false" aria-controls="map-${m.id}" aria-label="Show or hide map for ${esc(m.name)}">${icon('map')}<span class="toggle-label">Map</span></button>`:''}<a class="google-directions" href="${esc(googleMapsUrl(m))}" target="_blank" rel="noopener" aria-label="Navigate to ${esc(m.name)} with Google Maps">${icon('go')}<span>Directions</span></a></div><div class="inline-map" id="map-${m.id}" hidden></div></article>`;
}
function clearMapSelection(){focusedMarket=null;overviewMap?.closePopup();$('map-market-select').value=''}
function setView(next){if(next!=='map')clearMapSelection();view=next;syncUrl();renderMarkets()}
function renderOverview(available){
 if(view!=='map')return;
 const located=available.filter(s=>s.m.coords),select=$('map-market-select');
 select.innerHTML='<option value="">Choose a market</option>'+located.map(s=>`<option value="${esc(s.m.id)}">${esc(s.m.name)}</option>`).join('');
 select.disabled=!located.length;
 const missing=available.length-located.length,note=$('overview-note');
 note.textContent=!available.length?'No markets match this day and filters.':!located.length?'No map locations available for this day.':`${located.length} market${located.length===1?'':'s'} on the map. Tap a pin or group for details.${missing?` ${missing} without coordinates — see List.`:''}`;
 $('overview-canvas').hidden=!located.length;$('show-all').disabled=!located.length;
 if(!located.length){overviewMap?.remove();overviewMap=null;mapKey='';return}
 if(typeof L==='undefined'){note.textContent='Map unavailable. Use the List view for directions.';return}
 const nextKey=selected+':'+located.map(s=>s.m.id).join(',');
 const changed=nextKey!==mapKey;mapKey=nextKey;if(!located.some(s=>String(s.m.id)===String(focusedMarket)))focusedMarket=null;
 if(!overviewMap){
  overviewMap=L.map('overview-canvas',{scrollWheelZoom:false}).setView([52.52,13.405],11);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(overviewMap);
  let errors=0;tiles.on('tileerror',()=>{if(++errors>3)note.textContent='Map tiles unavailable. Pins and Google Maps directions still work.'});
  overviewLayer=L.layerGroup().addTo(overviewMap);
 }
 const map=overviewMap;map.invalidateSize({pan:false});
 if(!map._selectionResetInstalled){map.on('popupclose',()=>{focusedMarket=null;$('map-market-select').value=''});map.on('click',()=>clearMapSelection());map._selectionResetInstalled=true}
 const bounds=L.latLngBounds(located.map(s=>s.m.coords));
 fitAll=()=>map.fitBounds(bounds,{padding:[24,24],maxZoom:14,animate:false});
 function popup(s){
  const m=s.m,status=marketStatus(s),fee=admission(m,selected),h=s.h;
  const time=!h?'Hours TBC':s.overnight?'Until '+hour(h[1]):h[1]===null?'From '+hour(h[0]):hour(h[0])+'–'+hour(h[1])+(h[1]>24?' +1':'');
  return `<div class="overview-popup"><div class="card-heading"><a class="popup-title" href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.name)}${icon('external')}</a>${saveButton(m)}</div><div class="card-meta"><span class="card-hours">${icon('clock')}<span>${esc(timeLabel(s))}</span></span>${openBadge(s)}${feeLabel(m)?`<span class="card-fee">${icon('ticket')}<span>${esc(feeLabel(m))}</span></span>`:''}</div>${distanceMarkup(m)}<p>${esc(m.address||m.district)}</p><a class="google-directions" href="${esc(googleMapsUrl(m))}" target="_blank" rel="noopener">${icon('go')}<span>Directions</span></a></div>`;
 }
 function draw(){
  overviewLayer.clearLayers();overviewMarkers.clear();
  const groups=clusterPoints(located,coords=>map.latLngToLayerPoint(coords));
  for(const group of groups){
   const count=group.items.length,coords=map.layerPointToLatLng([group.x,group.y]);let marker;
   if(count>1){
    marker=L.marker(coords,{icon:L.divIcon({className:'market-cluster',html:`<span>${count}</span>`,iconSize:[36,36]}),title:count+' markets · zoom or tap to explore'});
    marker.bindPopup(`<div class="cluster-popup"><p class="cluster-title">${count} nearby markets</p>${group.items.map(popup).join('')}</div>`,{maxWidth:270,maxHeight:300});
   }else{
    const single=group.items[0];marker=L.marker(coords,{icon:L.divIcon({className:'market-pin'+(marketStatus(single).label==='Open now'?' is-open':''),html:'<span></span>',iconSize:[22,22]}),title:single.m.name}).bindTooltip(single.m.name).bindPopup(popup(single),{maxWidth:270});
   }
   marker.on('click',()=>{if(count===1)focusedMarket=String(group.items[0].m.id)});marker.addTo(overviewLayer);for(const s of group.items)overviewMarkers.set(String(s.m.id),marker);
  }
 }
 if(redrawClusters)map.off('zoomend',redrawClusters);redrawClusters=draw;map.on('zoomend',draw);
 if(wirePopup)map.off('popupopen',wirePopup);wirePopup=()=>{document.querySelectorAll('.leaflet-popup [data-favorite]').forEach(button=>button.onclick=()=>toggleFavorite(button.dataset.favorite))};map.on('popupopen',wirePopup);
 if(changed)fitAll();draw();if(focusedMarket){select.value=focusedMarket;overviewMarkers.get(String(focusedMarket))?.openPopup()}
 select.onchange=()=>{const s=located.find(s=>String(s.m.id)===select.value);if(s){const id=String(s.m.id);map.setView(s.m.coords,17,{animate:false});focusedMarket=id;select.value=id;requestAnimationFrame(()=>overviewMarkers.get(id)?.openPopup())}};
 $('show-all').onclick=()=>{focusedMarket=null;select.value='';map.closePopup();fitAll()};
}
function toggleFavorite(id){
 const m=MARKETS.find(m=>String(m.id)===String(id));if(!m)return;
 if(favorites.has(m.url))favorites.delete(m.url);else favorites.add(m.url);
 try{localStorage.setItem('berlin-market-favorites-v1',JSON.stringify([...favorites]))}catch{}
 $('browse-status').textContent=favorites.has(m.url)?'Saved to favorites.':'Removed from favorites.';
 buildDays();selectDate(selected,false);updateStripHeading();
}
async function locate(){
 if(origin){origin=null;locationMessage='';renderMarkets();return}
 if(locating)return;
 if(!navigator.geolocation){locationMessage='Location is unavailable in this browser.';renderMarkets();return}
 locating=true;locationMessage='Finding your location…';renderMarkets();
 navigator.geolocation.getCurrentPosition(position=>{
  locating=false;origin=[position.coords.latitude,position.coords.longitude];locationMessage='Sorted by distance · location stays in this session.';renderMarkets();
 },error=>{locating=false;locationMessage=error.code===1?'Location access denied. You can still browse every market.':'Could not find your location. Try Near me again.';renderMarkets()},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
}
async function shareDay(){
 const url=stateUrl(location.href,{date:selected,view,favorites:favoritesOnly,open:openOnly,district});
 const data={title:'Berlin Christmas markets',text:'Markets on '+selected,url};
 if(navigator.share){try{await navigator.share(data);return}catch(error){if(error.name==='AbortError')return}}
 try{await navigator.clipboard.writeText(url);$('browse-status').textContent='Day link copied.'}
 catch{$('share-fallback').hidden=false;$('share-link').value=url;$('share-link').focus();$('share-link').select()}
}
function emptyMarkup(){
 const title=openOnly?(favoritesOnly?'No saved markets open now':'No markets open now'):favoritesOnly?(favorites.size?'No saved markets on this day':'No favorites yet'):district?'No markets in '+district+' on this day':'No markets listed for this day';
 const hint=openOnly?'Opening times are based on the published schedule.':favoritesOnly?(favorites.size?'Try another date or browse all markets.':'Tap a market’s bookmark to save it here.'):'Try another date in the calendar.';
 return `<div class="empty-state"><p>${title}</p><span>${hint}</span>${openOnly||favoritesOnly||district?'<button id="empty-reset">'+(selected===today()?"See today’s full list":"Browse all markets")+'</button>':''}</div>`;
}
function resetFilters(){district='';openOnly=false;favoritesOnly=false;origin=null;locationMessage='';buildDays();selectDate(selected,false);updateStripHeading();$('filter-menu').open=false}
function renderMarkets(){
 const openIds=[...inlineMaps.keys()];for(const map of inlineMaps.values())map.remove();inlineMaps.clear();
 const districtSelect=$('district-filter'),districts=[...new Set(MARKETS.map(m=>m.district||'Other locations'))].sort((a,b)=>a.localeCompare(b));
 if(district&&!districts.includes(district))district='';
 districtSelect.innerHTML='<option value="">All districts</option>'+districts.map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join('');districtSelect.value=district;
 const scheduled=slots(selected),available=scheduled.filter(s=>((!favoritesOnly||favorites.has(s.m.url))&&(!district||(s.m.district||'Other locations')===district))&&(!openOnly||openNow(s,selected,today(),minute()))).sort((a,b)=>origin?(a.m.coords?distanceKm(origin,a.m.coords):Infinity)-(b.m.coords?distanceKm(origin,b.m.coords):Infinity)||a.m.name.localeCompare(b.m.name):Number(a.unknown)-Number(b.unknown)||(a.h?.[0]??99)-(b.h?.[0]??99)||a.m.name.localeCompare(b.m.name));
 $('markets').hidden=view!=='list';$('map-overview').hidden=view!=='map';
 $('list-view').setAttribute('aria-pressed',view==='list');$('map-view').setAttribute('aria-pressed',view==='map');
 $('today').hidden=selected===today();
 const active=Number(openOnly)+Number(favoritesOnly)+Number(Boolean(origin))+Number(Boolean(district));$('filter-summary').textContent='Filter & sort'+(active?' · '+active:'');
 $('open-now').setAttribute('aria-pressed',openOnly);$('favorites-only').setAttribute('aria-pressed',favoritesOnly);$('favorites-only').textContent='Saved markets'+(favorites.size?' ('+favorites.size+')':'');
 $('nearby').setAttribute('aria-pressed',Boolean(origin));$('nearby').disabled=locating;$('nearby').textContent=origin?'Distance ↑':'Near me';
 $('browse-status').textContent=locationMessage||(openOnly?'Open now, based on published hours.':favoritesOnly?'Your saved markets · stored on this device.':'');
 $('day-title').textContent=(selected===today()?'Today, ':'')+asDate(selected).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'});
 $('count').textContent=(openOnly||favoritesOnly||district?available.length+' of '+scheduled.length:available.length)+' market'+(scheduled.length===1?'':'s');
 $('active-filters').hidden=!active;$('active-filter-label').textContent=[openOnly?'Open now':'',favoritesOnly?'Favorites':'',origin?'Nearest first':'',district].filter(Boolean).join(' · ');
 const groups=new Map();
 for(const slot of available){
  const district=(slot.m.district||'').trim(),key=district.toLocaleLowerCase('de');
  if(!groups.has(key))groups.set(key,{label:district||'Other locations',unknown:!district,items:[]});
  groups.get(key).items.push(slot);
 }
 const grouped=!origin&&[...groups.values()].some(group=>group.items.length>1);
 const ordered=[...groups.values()].sort((a,b)=>Number(a.unknown)-Number(b.unknown)||a.label.localeCompare(b.label,'de'));
 $('markets').innerHTML=available.length?(grouped?ordered.map((group,i)=>`<details class="district-group" data-district="${esc(group.label)}" ${collapsedDistricts.has(group.label)?'':'open'}><summary class="district-heading"><h3>${esc(group.label)}</h3><span class="district-count">${group.items.length} market${group.items.length===1?'':'s'}</span><svg class="district-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg></summary><div class="district-items">${group.items.map(slot=>marketMarkup(slot,true)).join('')}</div></details>`).join(''):available.map(slot=>marketMarkup(slot)).join('')):emptyMarkup();
 document.querySelectorAll('.district-group').forEach(panel=>panel.addEventListener('toggle',()=>{if(panel.open){collapsedDistricts.delete(panel.dataset.district);for(const [id,map] of inlineMaps)if(panel.contains($('map-'+id)))map.invalidateSize()}else collapsedDistricts.add(panel.dataset.district)}));
 if($('empty-reset'))$('empty-reset').onclick=resetFilters;
 $('markets').querySelectorAll('.map-toggle').forEach(b=>b.onclick=()=>toggleMap(b.id.replace('toggle-','')));
 $('markets').querySelectorAll('[data-favorite]').forEach(b=>b.onclick=()=>toggleFavorite(b.dataset.favorite));
 renderOverview(available);
 if(view==='list')for(const id of openIds)if($('toggle-'+id))toggleMap(id);
}
let pending=false;
function handleScroll(){if(pending)return;pending=true;requestAnimationFrame(()=>{updateStripHeading();pending=false})}
dayStrip.addEventListener('scroll',handleScroll,{passive:true});
$('previous').onclick=()=>dayStrip.scrollBy({left:-dayStrip.clientWidth,behavior:reducedMotion.matches?'instant':'smooth'});
$('next').onclick=()=>dayStrip.scrollBy({left:dayStrip.clientWidth,behavior:reducedMotion.matches?'instant':'smooth'});
$('today').onclick=()=>selectDate(today());
$('list-view').onclick=()=>setView('list');$('map-view').onclick=()=>setView('map');
$('open-now').onclick=()=>{openOnly=!openOnly;selectDate(openOnly?today():selected)};
$('favorites-only').onclick=()=>{favoritesOnly=!favoritesOnly;buildDays();selectDate(selected,false);updateStripHeading()};
$('map-overview').addEventListener('focusout',e=>{if(e.relatedTarget&&!$('map-overview').contains(e.relatedTarget))clearMapSelection()});
 $('clear-filters').onclick=resetFilters;$('clear-active').onclick=resetFilters;
 document.addEventListener('click',e=>{if(!e.target.closest('#map-overview'))clearMapSelection();for(const menu of document.querySelectorAll('.more-menu,.filter-menu'))if(!menu.contains(e.target))menu.open=false});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){clearMapSelection()}if(e.key==='Escape')for(const menu of document.querySelectorAll('.more-menu,.filter-menu'))menu.open=false});
 $('district-filter').onchange=e=>{district=e.target.value;buildDays();selectDate(selected,false);updateStripHeading()};
 $('nearby').onclick=locate;$('share-day').onclick=shareDay;
window.addEventListener('resize',()=>{scrollToDate(selected,false);updateStripHeading()});
$('share-day').innerHTML=icon('share');
buildDays();selectDate(selected,false);scrollToDate(selected,false);updateStripHeading();
let lastToday=today();
setInterval(()=>{if(lastToday!==today()){lastToday=today();if(selected!==lastToday)openOnly=false;buildDays();selectDate(selected,false);updateStripHeading()}else renderMarkets()},60000);

window.MarketCalendar={
 snapshot(){return MARKETS.map(m=>({...m}))},
 replace(records,seasonYear){
  const offset=dayStrip.scrollLeft,sameSeason=MIN_DATE.startsWith(String(seasonYear));
  MARKETS.splice(0,MARKETS.length,...records);
  MIN_DATE=`${seasonYear}-10-01`;MAX_DATE=`${seasonYear+1}-02-28`;
  const allDates=records.flatMap(m=>m.dates||[]).sort();
  if(allDates.length){if(allDates[0]<MIN_DATE)MIN_DATE=allDates[0];if(allDates.at(-1)>MAX_DATE)MAX_DATE=allDates.at(-1)}
  document.querySelector('.city').textContent=`BERLIN · ${seasonYear} / ${String(seasonYear+1).slice(-2)}`;
  buildDays();selectDate(selected,false);
  if(sameSeason)dayStrip.scrollTo({left:offset,behavior:'instant'});else scrollToDate(selected,false);
  updateStripHeading();
 }
};
