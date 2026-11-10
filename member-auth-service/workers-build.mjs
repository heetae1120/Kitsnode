import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Explicit public origin prevents accidentally shipping the former test URL.
export function workersBuildEnvironment(env) {
  const value=env.WORKERS_FRONTEND_ORIGIN;
  let url;
  try { url=new URL(value); } catch { throw new Error('WORKERS_FRONTEND_ORIGIN must be the final HTTPS workers.dev origin'); }
  if (url.protocol!=='https:' || url.origin!==value || url.username || url.password || url.port || !/^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*\.workers\.dev$/.test(url.hostname)) throw new Error('WORKERS_FRONTEND_ORIGIN must be the final HTTPS workers.dev origin');
  if (env.PAGES_BASE_PATH) throw new Error('PAGES_BASE_PATH must be empty for the Workers root deployment');
  if (env.NEXT_PUBLIC_MEMBER_AUTH_URL && env.NEXT_PUBLIC_MEMBER_AUTH_URL!==value) throw new Error('Frontend and auth origins must match');
  return {...env,PAGES_BASE_PATH:'',NEXT_PUBLIC_MEMBER_AUTH_URL:value};
}

if (process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  try {
    const env=workersBuildEnvironment(process.env);
    const result=spawnSync('npm',['run','build'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env,stdio:'inherit'});
    if (result.error) throw result.error;
    process.exitCode=result.status ?? 1;
  } catch (error) { console.error(error.message); process.exitCode=1; }
}
