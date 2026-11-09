import test from 'node:test';import assert from 'node:assert/strict';
import {closingMinutes} from '../public/calendar-utils.js';
const today='2026-11-09';
test('closing badge starts at 30 minutes and disappears at closing',()=>{
 const s={h:[14,22],unknown:false};
 assert.equal(closingMinutes(s,today,today,1289),null);
 assert.equal(closingMinutes(s,today,today,1290),30);
 assert.equal(closingMinutes(s,today,today,1319),1);
 assert.equal(closingMinutes(s,today,today,1320),null);
});
test('overnight closings work before and after midnight',()=>{
 assert.equal(closingMinutes({h:[16,24.25],unknown:false},today,today,1430),25);
 assert.equal(closingMinutes({h:[16,26],overnight:true,unknown:false},today,today,90),30);
 assert.equal(closingMinutes({h:[16,26],overnight:true,unknown:false},today,today,120),null);
});
test('unknown hours and other dates never display a closing countdown',()=>{
 assert.equal(closingMinutes({h:[14,22],unknown:true},today,today,1300),null);
 assert.equal(closingMinutes({h:[14,null],unknown:true},today,today,1300),null);
 assert.equal(closingMinutes({h:[14,22],unknown:false},'2026-11-10',today,1300),null);
});
