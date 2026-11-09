import {validPath,INDEX} from './berlin-source.mjs';
export const FEED='https://www.berlin.de/weihnachtsmarkt/suche/.x-feed/category.geojson?id=10135126&language=en_GB';
export function parseFeed(data){
 if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||!data.features.length||data.features.length>500)throw Error('Invalid market GeoJSON feed');
 const seasonYear=Number(data.properties?.title?.match(/20\d{2}/)?.[0]);
 if(!Number.isInteger(seasonYear)||seasonYear<2026||seasonYear>=2100)throw Error('Feed season could not be read');
 const seen=new Set(),markets=[];
 for(const feature of data.features){
  const p=feature?.properties;let url;
  try{url=new URL(p?.url,INDEX)}catch{continue}
  if(url.origin!=='https://www.berlin.de'||!validPath(url.pathname)||url.search||url.hash||seen.has(url.pathname)||typeof p?.title!=='string'||!p.title.trim())continue;
  seen.add(url.pathname);
  const point=feature.geometry?.type==='Point'?feature.geometry.coordinates:null;
  const coords=Array.isArray(point)&&point.length>=2&&point.slice(0,2).every(Number.isFinite)&&Math.abs(point[0])<=180&&Math.abs(point[1])<=90?[point[1],point[0]]:null;
  markets.push({path:url.pathname,url:url.href,name:p.title.trim(),coords,address:typeof p.address==='string'?p.address.trim():'',description:typeof p.description==='string'?p.description:'',sourceModified:typeof p.modified==='string'?p.modified:null});
 }
 // Do not silently publish an incomplete index when its schema changes.
 if(markets.length!==data.features.length)throw Error('The feed contains invalid or duplicate market listings');
 return {seasonYear,markets};
}
export async function fetchFeed(){
 const response=await fetch(FEED,{headers:{Accept:'application/geo+json, application/json'},redirect:'error',signal:AbortSignal.timeout(18000)});
 if(!response.ok)throw Error('Berlin.de GeoJSON returned '+response.status);
 const body=await response.text();if(body.length>3000000)throw Error('Unexpected feed size');
 return JSON.parse(body);
}
