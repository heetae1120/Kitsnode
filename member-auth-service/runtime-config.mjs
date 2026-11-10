// Server-only configuration parser. Never log or return its errors alongside input.
// Explicit parameter names avoid inheriting secrets from Cloud Functions events.
export function parseRuntimeConfig(env) {
  const required = name => { const value=env?.[name]; if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing runtime setting: ${name}`); return value; };
  const authOrigin=required('MEMBER_AUTH_ORIGIN');
  const origins=required('MEMBER_FRONTEND_ORIGINS').split(',').map(s=>s.trim());
  const callbacks=required('MEMBER_CALLBACK_URLS').split(',').map(s=>s.trim());
  const exactOrigin=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.origin===value&&!u.username&&!u.password;}catch{return false;}};
  if (!exactOrigin(authOrigin) || !origins.length || !origins.every(exactOrigin)) throw new Error('Invalid origin configuration');
  for (const value of callbacks) { let u; try {u=new URL(value);} catch {throw new Error('Invalid callback configuration');} if (!origins.includes(u.origin)||u.username||u.password||u.search||u.hash) throw new Error('Invalid callback configuration'); }
  const secret=required('MEMBER_AUTH_SECRET'); if(secret.length<32) throw new Error('Invalid auth secret');
  const emailSetting = env?.MEMBER_EMAIL_ENABLED ?? '0';
  if (!['0','1'].includes(emailSetting)) throw new Error('Invalid email setting');
  const emailAvailable = emailSetting === '1';
  return {authOrigin,frontendOrigins:origins,callbackURLs:callbacks,secret,
    database:{connectionString:required('MEMBER_DATABASE_URL'),ca:required('MEMBER_DATABASE_CA')},
    documents:[{type:'terms',version:required('MEMBER_TERMS_VERSION'),text:required('MEMBER_TERMS_TEXT')},{type:'privacy',version:required('MEMBER_PRIVACY_VERSION'),text:required('MEMBER_PRIVACY_TEXT')}],
    naver:{clientId:required('NAVER_CLIENT_ID'),clientSecret:required('NAVER_CLIENT_SECRET')},
    emailAvailable,
    sens:emailAvailable ? {serviceId:required('SENS_SERVICE_ID'),accessKey:required('SENS_ACCESS_KEY'),secretKey:required('SENS_SECRET_KEY'),from:required('SENS_FROM')} : null};
}
