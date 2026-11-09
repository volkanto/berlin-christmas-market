export const INDEX='https://www.berlin.de/en/christmas-markets/';
const PATH=/^\/en\/christmas-markets\/\d+-\d+-[a-z0-9-]+\.en\.html$/;
export function validPath(path){return typeof path==='string'&&PATH.test(path)}
export function text(html){const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',euro:'€',ndash:'–',mdash:'—',rsquo:'’',lsquo:'‘',auml:'ä',ouml:'ö',uuml:'ü',Auml:'Ä',Ouml:'Ö',Uuml:'Ü',szlig:'ß'};return String(html).replace(/<[^>]*>/g,' ').replace(/&(#x[\da-f]+|#\d+|[\w]+);/gi,(_,e)=>{if(e[0]==='#'){const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):''}return entities[e]??'&'+e+';'}).replace(/\s+/g,' ').trim()}
export function parseIndex(html){
 const anchor=html.indexOf('All Christmas Markets');if(anchor<0)throw Error('Market overview was not found');
 const section=html.slice(anchor,html.indexOf('</ul>',anchor)+5);
 const seen=new Set(),markets=[];
 for(const m of section.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  const url=new URL(text(m[1]),INDEX);if(url.origin!=='https://www.berlin.de'||!validPath(url.pathname)||seen.has(url.pathname))continue;
  seen.add(url.pathname);markets.push({path:url.pathname,url:url.href,name:text(m[2])});
 }
 if(!markets.length)throw Error('No current market listings were found');
 const seasonYear=Number(html.slice(anchor,anchor+100).match(/20\d{2}/)?.[0])||new Date().getUTCFullYear();
 return {markets,seasonYear,checkedAt:new Date().toISOString()};
}
export function parseDetail(html,path){
 if(!validPath(path))throw Error('Invalid market path');
 const fields={};for(const m of html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi))fields[text(m[1]).toLowerCase()]=text(m[2]);
 const name=text(html.match(/<h1\b[^>]*class=["'][^"']*article__title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
 if(!name)throw Error('The market listing could not be read');
 const subtitle=text(html.match(/<p\b[^>]*class=["'][^"']*article__subtitle[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]||'');
 const geo=html.match(/ADR_LOCATION=([\d.]+)(?:%2C|,)([\d.]+)/i);
 const address=text(html.match(/<div\b[^>]*class=["']street-address["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]||'');
 return {path,url:'https://www.berlin.de'+path,name,dateText:fields.dates||fields.date||subtitle||'Not yet known',hoursText:fields['opening hours']||fields['opening times']||'Not yet known',fee:fields['admission fee']||'',coords:geo?[Number(geo[1]),Number(geo[2])]:null,address,note:fields['please note']||'',fetchedAt:new Date().toISOString()};
}
export async function fetchPage(path){
 const url=path==='/'?INDEX:'https://www.berlin.de'+path;
 if(path!=='/'&&!validPath(path))throw Error('Invalid market path');
 let destination=url;
 for(let attempt=0;attempt<3;attempt++){
  const response=await fetch(destination,{headers:{Accept:'text/html','Cache-Control':'no-cache'},redirect:'manual',signal:AbortSignal.timeout(18000)});
  if(response.status>=300&&response.status<400){
   const location=response.headers.get('location');if(!location)throw Error('Invalid redirect');
   const next=new URL(location,destination);
   if(next.origin!=='https://www.berlin.de'||!(next.pathname==='/en/christmas-markets/'||validPath(next.pathname)))throw Error('Unexpected source redirect');
   destination=next.href;continue;
  }
  if(!response.ok){const excerpt=(await response.text()).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,500);console.error('Berlin.de upstream '+response.status+': '+excerpt);throw Object.assign(Error('Berlin.de returned '+response.status),{status:response.status})}
  const html=await response.text();if(html.length>1500000)throw Error('Unexpected listing size');return html;
 }
 throw Error('Too many source redirects');
}
