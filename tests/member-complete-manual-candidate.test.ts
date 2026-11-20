import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
type Element={type:any;props:Record<string,any>};
function fixture(props:Record<string,any>){
 const source=readFileSync(new URL('../src/components/store/member-complete-manual-candidate.tsx',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const states:any[]=[];let cursor=0;
 const react={useState:(initial:any)=>{const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],(next:any)=>{states[i]=typeof next==='function'?next(states[i]):next;}];},useRef:(initial:any)=>{const i=cursor++;if(!(i in states))states[i]={current:initial};return states[i];},useEffect:()=>{cursor++;}};
 const jsx={jsx:(type:any,props:any)=>({type,props}),jsxs:(type:any,props:any)=>({type,props}),Fragment:Symbol('fragment')};const exports:Record<string,any>={};
 new Function('require','exports',code)((id:string)=>id==='react'?react:id==='react/jsx-runtime'?jsx:undefined,exports);
 const render=()=>{cursor=0;return exports.MemberCompleteManualCandidate(props) as Element;};
 const all=(root:Element)=>{const found:Element[]=[];function visit(node:any){if(!node||typeof node!=='object')return;if(Array.isArray(node))return node.forEach(visit);if(node.type){found.push(node);visit(node.props?.children);}}visit(root);return found;};
 return {render,all};
}
const notice={terms:{href:'/terms/',version:'v1'},privacy:{href:'/privacy/',version:'v1'}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('recovery requires explicit verified email and both API operations',()=>{
 let calls=0;const api={checkUsername:async()=>{calls++;return {ok:true,code:'available'};},complete:async()=>{calls++;return {ok:true,code:'profile_completed'};}};
 for(const props of [{...notice,api},{...notice,sessionKey:'session-one',verifiedEmail:'verified@example.test'},{...notice,sessionKey:'session-one',verifiedEmail:'verified@example.test',api,terms:{href:'//evil.test/',version:'v1'}}]){
  const ui=fixture(props);const nodes=ui.all(ui.render());assert.equal(nodes.find(x=>x.type==='button'&&x.props.type==='submit')!.props.disabled,true);assert.ok(!nodes.some(x=>x.type==='a'&&x.props.href==='//evil.test/'));
 }
 assert.equal(calls,0);
});

test('manual completion sends reentered fields and fresh separate consent without password',async()=>{
 const calls:any[]=[];const api={checkUsername:async()=>({ok:true,code:'available'}),complete:async(input:any)=>{calls.push(input);return {ok:true,code:'profile_completed'};}};
 const ui=fixture({...notice,sessionKey:'session-one',verifiedEmail:'verified@example.test',api});let nodes=ui.all(ui.render());
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='name')!.props.onChange({target:{value:'홍길동'}});
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='username')!.props.onChange({target:{value:'Seller_01'}});
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='tel')!.props.onChange({target:{value:'010-1234-5678'}});
 nodes.filter(x=>x.type==='input'&&x.props.type==='checkbox').forEach(x=>x.props.onChange({target:{checked:true}}));
 nodes=ui.all(ui.render());await nodes.find(x=>x.type==='button'&&x.props.type==='button')!.props.onClick();await tick();
 nodes=ui.all(ui.render());assert.equal(nodes.find(x=>x.type==='button'&&x.props.type==='submit')!.props.disabled,false);
 nodes.find(x=>x.type==='form')!.props.onSubmit({preventDefault(){}});await tick();
 assert.deepEqual(calls,[{name:'홍길동',username:'seller_01',email:'verified@example.test',phone:'010-1234-5678',termsAccepted:true,privacyAccepted:true,ageConfirmed:true,termsVersion:'v1',privacyVersion:'v1'}]);
 assert.ok(ui.all(ui.render()).some(x=>x.type==='h2'&&x.props.children==='가입 완료'));
});

