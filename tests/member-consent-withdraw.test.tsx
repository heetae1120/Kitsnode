import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemberConsentWithdraw} from '../src/components/store/member-consent-withdraw';

test('withdrawal requires a separate confirmation step',()=>{
  const html=renderToStaticMarkup(<MemberConsentWithdraw withdraw={async()=>({ok:false})} onWithdrawn={()=>{}}/>);
  assert.match(html,/키츠노드 동의 철회/);
  assert.doesNotMatch(html,/동의 기록 철회하기/);
});
