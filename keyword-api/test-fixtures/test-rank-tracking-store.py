#!/usr/bin/env python3
"""Synthetic only, isolated ephemeral Postgres; no remote service or keys."""
import concurrent.futures,os,subprocess,tempfile
with tempfile.TemporaryDirectory(prefix='kits-rank-store-',dir='/tmp') as temp:
 data=temp+'/data'
 subprocess.run(['initdb','-D',data,'-A','trust','--no-locale'],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['pg_ctl','-D',data,'-o',f"-k {temp} -p 55467 -c listen_addresses=''",'-l',temp+'/log','start'],check=True,stdout=subprocess.DEVNULL)
 try:
  env={**os.environ,'PGHOST':temp,'PGPORT':'55467'};cmd=['psql','-X','-v','ON_ERROR_STOP=1','-d','postgres','-q','-At']
  subprocess.run([*cmd,'-f','keyword-api/test-fixtures/rank-tracking-store-candidate.sql'],env=env,check=True)
  u='11111111-1111-4111-8111-111111111111';c='22222222-2222-4222-8222-222222222222';t='33333333-3333-4333-8333-333333333333';q='44444444-4444-4444-8444-444444444444'
  def sql(qry):return subprocess.run([*cmd,'-c',qry],env=env,check=True,capture_output=True,text=True).stdout.strip()
  obj='{"mode":"simulation","id":"'+t+'"}'
  sql(f"insert into rank_tracking_test.trackings(tracking_id,user_id,connection_id,target_id,tracking) values('{t}','{u}','{c}','nad-demo','{obj}'::jsonb)")
  query=f"select rank_tracking_test.commit_observation('{u}','{c}','nad-demo','{t}','{q}',0,'{obj}'::jsonb)"
  with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex: results=list(ex.map(lambda _:sql(query),range(2)))
  assert sorted(results)==['duplicate','saved'],results
  assert sql(f"select version from rank_tracking_test.trackings where tracking_id='{t}'")=='1'
  assert sql(f"select count(*) from rank_tracking_test.requests where tracking_id='{t}'")=='1'
  assert sql(f"select rank_tracking_test.commit_observation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{c}','nad-demo','{t}','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'{obj}'::jsonb)")=='not_found'
  assert sql(f"select rank_tracking_test.commit_observation('{u}','{c}','nad-other','{t}','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'{obj}'::jsonb)")=='not_found'
  assert sql(f"select rank_tracking_test.commit_observation('{u}','{c}','nad-demo','{t}','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{obj}'::jsonb)")=='conflict'
  print('isolated rank storage ownership, version CAS, concurrent idempotency passed')
  subprocess.run(['node','keyword-api/test-fixtures/rank-tracking-postgres-integration.mjs'],env=env,check=True)
 finally:subprocess.run(['pg_ctl','-D',data,'-m','fast','stop'],check=True,stdout=subprocess.DEVNULL)
