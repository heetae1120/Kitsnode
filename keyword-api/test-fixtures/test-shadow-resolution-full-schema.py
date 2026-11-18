#!/usr/bin/env python3
"""Compose the local resolution candidate with the actual scheduled DB RPCs."""
import json
import os
import base64
import hashlib
import subprocess
import tempfile
import uuid

with tempfile.TemporaryDirectory(prefix='kits-resolution-full-',dir='/tmp') as temp:
    data=temp+'/data'
    subprocess.run(['initdb','-D',data,'-A','trust','--no-locale'],check=True,stdout=subprocess.DEVNULL)
    subprocess.run(['pg_ctl','-D',data,'-o',f"-k {temp} -p 55452 -c listen_addresses=''",'-l',temp+'/log','start'],check=True,stdout=subprocess.DEVNULL)
    try:
        env={**os.environ,'PGHOST':temp,'PGPORT':'55452'}
        cmd=['psql','-q','-X','-d','postgres','-v','ON_ERROR_STOP=1','-At']
        def run(sql,fail=False):
            p=subprocess.run([*cmd,'-c',sql],env=env,text=True,capture_output=True)
            if fail: assert p.returncode != 0, 'unexpected success'
            else: assert p.returncode==0,p.stderr
            return p.stdout.strip()
        subprocess.run([*cmd,'-f','keyword-api/test-fixtures/scheduled-shadow-claims-db.sql'],env=env,check=True,stdout=subprocess.DEVNULL)
        run("create role kits_claim_resolver; create role kits_evidence_registrar; grant usage on schema kitsnode_ads_private to kits_claim_resolver,kits_evidence_registrar; create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz)")
        subprocess.run([*cmd,'-f','keyword-api/test-fixtures/shadow-claim-resolution-candidate.sql'],env=env,check=True,stdout=subprocess.DEVNULL)
        operator='11111111-1111-4111-8111-111111111111';session='22222222-2222-4222-8222-222222222222';conn='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        rule=str(uuid.uuid4());nonce=str(uuid.uuid4());spki=base64.b64encode(bytes.fromhex('302a300506032b6570032100')+bytes(32)).decode();fp=hashlib.sha256(base64.b64decode(spki)).hexdigest();ev=hashlib.sha256(b'test-evidence').hexdigest();digest='c'*64;signature='A'*86
        run(f"""insert into kitsnode_ads_private.shopping_shadow_rules(id,connection_id,campaign_id,adgroup_id,target_type,target_id,reference_bid,min_bid,max_bid,max_change,schedule)
          values('{rule}','{conn}','cmp-1','grp-1','product','nad-resolution-full',100,50,1000,100,jsonb_build_object('timezone','Asia/Seoul','slots',repeat('1',168)))""")
        slot=run("select 1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600)")
        claim=json.loads(run(f"select public.kits_shadow_schedule_claim('{rule}',0,'{conn}',{slot})"))['claimId']
        run(f"update kitsnode_ads_private.shadow_schedule_claims set created_at=now()-interval '11 minutes' where id='{claim}'")
        run(f"set role kits_evidence_registrar; select kitsnode_ads_private.register_resolution_evidence_candidate('{claim}','CASE-FULL',decode('746573742d65766964656e6365','hex'))")
        baseline=json.loads(run('set role service_role; select public.kits_shadow_schedule_unresolved()'))
        run(f"insert into auth.sessions values('{session}','{operator}',null); insert into kitsnode_ads_private.shadow_resolution_operators_candidate values('{operator}',true)")
        run(f"insert into kitsnode_ads_private.shadow_resolution_keys_candidate values('{operator}','key-1','{fp}',true,'{spki}')")
        assert run(f"set role kits_claim_resolver; select kitsnode_ads_private.issue_resolution_challenge_candidate('{nonce}','{operator}','{session}','key-1','{fp}','{claim}','claimed','CASE-FULL','{ev}','{digest}',now(),now()+interval '4 minutes')")=='t'
        assert run(f"set role kits_claim_resolver; select kitsnode_ads_private.resolve_shadow_claim_candidate('{nonce}','{claim}','claimed','{operator}','key-1','{fp}','CASE-FULL','{ev}','{digest}','{signature}')")=='t'
        after=json.loads(run('set role service_role; select public.kits_shadow_schedule_unresolved()'))
        assert after['staleClaimed']==baseline['staleClaimed']-1,(baseline,after)
        result=json.loads(run(f"set role service_role; select public.kits_shadow_schedule_claim_v2('{rule}',0,'{conn}',{slot})"))
        assert result=={'status':'already_resolved'},result
        original=run(f"select state||':'||coalesce(entry_id::text,'none') from kitsnode_ads_private.shadow_schedule_claims where id='{claim}'")
        assert original=='claimed:none',original
        # Actual scheduled append must fail as one transaction after fencing:
        # any inserted history is rolled back together with the claim update.
        count=int(run(f"select count(*) from kitsnode_ads_private.shopping_shadow_history where rule_id='{rule}'"))
        run(f"set role service_role; select public.kits_shadow_schedule_append('{claim}','{rule}',0,'{conn}',{slot},'{operator}',1,'{{\"status\":\"shadow_only\",\"execution\":\"disabled\"}}')",fail=True)
        assert int(run(f"select count(*) from kitsnode_ads_private.shopping_shadow_history where rule_id='{rule}'"))==count
        print('actual scheduled RPCs: resolution decreases alarm aggregate, same slot stays fenced, late append rolls back')
    finally:
        subprocess.run(['pg_ctl','-D',data,'-m','fast','stop'],check=True,stdout=subprocess.DEVNULL)