test('username collision during completion returns to a disabled retry state',async()=>{
 const api={checkUsername:async()=>({ok:true,code:'available'}),complete:async()=>({ok:false,code:'username_taken'})};const ui=fixture({...notice,sessionKey:'session-one',verifiedEmail:'verified@example.test',api});let nodes=ui.all(ui.render());
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='name')!.props.onChange({target:{value:'이름'}});
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='username')!.props.onChange({target:{value:'seller_01'}});
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='tel')!.props.onChange({target:{value:'01012345678'}});
 nodes.filter(x=>x.type==='input'&&x.props.type==='checkbox').forEach(x=>x.props.onChange({target:{checked:true}}));
 nodes=ui.all(ui.render());nodes.find(x=>x.type==='button'&&x.props.type==='button')!.props.onClick();await tick();
 nodes=ui.all(ui.render());nodes.find(x=>x.type==='form')!.props.onSubmit({preventDefault(){}});await tick();nodes=ui.all(ui.render());
 assert.equal(nodes.find(x=>x.type==='button'&&x.props.type==='submit')!.props.disabled,true);
 assert.ok(nodes.some(x=>x.props?.role==='alert'&&String(x.props.children).includes('이미 사용 중')));
});

test('late username responses cannot approve a changed username',async()=>{
 let release:(value:{ok:boolean;code:string})=>void=()=>{};
 const api={checkUsername:()=>new Promise<{ok:boolean;code:string}>(resolve=>{release=resolve;}),complete:async()=>({ok:true,code:'profile_completed'})};const ui=fixture({...notice,sessionKey:'session-one',verifiedEmail:'verified@example.test',api});let nodes=ui.all(ui.render());
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='username')!.props.onChange({target:{value:'first_id'}});nodes=ui.all(ui.render());
 nodes.find(x=>x.type==='button'&&x.props.type==='button')!.props.onClick();nodes=ui.all(ui.render());
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='username')!.props.onChange({target:{value:'other_id'}});release({ok:true,code:'available'});await tick();nodes=ui.all(ui.render());
 assert.equal(nodes.find(x=>x.type==='button'&&x.props.type==='submit')!.props.disabled,true);
 assert.ok(!nodes.some(x=>x.props?.children==='사용 가능한 아이디입니다.'));
});

test('a session change fails closed and discards an earlier completion response',async()=>{
 let release:(value:{ok:boolean;code:string})=>void=()=>{};let completed=0;
 const api={checkUsername:async()=>({ok:true,code:'available'}),complete:()=>new Promise<{ok:boolean;code:string}>(resolve=>{release=resolve;})};
 const props={...notice,sessionKey:'session-one',verifiedEmail:'first@example.test',api,onCompleted:()=>{completed++;}};
 const ui=fixture(props);let nodes=ui.all(ui.render());
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='name')!.props.onChange({target:{value:'홍길동'}});
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='username')!.props.onChange({target:{value:'seller_01'}});
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='tel')!.props.onChange({target:{value:'01012345678'}});
 nodes.filter(x=>x.type==='input'&&x.props.type==='checkbox').forEach(x=>x.props.onChange({target:{checked:true}}));
 nodes=ui.all(ui.render());nodes.find(x=>x.type==='button'&&x.props.type==='button')!.props.onClick();await tick();
 nodes=ui.all(ui.render());nodes.find(x=>x.type==='form')!.props.onSubmit({preventDefault(){}});
 props.sessionKey='session-two';props.verifiedEmail='second@example.test';nodes=ui.all(ui.render());
 assert.ok(!nodes.some(x=>x.type==='input'));
 assert.ok(nodes.some(x=>x.props?.role==='alert'));
 release({ok:true,code:'profile_completed'});await tick();nodes=ui.all(ui.render());
 assert.equal(completed,0);assert.ok(!nodes.some(x=>x.type==='h2'&&x.props.children==='가입 완료'));
});

