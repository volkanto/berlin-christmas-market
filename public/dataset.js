const official=/^https:\/\/www\.berlin\.de\/en\/christmas-markets\/\d+-\d+-[a-z0-9-]+\.en\.html$/;
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s));
const slot=s=>s===null||Array.isArray(s)&&s.length===2&&Number.isFinite(s[0])&&s[0]>=0&&s[0]<24&&(s[1]===null||Number.isFinite(s[1])&&s[1]>s[0]&&s[1]<=48);
export function validDataset(data){
 return !!data&&data.version===1&&Number.isInteger(data.seasonYear)&&data.seasonYear>=2026&&data.seasonYear<2100&&typeof data.checkedAt==='string'&&Number.isFinite(Date.parse(data.checkedAt))&&['snapshot','live','partial'].includes(data.kind)&&Array.isArray(data.markets)&&data.markets.length>0&&data.markets.length<=500&&data.markets.every(m=>
 m&&(typeof m.id==='string'||typeof m.id==='number')&&typeof m.name==='string'&&official.test(m.url)&&Array.isArray(m.dates)&&m.dates.every(date)&&Array.isArray(m.closed)&&m.closed.every(date)&&(m.hours===null||Array.isArray(m.hours)&&m.hours.length===7&&m.hours.every(slot))&&m.exceptions&&typeof m.exceptions==='object'&&Object.entries(m.exceptions).every(([d,s])=>date(d)&&slot(s))&&(!m.coords||Array.isArray(m.coords)&&m.coords.length===2&&m.coords.every(Number.isFinite)&&Math.abs(m.coords[0])<=90&&Math.abs(m.coords[1])<=180)
 );
}
