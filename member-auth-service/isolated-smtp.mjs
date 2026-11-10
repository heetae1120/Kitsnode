// Temporary loopback test only. Actual delivery requires the recipient's inbox.
import nodemailer from 'nodemailer';
export function createIsolatedSmtp({user,password,recipient,transport,onFailure}) {
 const mailbox=v=>typeof v==='string'&&/^[^\s@,;<>]+@naver\.com$/i.test(v);
 if(!mailbox(user)||!mailbox(recipient)||!password||/[\r\n]/.test(password))throw new Error('Test SMTP configuration required');
 const client=transport||nodemailer.createTransport({host:'smtp.naver.com',port:465,secure:true,auth:{user,pass:password},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true});
 const report=error=>{
  const allowed=new Set(['EAUTH','ECONNECTION','ETIMEDOUT','ESOCKET','EENVELOPE','EMESSAGE']);
  const code=allowed.has(error?.code)?error.code:'OTHER';
  const responseCode=Number.isInteger(error?.responseCode)?error.responseCode:null;
  if(typeof onFailure==='function')onFailure({code,responseCode});
 };
 const sender=async ({to,kind,url})=>{
  let u;try{u=new URL(url)}catch{throw new Error('Invalid test mail');}
  if(typeof to!=='string'||to.toLowerCase()!==recipient.toLowerCase()||kind!=='verification'||u.origin!=='http://127.0.0.1:4323'||u.username||u.password||u.hash||u.pathname!=='/api/auth/verify-email'||!u.searchParams.get('token')||u.searchParams.getAll('token').length!==1||u.searchParams.getAll('callbackURL').length>1)throw new Error('Invalid test mail');
  const callback=u.searchParams.get('callbackURL');
  if(callback){const destination=new URL(callback,u.origin);if(destination.origin!=='http://127.0.0.1:4324'||destination.username||destination.password||destination.hash)throw new Error('Invalid test callback');}
  try{
   const r=await client.sendMail({from:user,to:recipient,subject:'[키츠노드 시험] 이메일 인증',text:'이 링크는 이 컴퓨터에서만 열 수 있는 시험용 인증 링크입니다.\n'+u.href});
   if(!Array.isArray(r.accepted)||!r.accepted.some(x=>String(x).toLowerCase()===recipient.toLowerCase())||(r.rejected||[]).length)throw new Error('Not accepted');
  }catch(error){
   // Do not log provider responses: they may contain credentials or addresses.
   report(error);
   throw new Error('Test mail delivery failed');
  }
 };
 sender.verify=async()=>{try{await client.verify()}catch(error){report(error);throw new Error('Test SMTP authentication failed')}};
 return sender;
}