test('verified email alone does not make the candidate ready without a session key',()=>{
 const api={checkUsername:async()=>({ok:true,code:'available'}),complete:async()=>({ok:true,code:'profile_completed'})};const ui=fixture({...notice,verifiedEmail:'verified@example.test',api});
 const nodes=ui.all(ui.render());assert.equal(nodes.find(x=>x.type==='button'&&x.props.type==='submit')!.props.disabled,true);
});

test('missing persisted consent explains why completion cannot succeed',async()=>{
 let completed=0;
 const api={checkUsername:async()=>({ok:true,code:'available'}),complete:async()=>({ok:false,code:'consent_required'})};
 const ui=fixture({...notice,sessionKey:'session-one',verifiedEmail:'verified@example.test',api,onCompleted:()=>{completed++;}});let nodes=ui.all(ui.render());
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='name')!.props.onChange({target:{value:'홍길동'}});
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='username')!.props.onChange({target:{value:'seller_01'}});
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='tel')!.props.onChange({target:{value:'01012345678'}});
 nodes.filter(x=>x.type==='input'&&x.props.type==='checkbox').forEach(x=>x.props.onChange({target:{checked:true}}));
 nodes=ui.all(ui.render());nodes.find(x=>x.type==='button'&&x.props.type==='button')!.props.onClick();await tick();
 nodes=ui.all(ui.render());nodes.find(x=>x.type==='form')!.props.onSubmit({preventDefault(){}});await tick();nodes=ui.all(ui.render());
 assert.equal(completed,0);assert.ok(!nodes.some(x=>x.type==='h2'&&x.props.children==='가입 완료'));
 assert.ok(nodes.some(x=>x.props?.role==='alert'&&String(x.props.children).includes('동의 기록이 없어')));
 assert.ok(nodes.some(x=>x.props?.role==='alert'&&String(x.props.children).includes('동의 절차가 준비되면')));
});

test('repository verification failure is shown without completing signup',async()=>{
 let completed=0;
 const api={checkUsername:async()=>({ok:true,code:'available'}),complete:async()=>({ok:false,code:'verification_required'})};
 const ui=fixture({...notice,sessionKey:'session-one',verifiedEmail:'verified@example.test',api,onCompleted:()=>{completed++;}});let nodes=ui.all(ui.render());
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='name')!.props.onChange({target:{value:'홍길동'}});
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='username')!.props.onChange({target:{value:'seller_01'}});
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='tel')!.props.onChange({target:{value:'01012345678'}});
 nodes.filter(x=>x.type==='input'&&x.props.type==='checkbox').forEach(x=>x.props.onChange({target:{checked:true}}));
 nodes=ui.all(ui.render());nodes.find(x=>x.type==='button'&&x.props.type==='button')!.props.onClick();await tick();
 nodes=ui.all(ui.render());nodes.find(x=>x.type==='form')!.props.onSubmit({preventDefault(){}});await tick();nodes=ui.all(ui.render());
 assert.equal(completed,0);assert.ok(!nodes.some(x=>x.type==='h2'&&x.props.children==='가입 완료'));
 assert.ok(nodes.some(x=>x.props?.role==='alert'&&String(x.props.children).includes('이메일 인증 상태를 확인하지 못했습니다')));
});

