import {createUsernameHandler} from './handler.mjs';
Deno.test('Deno HTTP runtime does not disclose email and returns session',async()=>{
 const listener=Deno.listen({hostname:'127.0.0.1',port:0});const origin=`http://127.0.0.1:${listener.addr.port}`;listener.close();
 const handler=createUsernameHandler({origin,limit:async()=>true,lookup:async()=>({userId:'u',email:'private@example.test'}),login:async()=>({user:{id:'u',email_confirmed_at:'yes'},session:{access_token:'a',refresh_token:'r'}}),revokeSession:async()=>{},dummyEmail:()=> 'none@example.invalid'});
 const server=Deno.serve({hostname:'127.0.0.1',port:Number(new URL(origin).port),onListen:()=>{}},handler);
 try{const result=await fetch(origin,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action:'login',username:'seller',password:'password'})}).then(r=>r.json());if(result.code!=='signed_in'||JSON.stringify(result).includes('private@example.test'))throw Error('unexpected response')}finally{await server.shutdown()}
});
