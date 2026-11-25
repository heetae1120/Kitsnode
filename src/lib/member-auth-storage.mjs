// Supabase persists first-party sessions so that sign-in works across refreshes
// and tabs. Provider access/refresh tokens must remain transient: they are only
// needed during the initial OAuth callback and must never be copied to storage.
function redact(value){
 try{
  const parsed=JSON.parse(value);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return value;
  if(!Object.prototype.hasOwnProperty.call(parsed,'provider_token')&&!Object.prototype.hasOwnProperty.call(parsed,'provider_refresh_token'))return value;
  delete parsed.provider_token;delete parsed.provider_refresh_token;
  return JSON.stringify(parsed);
 }catch{
  // A malformed would-be session that mentions provider tokens must not be
  // written back to storage or returned unsanitized.
  return /provider_(?:refresh_)?token/.test(value)?null:value;
 }
}
export function createProviderRedactingStorage(storage,sessionKey){
 if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'||typeof storage.removeItem!=='function'||typeof sessionKey!=='string'||!sessionKey)throw TypeError('invalid_storage');
 return Object.freeze({
  getItem(key){
   const value=storage.getItem(key);if(value===null||key!==sessionKey)return value;
   const clean=redact(value);if(clean!==value){try{if(clean===null)storage.removeItem(key);else storage.setItem(key,clean)}catch{try{storage.removeItem(key)}catch{throw Error('storage_unavailable')}return null}}
   return clean;
  },
  setItem(key,value){
   if(key!==sessionKey)return storage.setItem(key,value);
   const clean=redact(String(value));if(clean===null){storage.removeItem(key);return}
   return storage.setItem(key,clean);
  },
  removeItem(key){return storage.removeItem(key)}
 });
}
