import {randomInt} from 'node:crypto';

// No endpoint, credentials, or production pool are accepted from environment.
// The caller must explicitly attest isolation, and both role and DB must carry
// a dedicated probe prefix. This is defense in depth, not proof of isolation.
export async function probeIsolatedHyperdrive({pool, isolationConfirmed, expectedDatabase, expectedRole, concurrency=6, acquireTimeoutMs=1200}) {
  const label=/^kitsnode_probe_[a-z0-9_]{1,40}$/;
  if (isolationConfirmed !== true || !pool?.connect || !label.test(expectedDatabase || '') || !label.test(expectedRole || '') || !Number.isInteger(concurrency) || concurrency<2 || concurrency>6 || !Number.isInteger(acquireTimeoutMs) || acquireTimeoutMs<100 || acquireTimeoutMs>5000) throw new Error('Isolated probe configuration required');
  const verify=async client=>{
    const r=await client.query('SELECT current_database() AS database, current_user AS role');
    if(r.rows?.length!==1 || r.rows[0].database!==expectedDatabase || r.rows[0].role!==expectedRole) throw new Error('Isolated database identity mismatch');
  };
  // A late-acquired connection must still be released after an acquisition timeout.
  const acquire=async()=>{
    let expired=false,timer;
    const pending=Promise.resolve().then(()=>pool.connect()).then(client=>{if(expired){client.release();return null;}return client;});
    const timeout=new Promise(resolve=>{timer=setTimeout(()=>{expired=true;resolve(null)},acquireTimeoutMs)});
    try{return await Promise.race([pending,timeout]);} finally {clearTimeout(timer);}
  };
  const first=await acquire(); if(!first) throw new Error('First connection timed out');
  let second;
  const key=randomInt(1,2147483647), namespace=1263092820;
  let firstTx=false, secondTx=false;
  try {
    await verify(first);
    second=await acquire(); if(!second) throw new Error('Second connection timed out');
    await verify(second);
    await first.query('BEGIN');firstTx=true;
    await first.query("SET LOCAL statement_timeout = '3000ms'");
    await first.query('SELECT pg_advisory_xact_lock($1::int, $2::int)',[namespace,key]);
    await second.query('BEGIN');secondTx=true;
    await second.query("SET LOCAL statement_timeout = '3000ms'");
    const held=await second.query('SELECT pg_try_advisory_xact_lock($1::int, $2::int) AS acquired',[namespace,key]);
    if(held.rows?.[0]?.acquired!==false) throw new Error('Concurrent lock was not excluded');
    await first.query('COMMIT');firstTx=false;
    const afterCommit=await second.query('SELECT pg_try_advisory_xact_lock($1::int, $2::int) AS acquired',[namespace,key]);
    if(afterCommit.rows?.[0]?.acquired!==true) throw new Error('Commit did not release lock');
    await second.query('ROLLBACK');secondTx=false;
    await first.query('BEGIN');firstTx=true;
    const afterRollback=await first.query('SELECT pg_try_advisory_xact_lock($1::int, $2::int) AS acquired',[namespace,key]);
    if(afterRollback.rows?.[0]?.acquired!==true) throw new Error('Rollback did not release lock');
    await first.query('ROLLBACK');firstTx=false;
  } finally {
    if(secondTx) await second.query('ROLLBACK').catch(()=>{});
    if(firstTx) await first.query('ROLLBACK').catch(()=>{});
    if(second) second.release();first.release();
  }
  // Hold acquired connections briefly together: the result describes only this
  // isolated pool and timeout, not the capacity of production Hyperdrive.
  const start=Date.now();
  const settled=await Promise.allSettled(Array.from({length:concurrency},async()=>{
    const client=await acquire();
    if(!client)return null;
    try {await verify(client);return client;} catch(e){client.release();throw e;}
  }));
  const acquired=settled.filter(x=>x.status==='fulfilled').map(x=>x.value);
  const count=acquired.filter(Boolean).length;
  for(const client of acquired) if(client) client.release();
  const failure=settled.find(x=>x.status==='rejected'); if(failure) throw failure.reason;
  return {lockExcluded:true,commitReleased:true,rollbackReleased:true,requested:concurrency,acquired:count,timedOut:concurrency-count,elapsedMs:Date.now()-start};
}
