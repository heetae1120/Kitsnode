let userId = 'test-user';
export function setManualSession(value: string){userId=value;}
export function memberBrowserClient(){return {auth:{getSession:async()=>({data:{session:{user:{id:userId},access_token:userId==='test-user'?'fixture.token':'other.token'}}})}};}
