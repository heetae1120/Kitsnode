import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ShoppingScheduleGrid} from '../src/components/store/shopping-schedule-grid';

test('weekly grid exposes 168 hourly slots from Monday 00 through Sunday 24 in Korean time',()=>{
 const slots='1'+'0'.repeat(166)+'1';
 const html=renderToStaticMarkup(<ShoppingScheduleGrid slots={slots} disabled={false} onChange={()=>{}}/>);
 assert.equal((html.match(/type="checkbox"/g)||[]).length,168);
 assert.equal((html.match(/checked=""/g)||[]).length,2);
 assert.match(html,/월요일 00시부터 01시까지/);
 assert.match(html,/일요일 23시부터 24시까지/);
 assert.match(html,/한국 시간 기준/);
 assert.match(html,/선택 2시간 \/ 주 168시간/);
 assert.match(html,/전체 시간 ON/);
 assert.match(html,/전체 시간 OFF/);
});
