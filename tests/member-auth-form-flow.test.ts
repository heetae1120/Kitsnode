import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

type Element = {type: any; props: Record<string, any>};
function harness(props: Record<string, any>) {
  const source=readFileSync(new URL('../src/components/store/member-email-auth-form.tsx',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const states:any[]=[]; let cursor=0;
  const react={useState:(initial:any)=>{const i=cursor++; if(!(i in states)) states[i]=initial; return [states[i],(next:any)=>{states[i]=typeof next==='function'?next(states[i]):next;}];},useRef:(initial:any)=>{const i=cursor++; if(!(i in states)) states[i]={current:initial}; return states[i];},useEffect:()=>{cursor++;}};
  const jsx={jsx:(type:any,props:any)=>({type,props}),jsxs:(type:any,props:any)=>({type,props}),Fragment:Symbol('fragment')};
  const exports:Record<string,any>={};
  new Function('require','exports',code)((name:string)=>name==='react'?react:name==='react/jsx-runtime'?jsx:undefined,exports);
  function render():Element {cursor=0;return exports.EmailAuthForm(props);}
  function all(root:Element):Element[] {const result:Element[]=[];function visit(node:any){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return;}if(node.type){result.push(node);visit(node.props?.children);}}visit(root);return result;}
  return {render,all};
}
const noop=async()=>({ok:false,code:'disabled'});
const auth={signUp:noop,signIn:noop,signOut:noop,requestPasswordReset:noop,updatePassword:noop};

test('legacy signup submits the existing operation after its required consents',async()=>{
  const calls:any[]=[];
  const signupConsent={terms:{href:'/terms/',version:'v1'},privacy:{href:'/privacy/',version:'v1'},register:async(...args:any[])=>{calls.push(args);return {ok:true,code:'signup_requested'};}};
  const ui=harness({auth,initialMode:'signup',allowSignup:true,signupConsent});
  let nodes=ui.all(ui.render());
  nodes.find(x=>x.type==='input'&&x.props.type==='email')!.props.onChange({target:{value:'user@example.test'}});
  nodes.find(x=>x.type==='input'&&x.props.type==='password')!.props.onChange({target:{value:'password123'}});
  nodes.filter(x=>x.type==='input'&&x.props.type==='checkbox').forEach(x=>x.props.onChange({target:{checked:true}}));
  nodes=ui.all(ui.render());
  nodes.find(x=>x.type==='form')!.props.onSubmit({preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0],['user@example.test','password123',{termsVersion:'v1',privacyVersion:'v1',termsAccepted:true,privacyAcknowledged:true}]);
});

test('extended mode with no endpoint cannot call legacy signup',async()=>{
  let calls=0;
  const signupConsent={terms:{href:'/terms/',version:'v1'},privacy:{href:'/privacy/',version:'v1'},register:async()=>{calls++;return {ok:true,code:'signup_requested'};}};
  const ui=harness({auth,initialMode:'signup',allowSignup:true,signupConsent,signupVariant:'extended'});
  const nodes=ui.all(ui.render());
  assert.ok(!nodes.some(x=>x.type==='input'&&x.props.autoComplete==='username'));
  assert.ok(nodes.some(x=>x.type==='h2'&&x.props.children==='이메일 로그인'));
  assert.equal(calls,0);
});

test('username login normalizes the username and calls only the explicit username endpoint',async()=>{
  const usernameCalls:any[]=[];const emailCalls:any[]=[];
  const loginAuth={...auth,signIn:async(...args:any[])=>{emailCalls.push(args);return {ok:true,code:'signed_in'};}};
  const ui=harness({auth:loginAuth,signinVariant:'username',usernameSignIn:async(...args:any[])=>{usernameCalls.push(args);return {ok:true,code:'signed_in'};}});
  let nodes=ui.all(ui.render());
  const usernameInput=nodes.find(x=>x.type==='input'&&x.props.autoComplete==='username')!;
  assert.equal(usernameInput.props['data-auth-edit'],undefined);
  usernameInput.props.onChange({target:{value:'Seller_01'}});
  nodes.find(x=>x.type==='input'&&x.props.type==='password')!.props.onChange({target:{value:'password123'}});
  nodes=ui.all(ui.render());nodes.find(x=>x.type==='form')!.props.onSubmit({preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(usernameCalls,[['seller_01','password123']]);assert.equal(emailCalls.length,0);
});

test('username endpoint missing disables sign-in and allows an explicit email fallback',async()=>{
  const emailCalls:any[]=[];const loginAuth={...auth,signIn:async(...args:any[])=>{emailCalls.push(args);return {ok:true,code:'signed_in'};}};
  const ui=harness({auth:loginAuth,signinVariant:'username'});
  let nodes=ui.all(ui.render());
  assert.equal(nodes.find(x=>x.type==='button'&&x.props['data-auth-edit']==='submit-button')!.props.disabled,true);
  nodes.find(x=>x.type==='form')!.props.onSubmit({preventDefault(){}});
  assert.equal(emailCalls.length,0);
  nodes.find(x=>x.type==='button'&&x.props.children==='이메일로 로그인')!.props.onClick();
  nodes=ui.all(ui.render());
  nodes.find(x=>x.type==='input'&&x.props.type==='email')!.props.onChange({target:{value:'user@example.test'}});
  nodes.find(x=>x.type==='input'&&x.props.type==='password')!.props.onChange({target:{value:'password123'}});
  nodes=ui.all(ui.render());nodes.find(x=>x.type==='form')!.props.onSubmit({preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(emailCalls,[['user@example.test','password123']]);
});

test('password reset from username sign-in requests an email address',()=>{
  const ui=harness({auth,signinVariant:'username'});
  let nodes=ui.all(ui.render());nodes.find(x=>x.type==='button'&&x.props.children==='비밀번호 재설정')!.props.onClick();
  nodes=ui.all(ui.render());assert.ok(nodes.some(x=>x.type==='input'&&x.props.type==='email'));
  assert.ok(!nodes.some(x=>x.type==='input'&&x.props.autoComplete==='username'));
});
