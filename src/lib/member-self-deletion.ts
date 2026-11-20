export type MemberDeletionResult = 'deleted' | 'blocked' | 'needs_review' | 'uncertain';
type Session = {access_token:string; user:{id:string}} | null;
type GetSession = () => Promise<{data:{session:Session};error:unknown}>;

// The account ID is checked locally and is never sent in the request body.
export async function deleteCurrentMember({url,key,userId,getSession,request=fetch,timeoutMs=10000}:{url:string;key:string;userId:string;getSession:GetSession;request?:typeof fetch;timeoutMs?:number}):Promise<MemberDeletionResult> {
  let origin:URL;
  try { origin=new URL(url); } catch { return 'blocked'; }
  if (origin.protocol !== 'https:' || !/^[a-z0-9]{20}\.supabase\.co$/.test(origin.hostname) || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password || origin.port || !key || !userId) return 'blocked';
  const endpoint=new URL('/functions/v1/kitsnode-member-delete',origin);
  const session=async()=>{
    const {data,error}=await getSession();
    return !error && data.session?.user.id===userId && data.session.access_token ? data.session.access_token : null;
  };
  const timedFetch=async (token:string,method:'GET'|'POST')=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try { return await request(endpoint,{method,headers:{Authorization:`Bearer ${token}`,apikey:key,...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:JSON.stringify({confirm:'회원탈퇴'})}:{}),cache:'no-store',credentials:'omit',signal:controller.signal}); }
    finally {clearTimeout(timer);}
  };
  let token:string|null;
  try {
    token=await session();
    if (!token) return 'blocked';
    const capability=await timedFetch(token,'GET');
    if (!capability.ok || (await capability.json())?.available !== true) return 'blocked';
    token=await session();
    if (!token) return 'blocked';
  } catch {return 'blocked';}
  try {
    const response=await timedFetch(token,'POST');
    if (response.ok && (await response.json())?.deleted === true) return 'deleted';
    if (response.status === 409) return (await response.json())?.error === 'deletion_blocked' ? 'needs_review' : 'uncertain';
    if ([400,401].includes(response.status)) return 'blocked';
    return 'uncertain';
  } catch {return 'uncertain';}
}
