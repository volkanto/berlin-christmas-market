import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseDates,parseHours,normalizeMarket} from '../public/market-parser.js';
import {validPath,parseDetail,parseIndex} from '../lib/berlin-source.mjs';
const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/baseline-2026.json',import.meta.url),'utf8')).markets;
test('published 2026 dates and weekly schedules agree with the independently curated snapshot',()=>{
 for(const m of baseline){assert.equal(JSON.stringify(parseDates(m.dateText,2026).dates),JSON.stringify([...m.dates].sort()),m.name+' dates');assert.equal(JSON.stringify(parseHours(m.hoursText,m.dateText,2026).hours),JSON.stringify(m.hours),m.name+' hours')}
});
test('new dates, hours and entrance fees replace previous values',()=>{
 const previous=baseline.find(m=>m.id===3),updated=normalizeMarket({...previous,dateText:'November 7 to December 21, 2026',hoursText:'Wednesday to Friday from 5 pm to 11 pm',fee:'€4'},previous,2026);
 assert.equal(updated.dates[0],'2026-11-07');assert.equal(updated.dates.at(-1),'2026-12-21');assert.deepEqual(updated.hours[5],[17,23]);assert.equal(updated.fee,'€4');
});
test('holiday closures and seasonal year rollover are retained',()=>{
 assert.deepEqual(parseDates('January 1',2026).dates,['2027-01-01']);assert.equal(parseDates('November 23 to January 3, 2027',2026).dates.at(-1),'2027-01-03');
 const h=parseHours('11 am to 10 pm, closed on Christmas Eve and New Year’s Eve','November 23, 2026 to January 3, 2027',2026);assert.deepEqual(h.closed,['2026-12-24','2026-12-31']);
 const open= parseDates('From November 6, 2026',2026);assert(open.uncertainEnd);assert.equal(open.dates.at(-1),'2027-02-28');
});
test('unpublished or unrecognized schedules remain unknown',()=>{
 assert.deepEqual(parseDates('Not yet known',2026).dates,[]);assert.equal(parseHours('Check organizer for times','November 23 to December 23, 2026',2026).hours,null);
});
test('only fixed Berlin.de market paths can be fetched',()=>{
 assert(validPath('/en/christmas-markets/5703554-3230598-heissa-holzmarkt.en.html'));for(const path of ['https://attacker.example/a','/en/christmas-markets/../../admin','/admin','//attacker.example/en/christmas-markets/12-34-evil.en.html'])assert(!validPath(path));
});
test('official HTML fields decode without inserting markup',()=>{
 const path='/en/christmas-markets/5703554-3230598-heissa-holzmarkt.en.html';const html='<h1 class="article__title">Heissa &amp; Holzmarkt</h1><dl><dt>Dates</dt><dd>November 6 to December 20, 2026</dd><dt>Opening Hours</dt><dd>4 pm to 10 pm</dd><dt>Admission Fee</dt><dd><div>&euro;4</div></dd></dl><a href="?ADR_LOCATION=52.5115%2C13.4269">Map</a>';
 const m=parseDetail(html,path);assert.equal(m.name,'Heissa & Holzmarkt');assert.equal(m.fee,'€4');assert.deepEqual(m.coords,[52.5115,13.4269]);
 const i=parseIndex('<h2>All Christmas Markets 2026</h2><ul><li><a href="'+path+'">Heissa Holzmarkt</a></li><li><a href="https://attacker.example/">Other</a></li></ul>');assert.equal(i.markets.length,1);
});
