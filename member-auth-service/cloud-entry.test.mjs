import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {main}=require('./index.js');
test('entry refuses events while staging is disabled',async()=>{
 const old=process.env.MEMBER_AUTH_STAGING_ENABLED;delete process.env.MEMBER_AUTH_STAGING_ENABLED;
 try {const result=await main({MEMBER_AUTH_STAGING_ENABLED:'1'});assert.equal(result.statusCode,503);assert.match(result.body,/staging_not_enabled/);} finally {if(old!==undefined)process.env.MEMBER_AUTH_STAGING_ENABLED=old;}
});
