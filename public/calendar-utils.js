export function distanceKm(a,b){
 const rad=x=>x*Math.PI/180,dlat=rad(b[0]-a[0]),dlon=rad(b[1]-a[1]);
 const h=Math.sin(dlat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dlon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function openNow(slot,selected,today,minutes){return selected===today&&!slot.unknown&&!!slot.h&&(slot.overnight||minutes>=slot.h[0]*60&&minutes<slot.h[1]*60)}
export function sharedState(search,today){
 const p=new URLSearchParams(search),raw=p.get('date');
 const date=raw&&/^\d{4}-\d{2}-\d{2}$/.test(raw)&&Number.isFinite(Date.parse(raw))&&new Date(raw).toISOString().slice(0,10)===raw?raw:today;
 return {date,view:p.get('view')==='map'?'map':'list',favorites:p.get('favorites')==='1',open:p.get('open')==='1'&&date===today};
}
export function stateUrl(href,state){
 const url=new URL(href);url.searchParams.set('date',state.date);url.searchParams.set('view',state.view);
 for(const [key,on] of [['favorites',state.favorites],['open',state.open]]){if(on)url.searchParams.set(key,'1');else url.searchParams.delete(key)}
 if(state.district)url.searchParams.set('district',state.district);else url.searchParams.delete('district');
 // Location is never part of shared state.
 return url.href;
}
export function clusterPoints(items,project,radius=42){
 const groups=[];
 for(const item of items){const p=project(item.m.coords);const group=groups.find(g=>Math.hypot(g.x-p.x,g.y-p.y)<radius);
  if(group){group.items.push(item);const n=group.items.length;group.x+=(p.x-group.x)/n;group.y+=(p.y-group.y)/n}
  else groups.push({x:p.x,y:p.y,items:[item]});
 }
 return groups;
}
export function freshness(m,now=Date.now()){
 const timestamp=m.fetchedAt,checked=typeof timestamp==='string'?Date.parse(timestamp):NaN;
 const date=Number.isFinite(checked)?new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',day:'numeric',month:'short'}).format(new Date(checked)):'';
 const stale=!Number.isFinite(checked)||now-checked>48*3600000;
 return {warning:stale||!!m.refreshFailed||!!m.refreshPending,text:date?`Hours & entry checked ${date}${m.refreshFailed?' · latest check unavailable':m.refreshPending?' · update pending':stale?' · saved details':''}`:'Hours & entry check date unavailable'};
}

export function closingMinutes(slot,selected,today,minutes){
 if(!openNow(slot,selected,today,minutes)||!Number.isFinite(slot.h?.[1]))return null;
 const current=slot.overnight?minutes+1440:minutes;
 const left=Math.ceil(slot.h[1]*60-current);
 return left>0&&left<=30?left:null;
}
