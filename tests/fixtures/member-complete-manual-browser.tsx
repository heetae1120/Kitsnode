import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemberCompleteManualCandidate} from '../../src/components/store/member-complete-manual-candidate';
type Result={ok:boolean;code:string};
const pending:Array<(value:Result)=>void>=[];
const submissions:unknown[]=[];
const manualFixture={pending,submissions,completion:{ok:false,code:'profile_exists'} as Result,resolve:(i:number,r:Result)=>pending[i](r)};
Object.assign(window,{manualFixture});
createRoot(document.getElementById('root')!).render(<MemberCompleteManualCandidate sessionKey="session-one" verifiedEmail="verified@example.test" terms={{href:'/terms/',version:'v1'}} privacy={{href:'/privacy/',version:'v1'}} api={{checkUsername:()=>new Promise(resolve=>pending.push(resolve)),complete:async input=>{submissions.push(input);return manualFixture.completion;}}}/>);
