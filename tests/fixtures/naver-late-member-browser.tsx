import React from 'react';
import {createRoot} from 'react-dom/client';
import {memberBrowserClient} from '../../src/lib/member-browser-client';
import {MemberAuthPrep} from '../../src/components/store/member-auth-prep';
// Simulates the global navigation mounting first and the login page later.
memberBrowserClient();
setTimeout(()=>createRoot(document.getElementById('root')!).render(<MemberAuthPrep mode="login"/>),500);
