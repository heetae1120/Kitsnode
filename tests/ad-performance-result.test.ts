import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdPerformanceResult} from '../src/components/store/ad-performance-result';

const base = {source:'naver_stats', period:{since:'2026-11-01',until:'2026-11-18'}, observedAt:'2026-11-18T01:00:00.000Z'};
const render = (result:unknown) => renderToStaticMarkup(createElement(AdPerformanceResult,{result}));
test('renders observed metrics while distinguishing zero from missing',()=>{
 const html=render({...base,status:'observed',metrics:{impressions:1000,clicks:0,cost:50,clickThroughRate:0,averageClickCost:null}});
 assert.match(html,/1,000회/); assert.match(html,/0회/); assert.match(html,/50원/); assert.match(html,/0%/); assert.match(html,/자료 없음/); assert.match(html,/2026-11-01 ~ 2026-11-18/);
});
test('empty, invalid and unavailable responses are not shown as zero',()=>{
 assert.match(render({...base,status:'no_data',reason:'empty_response'}),/반환된 통계가 없습니다/);
 assert.match(render({status:'unavailable'}),/확인하지 못했습니다/);
 const invalid=render({...base,period:{since:'2026-02-30',until:'2026-11-18'},status:'observed',metrics:{impressions:0}});
 assert.match(invalid,/확인하지 못했습니다/); assert.doesNotMatch(invalid,/0회/);
});

test('shows provider average CPC in won without estimating a missing value',()=>{
 const html=render({...base,status:'observed',metrics:{impressions:232,clicks:10,cost:1000,clickThroughRate:4.31,averageClickCost:100}});
 assert.match(html,/평균 CPC/); assert.match(html,/100원/);
});
