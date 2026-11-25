import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ManualInviteRequest} from '../../src/components/store/manual-invite-request';
import {setManualSession} from './manual-invite-auth-stub';

function Fixture(){
 const [user,setUser]=useState('test-user'),[refresh,setRefresh]=useState(0);
 return <><button onClick={()=>setRefresh(value=>value+1)}>테스트 새로고침</button><button onClick={()=>{setManualSession('other-user');setUser('other-user');}}>테스트 계정 전환</button><ManualInviteRequest userId={user} refreshKey={refresh}/></>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
