const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
const DAYS=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const DAY_MS=86400000;
const iso=d=>d.toISOString().slice(0,10);
const uniq=items=>[...new Set(items)].sort();
function range(a,b){const start=new Date(a+'T12:00:00Z'),end=new Date(b+'T12:00:00Z');if(isNaN(start)||isNaN(end)||end<start||(end-start)/DAY_MS>400)return [];return Array.from({length:Math.round((end-start)/DAY_MS)+1},(_,i)=>iso(new Date(+start+i*DAY_MS)))}
function dateKey(year,month,day){const d=new Date(Date.UTC(year,month-1,day,12));return d.getUTCMonth()===month-1&&d.getUTCDate()===day?iso(d):null}
export function parseDates(raw,seasonYear=2026){
 let text=String(raw??'').toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g,'$1');
 text=text.split(/;?\s*closed\b/)[0];
 if(/not yet known|unconfirmed|cancelled|will not take place/.test(text)||!text.trim())return {dates:[],uncertainEnd:null};
 const parentheses=text.match(/\(([^)]*(?:january|february|march|april|may|june|july|august|september|october|november|december)[^)]*)\)/);if(parentheses)text=parentheses[1];
 const tokenRE=/january|february|march|april|may|june|july|august|september|october|november|december|\b\d{1,4}\b/g;
 const tokens=[...text.matchAll(tokenRE)].map(m=>({v:m[0],start:m.index,end:m.index+m[0].length}));
 const firstYear=Number(tokens.find(t=>/^20\d\d$/.test(t.v))?.v)||seasonYear;
 let month=null,year=seasonYear,lastMonth=null;const points=[];
 for(let i=0;i<tokens.length;i++){
  const t=tokens[i],monthIndex=MONTHS.indexOf(t.v);if(monthIndex>=0){month=monthIndex+1;continue}
  if(+t.v>31)continue;
  let pointMonth=month;
  for(let j=i+1;j<tokens.length;j++){
   const mi=MONTHS.indexOf(tokens[j].v);if(mi>=0){const following=tokens[j+1];const between=text.slice(t.end,tokens[j].start);if(!pointMonth||((!following||+following.v>31)&&!/\bto\b|\buntil\b/.test(between)))pointMonth=mi+1;break}
  }
  if(!pointMonth)continue;
  let pointYear=null;
  for(let j=i+1;j<tokens.length;j++){const nextMonth=MONTHS.indexOf(tokens[j].v);if(nextMonth>=0&&nextMonth+1!==pointMonth)break;if(/^20\d\d$/.test(tokens[j].v)){pointYear=+tokens[j].v;break}}
  if(pointYear)year=pointYear;else if(lastMonth!==null&&pointMonth<lastMonth)year++;else if(!points.length&&pointMonth<3)year=seasonYear+1;
  const key=dateKey(year,pointMonth,+t.v);if(key){points.push({key,start:t.start,end:t.end});lastMonth=pointMonth}
 }
 if(!points.length)return {dates:[],uncertainEnd:null};
 let dates=[];for(let i=0;i<points.length;i++){const point=points[i],previous=points[i-1],between=previous?text.slice(previous.end,point.start):'';dates.push(...(previous&&/\bto\b|\buntil\b|\bthrough\b|[-–—]/.test(between)?range(previous.key,point.key):[point.key]))}
 let uncertainEnd=null,endUncertainFrom=null;
 const tail=text.slice(points.at(-1).end).replace(/\b20\d\d\b/g,'');
 const endMonth=MONTHS.findIndex(m=>new RegExp('(?:to|until)\\s+'+m+'\\b').test(tail));
 if(points.length===1&&endMonth>=0){let endYear=Number(tokens.at(-1)?.v)>31?Number(tokens.at(-1).v):year+(endMonth+1<lastMonth?1:0);const last=new Date(Date.UTC(endYear,endMonth+1,0,12));dates=range(points[0].key,iso(last));uncertainEnd='Final date unconfirmed';endUncertainFrom=dateKey(endYear,endMonth+1,1)}
 else if(points.length===1&&/^from\b/.test(text.trim())){dates=range(points[0].key,`${firstYear+1}-02-28`);uncertainEnd='End date unconfirmed'}
 return {dates:uniq(dates),uncertainEnd,endUncertainFrom};
}
function weekdaySet(text){
 const re=/sunday|monday|tuesday|wednesday|thursday|friday|saturday/g;const items=[...text.toLowerCase().matchAll(re)];if(!items.length)return null;
 const result=new Set();for(let i=0;i<items.length;i++){const day=DAYS.indexOf(items[i][0]);result.add(day);if(i){const previous=DAYS.indexOf(items[i-1][0]),between=text.slice(items[i-1].index+items[i-1][0].length,items[i].index);if(/to|through|[-–—]/.test(between)){let n=previous;for(let j=0;j<7&&n!==day;j++){n=(n+1)%7;result.add(n)}}}}
 return [...result];
}
function timeValue(hour,minute,period){let h=+hour;if(period==='noon')h=12;else if(period==='midnight')h=0;else if(period==='pm'&&h<12)h+=12;else if(period==='am'&&h===12)h=0;return h+(+minute||0)/60}
function readTime(text){
 const normalized=text.toLowerCase().replace(/\bnoon\b/g,'12 pm').replace(/\bmidnight\b/g,'12 am').replace(/\b12\s+12\b/g,'12').replace(/\bto around\b/g,'to');
 const re=/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:to|[-–—])\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/;
 const m=normalized.match(re);
 if(m){let ap=m[3];if(!ap&&m[6]==='pm')ap=+m[1]>+m[4]?'am':'pm';if(!ap)ap=m[6];let a=timeValue(m[1],m[2],ap),b=timeValue(m[4],m[5],m[6]);if(b<=a)b+=24;return [a,b]}
 const one=normalized.match(/(?:from\s+)(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/);return one?[timeValue(one[1],one[2],one[3]),null]:null;
}
function closureDates(text,year){
 const normalized=text.replace(/christmas eve/gi,'December 24').replace(/new year[’']?s eve/gi,'December 31');
 const matches=[...normalized.matchAll(/closed\s+(?:on\s+|from\s+)?([^;]+)/gi)];return uniq(matches.flatMap(m=>parseDates(m[1],year).dates));
}
export function parseHours(raw,dateText,year){
 const text=String(raw??'').toLowerCase(),hours=Array(7).fill(null),exceptions={};let recognized=false,pending='';
 for(let clause of text.split(/[,;]/)){
  clause=(pending+' '+clause).trim();const time=readTime(clause);
  if(!time){pending=weekdaySet(clause)&&!clause.includes('closed')?clause:'';continue}pending='';
  if(/closed/.test(clause))continue;
  const weekdays=weekdaySet(clause);const prefix=clause.split(/\bfrom\b/)[0];
  if(weekdays){for(const d of weekdays)hours[d]=time;recognized=true}
  else if(MONTHS.some(m=>prefix.includes(m))){for(const key of parseDates(prefix,year).dates)exceptions[key]=time}
  else if(!/\d{4}/.test(prefix)){for(let d=0;d<7;d++)hours[d]=time;recognized=true}
 }
 if(/public holidays/.test(text)&&hours[0])for(const key of [`${year}-12-25`,`${year}-12-26`,`${year+1}-01-01`])exceptions[key]=hours[0];
 return {hours:recognized?hours:null,exceptions,closed:closureDates(String(raw)+';'+String(dateText),year)};
}
export function normalizeMarket(raw,previous,year){
 const base=previous||{id:'berlin-'+raw.path.match(/\/(\d+)-/)?.[1],district:'',dates:[],closed:[],exceptions:{}};
 const sameDates=previous&&raw.dateText===previous.dateText,sameHours=previous&&raw.hoursText===previous.hoursText;
 const parsedDates=parseDates(raw.dateText,year),parsedHours=parseHours(raw.hoursText,raw.dateText,year);
 const dates=sameDates?previous.dates:parsedDates.dates;
 const retain=sameDates&&sameHours;
 return {...base,...raw,dates,hours:retain?previous.hours:parsedHours.hours,closed:retain?uniq([...(previous.closed||[]),...parsedHours.closed]):parsedHours.closed,exceptions:retain?{...previous.exceptions,...parsedHours.exceptions}:parsedHours.exceptions,coords:raw.coords||(raw.address&&raw.address!==previous?.address?null:previous?.coords)||null,address:raw.address||previous?.address||'',uncertainEnd:parsedDates.uncertainEnd,endUncertainFrom:parsedDates.endUncertainFrom||null,refreshFailed:false};
}
