const key='kitsnode.naver.auth.intent';
const testKey='kitsnode.withdraw.test';
export function naverBoundaryEnabled(storage,flag,search='') {
 // A stale trial marker must not override the published production setting.
 if(flag!=='true')try{storage?.removeItem(testKey)}catch{}
 return flag==='true';
}
export function writeNaverIntent(storage,kind,now=Date.now()) {
 if(!storage||!['signin','signup'].includes(kind)||!Number.isSafeInteger(now))return false;
 try{storage.setItem(key,JSON.stringify({kind,at:now}));return true}catch{return false}
}
export function readNaverIntent(storage,now=Date.now()) {
 try{const v=JSON.parse(storage?.getItem(key)||'null');if(!v||!['signin','signup'].includes(v.kind)||!Number.isSafeInteger(v.at)||now<v.at||now-v.at>600000)return null;return v.kind}catch{return null}
}
export function clearNaverIntent(storage){try{storage?.removeItem(key)}catch{}}
// Missing, expired or malformed intent cannot turn a login into a signup.
// Accounts with earlier consent are handled separately by the caller.
export function requiresNaverSignupIntent(enabled,naverLinked,intent){return enabled===true&&naverLinked===true&&intent!=='signup'}
