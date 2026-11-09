import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFeed} from '../lib/geojson.mjs';
const url='https://www.berlin.de/en/christmas-markets/3659027-3230598-sustainable-christmas-market-sophienstra.en.html';
const fixture=()=>({type:'FeatureCollection',properties:{title:'Christmas Markets 2026'},features:[{type:'Feature',geometry:{type:'Point',coordinates:[13.4023,52.5253]},properties:{title:'Sophienstraße',url,address:'Sophienstraße, Berlin',description:'Market description',modified:'2026-11-06T08:24:47+0100'}}]});
test('GeoJSON longitude/latitude becomes Leaflet latitude/longitude with source metadata',()=>{
 const out=parseFeed(fixture());assert.equal(out.seasonYear,2026);assert.deepEqual(out.markets[0].coords,[52.5253,13.4023]);assert.equal(out.markets[0].url,url);assert.equal(out.markets[0].address,'Sophienstraße, Berlin');assert.equal(out.markets[0].sourceModified,'2026-11-06T08:24:47+0100');
});
test('untrusted detail destinations and incomplete feeds cannot replace saved data',()=>{
 const unsafe=fixture();unsafe.features[0].properties.url='https://example.com/market';assert.throws(()=>parseFeed(unsafe),/invalid/);
 const empty=fixture();empty.features=[];assert.throws(()=>parseFeed(empty),/Invalid/);
 const duplicate=fixture();duplicate.features.push(duplicate.features[0]);assert.throws(()=>parseFeed(duplicate),/duplicate/);
});
test('missing or invalid coordinates retain the listing without a misleading map pin',()=>{
 const missing=fixture();missing.features[0].geometry=null;assert.equal(parseFeed(missing).markets[0].coords,null);
 const invalid=fixture();invalid.features[0].geometry.coordinates=[200,100];assert.equal(parseFeed(invalid).markets[0].coords,null);
});
