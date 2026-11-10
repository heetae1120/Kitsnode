// Node.js Cloud Functions entrypoint. Disabled by default; environment config
// is supplied only by the hosting platform, never by incoming event fields.
let runtimePromise;
exports.main = async function main(event) {
  const unavailable=()=>({statusCode:503,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify({error:'staging_not_enabled'})});
  if (process.env.MEMBER_AUTH_STAGING_ENABLED !== '1') return unavailable();
  try {
    if (!runtimePromise) runtimePromise=import('./cloud-functions-runtime.mjs').then(({createCloudFunctionsRuntime})=>createCloudFunctionsRuntime(process.env)).catch(error=>{runtimePromise=undefined;throw error;});
    return await (await runtimePromise).action(event);
  } catch { return unavailable(); }
};
