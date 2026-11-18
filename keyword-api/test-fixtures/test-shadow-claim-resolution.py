#!/usr/bin/env python3
"""Isolated PostgreSQL proof of claim fencing; no remote DB or ad calls."""
import concurrent.futures
import os
import base64
import hashlib
import subprocess
import tempfile
import time
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
SQL = os.path.join(HERE, 'shadow-claim-resolution-candidate.sql')
operator = '11111111-1111-4111-8111-111111111111'
spki=base64.b64encode(bytes.fromhex('302a300506032b6570032100')+bytes(32)).decode()
fp=hashlib.sha256(base64.b64decode(spki)).hexdigest()
digest, evidence, signature = 'b'*64, hashlib.sha256(b'test-evidence').hexdigest(), 'A'*86

with tempfile.TemporaryDirectory(prefix='kits-resolution-', dir='/tmp') as temp:
    data = temp + '/data'
    subprocess.run(['initdb', '-D', data, '-A', 'trust', '--no-locale'], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(['pg_ctl', '-D', data, '-o', f"-k {temp} -p 55451 -c listen_addresses=''", '-l', temp+'/log', 'start'], check=True, stdout=subprocess.DEVNULL)
    try:
        env = {**os.environ, 'PGHOST':temp, 'PGPORT':'55451'}
        cmd = ['psql','-q','-X','-d','postgres','-v','ON_ERROR_STOP=1','-At']
        def run(sql, *, fail=False):
            p = subprocess.run([*cmd,'-c',sql], env=env, text=True, capture_output=True)
            if fail:
                assert p.returncode != 0, 'operation unexpectedly succeeded'
            else:
                assert p.returncode == 0, p.stderr
            return p.stdout.strip()
        run("""create role anon; create role authenticated; create role service_role; create role kits_claim_resolver; create role kits_evidence_registrar;
            create schema auth; create table auth.users(id uuid primary key,confirmed_at timestamptz,is_anonymous boolean,deleted_at timestamptz,banned_until timestamptz); create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz); create schema kitsnode_ads_private; grant usage on schema kitsnode_ads_private to service_role,kits_claim_resolver,kits_evidence_registrar;
            create table kitsnode_ads_private.shadow_schedule_claims(id uuid primary key,state text not null,reason text,created_at timestamptz not null,finished_at timestamptz);
            create table kitsnode_ads_private.history(id uuid primary key,claim_id uuid references kitsnode_ads_private.shadow_schedule_claims(id));
            grant select,update on kitsnode_ads_private.shadow_schedule_claims to service_role;
            grant select,insert on kitsnode_ads_private.history to service_role;""")
        subprocess.run([*cmd,'-f',SQL],env=env,check=True,stdout=subprocess.DEVNULL)
        session='22222222-2222-4222-8222-222222222222'
        run(f"insert into auth.users values('{operator}',now(),false,null,null); insert into auth.sessions values('{session}','{operator}',null); insert into kitsnode_ads_private.shadow_resolution_operators_candidate values('{operator}',true)")
        run(f"insert into kitsnode_ads_private.shadow_resolution_keys_candidate values('{operator}','key-1','{fp}',true,'{spki}')")
        def seed(state='claimed', reason=None, stale=True):
            claim = str(uuid.uuid4())
            reason_sql = 'NULL' if reason is None else "'"+reason+"'"
            age = "now()-interval '11 minutes'" if stale else 'now()'
            run(f"insert into kitsnode_ads_private.shadow_schedule_claims values('{claim}','{state}',{reason_sql},{age},NULL)")
            run(f"set role kits_evidence_registrar; select kitsnode_ads_private.register_resolution_evidence_candidate('{claim}','CASE-123',decode('746573742d65766964656e6365','hex'))")
            return claim
        def issue(claim,expected='claimed',key=None,fingerprint=fp,expires="now()+interval '4 minutes'"):
            key=key or ('key-2' if run("select count(*) from kitsnode_ads_private.shadow_resolution_keys_candidate where key_id='key-2'")=='1' else 'key-1')
            nonce=str(uuid.uuid4())
            out=run(f"set role kits_claim_resolver; select kitsnode_ads_private.issue_resolution_challenge_candidate('{nonce}','{operator}','{session}','{key}','{fingerprint}','{claim}','{expected}','CASE-123','{evidence}','{digest}',now(),{expires})")
            return nonce,out
        def resolve(nonce,claim,expected='claimed',who=operator,key=None,fingerprint=fp,case='CASE-123',ev=evidence,dig=digest):
            key=key or ('key-2' if run("select count(*) from kitsnode_ads_private.shadow_resolution_keys_candidate where key_id='key-2'")=='1' else 'key-1')
            return run(f"set role kits_claim_resolver; select kitsnode_ads_private.resolve_shadow_claim_candidate('{nonce}','{claim}','{expected}','{who}','{key}','{fingerprint}','{case}','{ev}','{dig}','{signature}')")
        fresh=seed(stale=False); nonce,created=issue(fresh); assert created=='t' and resolve(nonce,fresh)=='f'
        claim=seed(); nonce,created=issue(claim); assert created=='t'
        assert resolve(nonce,claim,ev='d'*64)=='f' # evidence is bound
        assert resolve(nonce,claim,who='22222222-2222-4222-8222-222222222222')=='f'
        run(f"set role service_role; select kitsnode_ads_private.resolve_shadow_claim_candidate('{nonce}','{claim}','claimed','{operator}','key-1','{fp}','CASE-123','{evidence}','{digest}','{signature}')",fail=True)
        run(f"set role kits_claim_resolver; insert into kitsnode_ads_private.shadow_claim_resolutions_candidate(claim_id) values('{claim}')",fail=True)
        assert resolve(nonce,claim)=='t' and resolve(nonce,claim)=='f' # exactly once
        # A late scheduled INSERT followed by UPDATE is a single transaction;
        # fencing aborts the whole transaction, including inserted history.
        h=str(uuid.uuid4())
        run(f"begin; set role service_role; insert into kitsnode_ads_private.history values('{h}','{claim}'); update kitsnode_ads_private.shadow_schedule_claims set state='recorded' where id='{claim}'; commit",fail=True)
        assert run(f"select count(*) from kitsnode_ads_private.history where claim_id='{claim}'")=='0'
        assert run(f"select state from kitsnode_ads_private.shadow_schedule_claims where id='{claim}'")=='claimed'
        # Revocation between issuance and completion invalidates the proof.
        revoked=seed(); revoked_nonce,created=issue(revoked); assert created=='t'
        run(f"update kitsnode_ads_private.shadow_resolution_keys_candidate set active=false where operator_id='{operator}' and key_id='key-1'")
        assert resolve(revoked_nonce,revoked)=='f'
        run(f"update kitsnode_ads_private.shadow_resolution_keys_candidate set active=true where operator_id='{operator}' and key_id='key-1'",fail=True)
        run(f"insert into kitsnode_ads_private.shadow_resolution_keys_candidate values('{operator}','key-2','{fp}',true,'{spki}')")
        expired=seed(); _,created=issue(expired,expires="now()-interval '1 second'"); assert created=='f'
        # A writer holding the claim lock wins. The resolver waits, sees the
        # now-recorded state, and refuses to create a contradictory resolution.
        racing=seed(); racing_nonce,created=issue(racing); assert created=='t'
        proc=subprocess.Popen(cmd,env=env,text=True,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=1)
        try:
            proc.stdin.write(f"begin; update kitsnode_ads_private.shadow_schedule_claims set state='recorded' where id='{racing}' returning 'locked';\n");proc.stdin.flush()
            assert proc.stdout.readline().strip()=='locked'
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                pending=pool.submit(resolve,racing_nonce,racing)
                time.sleep(.3); assert not pending.done()
                proc.stdin.write('commit;\n');proc.stdin.flush()
                assert pending.result(timeout=5)=='f'
            proc.stdin.close(); assert proc.wait(timeout=5)==0
        finally:
            if proc.poll() is None: proc.kill();proc.wait()
        assert run(f"select count(*) from kitsnode_ads_private.shadow_claim_resolutions_candidate where claim_id='{racing}'")=='0'
        # The opposite order must fence the writer atomically; the would-be
        # history insert is rolled back when the eventual claim update fails.
        fenced=seed(); fenced_nonce,created=issue(fenced); assert created=='t'
        proc=subprocess.Popen(cmd,env=env,text=True,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=1)
        try:
            proc.stdin.write(f"begin; select id from kitsnode_ads_private.shadow_schedule_claims where id='{fenced}' for update;\n");proc.stdin.flush()
            assert proc.stdout.readline().strip()==fenced
            hist=str(uuid.uuid4())
            def delayed_writer():
                return subprocess.run([*cmd,'-c',f"begin; set role service_role; insert into kitsnode_ads_private.history values('{hist}','{fenced}'); update kitsnode_ads_private.shadow_schedule_claims set state='recorded' where id='{fenced}'; commit"],env=env,text=True,capture_output=True)
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                pending=pool.submit(delayed_writer)
                time.sleep(.3); assert not pending.done()
                proc.stdin.write(f"set role kits_claim_resolver; select kitsnode_ads_private.resolve_shadow_claim_candidate('{fenced_nonce}','{fenced}','claimed','{operator}','key-2','{fp}','CASE-123','{evidence}','{digest}','{signature}');\n")
                proc.stdin.flush(); assert proc.stdout.readline().strip()=='t'
                proc.stdin.write('commit;\n');proc.stdin.flush()
                assert pending.result(timeout=5).returncode != 0
            proc.stdin.close(); assert proc.wait(timeout=5)==0
        finally:
            if proc.poll() is None: proc.kill();proc.wait()
        assert run(f"select count(*) from kitsnode_ads_private.history where claim_id='{fenced}'")=='0'
        # A key revocation that commits before consumption wins. The verifier
        # waits for registry row lock, then must reject without consuming nonce.
        revoke_race=seed(); revoke_nonce,created=issue(revoke_race); assert created=='t'
        proc=subprocess.Popen(cmd,env=env,text=True,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,bufsize=1)
        try:
            proc.stdin.write(f"begin; update kitsnode_ads_private.shadow_resolution_keys_candidate set active=false where operator_id='{operator}' and key_id='key-2' returning 'locked';\n");proc.stdin.flush()
            assert proc.stdout.readline().strip()=='locked'
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                pending=pool.submit(resolve,revoke_nonce,revoke_race)
                time.sleep(.3); assert not pending.done()
                proc.stdin.write('commit;\n');proc.stdin.flush()
                assert pending.result(timeout=5)=='f'
            proc.stdin.close(); assert proc.wait(timeout=5)==0
        finally:
            if proc.poll() is None: proc.kill();proc.wait()
        assert run(f"select consumed_at is null from kitsnode_ads_private.shadow_resolution_challenges_candidate where id='{revoke_nonce}'")=='t'
        print('claim resolution proof: signatures bound, nonce once, revocation, late write rollback and concurrent state race passed')
    finally:
        subprocess.run(['pg_ctl','-D',data,'-m','fast','stop'],check=True,stdout=subprocess.DEVNULL)
