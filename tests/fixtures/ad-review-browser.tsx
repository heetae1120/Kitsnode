import React from 'react';
import {createRoot} from 'react-dom/client';
import {AdReviewPanel} from '../../src/components/store/ad-review-panel';
const pending='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',connected='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const calls:Array<{action:string;requestId?:string;evidenceId?:string}>=[];
const evidence=[{evidence_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',method:'contract_review',case_ref:'case-expired',recorded_at:'2020-01-01T00:00:00Z',expires_at:'2021-01-01T00:00:00Z',revoked_at:null},{evidence_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',method:'advertiser_confirmation',case_ref:'case-current',recorded_at:'2020-01-01T00:00:00Z',expires_at:'2099-01-01T00:00:00Z',revoked_at:null}];
globalThis.fetch=async(_input,init)=>{
 const body=JSON.parse(String(init?.body));calls.push(body);
 if(body.action==='queue')return Response.json({requests:[{request_id:pending,user_id:'user-a',ad_account_id:'12345',status:'pending_review'},{request_id:connected,user_id:'user-b',ad_account_id:'54321',status:'read_connected'}]});
 if(body.action==='evidence')return Response.json({evidence});
 if(body.action==='approve')return Response.json({status:'read_connected'});
 return Response.json({error:'unexpected'}, {status:400});
};
Object.assign(window,{reviewFixture:{calls}});
createRoot(document.getElementById('root')!).render(<AdReviewPanel/>);
