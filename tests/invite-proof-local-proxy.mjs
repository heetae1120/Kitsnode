// Test-only local proxy for the actual Edge handler. Never import in production.
import {createServer} from 'node:http';
export async function startProofProxy(handler){
 const server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url||'/', 'http://127.0.0.1');
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const headers=new Headers();for(const [name,value] of Object.entries(req.headers))if(typeof value==='string'&&name.toLowerCase()!=='host')headers.set(name,value);
   const opts={method:req.method,headers};if(!['GET','HEAD'].includes(req.method))opts.body=Buffer.concat(chunks);
   const response=await handler(new Request(`https://local.invalid${url.pathname}${url.search}`,opts));
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)})};
}
