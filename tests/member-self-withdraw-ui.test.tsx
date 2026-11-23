import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemberSelfWithdraw} from '../src/components/store/member-self-withdraw';
test('withdrawal requires an explicit confirmation step',()=>{
 const html=renderToStaticMarkup(<MemberSelfWithdraw withdraw={async()=>({ok:false,code:'unavailable'})}/>);
 assert.match(html,/회원 탈퇴/);
 assert.match(html,/<dialog(?![^>]*\sopen)/);
 assert.doesNotMatch(html,/확인을 위해.*입력/);
});