test('existing member profile explains the conflict without reporting completion',async()=>{
 let completed=0,attempts=0;
 const api={checkUsername:async()=>({ok:true,code:'available'}),complete:async()=>{attempts++;return {ok:false,code:'profile_exists'}}};
 const ui=fixture({...notice,sessionKey:'session-one',verifiedEmail:'verified@example.test',api,onCompleted:()=>{completed++;}});let nodes=ui.all(ui.render());
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='name')!.props.onChange({target:{value:'홍길동'}});
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='username')!.props.onChange({target:{value:'seller_01'}});
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='tel')!.props.onChange({target:{value:'01012345678'}});
 nodes.filter(x=>x.type==='input'&&x.props.type==='checkbox').forEach(x=>x.props.onChange({target:{checked:true}}));
 nodes=ui.all(ui.render());nodes.find(x=>x.type==='button'&&x.props.type==='button')!.props.onClick();await tick();
 nodes=ui.all(ui.render());nodes.find(x=>x.type==='form')!.props.onSubmit({preventDefault(){}});await tick();nodes=ui.all(ui.render());
 assert.equal(completed,0);assert.equal(attempts,1);assert.ok(!nodes.some(x=>x.type==='h2'&&x.props.children==='가입 완료'));
 assert.ok(nodes.some(x=>x.props?.role==='alert'&&String(x.props.children).includes('기존 회원정보를 확인하거나 문의')));
});

test('lost completion response does not assert failure or request immediate retry',async()=>{
 const api={checkUsername:async()=>({ok:true,code:'available'}),complete:async()=>({ok:false,code:'completion_unconfirmed'})};
 const ui=fixture({...notice,sessionKey:'session-one',verifiedEmail:'verified@example.test',api});let nodes=ui.all(ui.render());
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='name')!.props.onChange({target:{value:'홍길동'}});
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='username')!.props.onChange({target:{value:'seller_01'}});
 nodes.find(x=>x.type==='input'&&x.props.autoComplete==='tel')!.props.onChange({target:{value:'01012345678'}});
 nodes.filter(x=>x.type==='input'&&x.props.type==='checkbox').forEach(x=>x.props.onChange({target:{checked:true}}));
 nodes=ui.all(ui.render());nodes.find(x=>x.type==='button'&&x.props.type==='button')!.props.onClick();await tick();
 nodes=ui.all(ui.render());nodes.find(x=>x.type==='form')!.props.onSubmit({preventDefault(){}});await tick();nodes=ui.all(ui.render());
 assert.ok(nodes.some(x=>x.props?.role==='alert'&&String(x.props.children).includes('가입 완료 여부를 확인하지 못했습니다')));
 assert.ok(nodes.some(x=>x.props?.role==='alert'&&String(x.props.children).includes('회원정보를 확인한 뒤')));
 assert.ok(!nodes.some(x=>x.type==='h2'&&x.props.children==='가입 완료'));
});

for (const [code,noticeText] of [['document_changed','최신 약관을 확인한 뒤 다시 동의'],['document_unverified','약관 내용을 확인하지 못해']] as const) {
 test(`${code} explains the document problem without completing signup`,async()=>{
  let completed=0;const api={checkUsername:async()=>({ok:true,code:'available'}),complete:async()=>({ok:false,code})};
  const ui=fixture({...notice,sessionKey:'session-one',verifiedEmail:'verified@example.test',api,onCompleted:()=>{completed++;}});let nodes=ui.all(ui.render());
  nodes.find(x=>x.type==='input'&&x.props.autoComplete==='name')!.props.onChange({target:{value:'홍길동'}});
  nodes.find(x=>x.type==='input'&&x.props.autoComplete==='username')!.props.onChange({target:{value:'seller_01'}});
  nodes.find(x=>x.type==='input'&&x.props.autoComplete==='tel')!.props.onChange({target:{value:'01012345678'}});
  nodes.filter(x=>x.type==='input'&&x.props.type==='checkbox').forEach(x=>x.props.onChange({target:{checked:true}}));
  nodes=ui.all(ui.render());nodes.find(x=>x.type==='button'&&x.props.type==='button')!.props.onClick();await tick();
  nodes=ui.all(ui.render());nodes.find(x=>x.type==='form')!.props.onSubmit({preventDefault(){}});await tick();nodes=ui.all(ui.render());
  assert.equal(completed,0);assert.ok(!nodes.some(x=>x.type==='h2'&&x.props.children==='가입 완료'));
  assert.ok(nodes.some(x=>x.props?.role==='alert'&&String(x.props.children).includes(noticeText)));
 });
}
