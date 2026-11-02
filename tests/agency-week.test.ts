import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeAgencyWeek} from '../src/lib/agency-week';
const sample={price:28500,cost:12000,units:100,adSpend:300000,agencyFee:100000,feePercent:7,shipping:0,other:0,adUnits:null};
test('total weekly sales do not imply ad-attributed profit',()=>{const r=analyzeAgencyWeek(sample);assert.equal(r.margin,14505);assert.equal(r.weekContribution,1050500);assert.equal(r.adContribution,null);assert.equal(r.roas,null);});
test('agency fees and attributed units determine ad contribution separately',()=>{const r=analyzeAgencyWeek({...sample,adUnits:20});assert.equal(r.adContribution,-109900);assert.equal(r.roas,190);assert.equal(r.breakEvenUnits,28);});
test('zero spend stays undefined for ROAS; invalid quantities are rejected',()=>{assert.equal(analyzeAgencyWeek({...sample,adUnits:0,adSpend:0}).roas,null);assert.throws(()=>analyzeAgencyWeek({...sample,adUnits:101}));assert.throws(()=>analyzeAgencyWeek({...sample,units:1.5}));assert.throws(()=>analyzeAgencyWeek({...sample,price:0}));});
