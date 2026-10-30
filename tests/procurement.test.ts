import test from 'node:test';
import assert from 'node:assert/strict';
import {procurementCosts,type ProcurementInput} from '../src/lib/procurement';
const p:ProcurementInput={unitCost:10,foreignCurrency:true,exchangeRate:200,moq:100,batchLogistics:50000,deliveryPayer:'customer',sellerDelivery:3000,unitOther:100};
test('foreign purchase and batch logistics convert once to unit costs',()=>{assert.deepEqual(procurementCosts(p),{unitCost:2000,unitLogistics:500,shipping:0,other:600,batchCash:250000});});
test('seller delivery is charged only when selected; KRW cost ignores FX',()=>{assert.equal(procurementCosts({...p,deliveryPayer:'seller'}).shipping,3000);assert.equal(procurementCosts({...p,foreignCurrency:false}).unitCost,10);});
test('invalid MOQ, FX and negative freight cannot silently change profits',()=>{for(const changes of [{moq:0},{moq:1.5},{exchangeRate:0},{batchLogistics:-1},{unitCost:1e9}])assert.throws(()=>procurementCosts({...p,...changes}));});
