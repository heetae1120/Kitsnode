import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../out/${p}/index.html`,import.meta.url),'utf8');
test('old URLs preserve the original version and link to current documents',()=>{
 const terms=read('terms'),privacy=read('privacy');
 assert.match(terms,/이메일 인증을 마친 뒤/);assert.match(terms,/terms\/2026-11-23/);
 assert.match(privacy,/2026-11-14-naver/);assert.match(privacy,/privacy\/2026-11-23/);
});
test('new document URLs publish the changed signup and withdrawal description',()=>{
 const terms=read('terms/2026-11-23'),privacy=read('privacy/2026-11-23');
 assert.match(terms,/네이버 계정 인증을 통해 가입/);assert.match(terms,/회원 탈퇴 화면/);
 assert.match(privacy,/2026-11-23/);assert.match(privacy,/휴대폰 번호/);
});
