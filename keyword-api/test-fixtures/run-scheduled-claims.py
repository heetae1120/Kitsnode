#!/usr/bin/env python3
"""Run isolated Postgres schedule-claim SQL and real concurrent claim checks."""
import concurrent.futures
import os
import subprocess
import tempfile
import time

with tempfile.TemporaryDirectory(prefix='kits-claim-db-', dir='/tmp') as temp:
    data = temp + '/data'
    subprocess.run(['initdb', '-D', data, '-A', 'trust', '--no-locale'], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(['pg_ctl', '-D', data, '-o', f"-k {temp} -p 55439 -c listen_addresses=''", '-l', temp + '/log', 'start'], check=True, stdout=subprocess.DEVNULL)
    try:
        env = {**os.environ, 'PGHOST': temp, 'PGPORT': '55439'}
        psql = ['psql', '-q', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1']
        subprocess.run([*psql, '-f', 'keyword-api/test-fixtures/scheduled-shadow-claims-db.sql'], env=env, check=True, stdout=subprocess.DEVNULL)
        subprocess.run([*psql, '-c', """insert into kitsnode_ads_private.shopping_shadow_rules(id,connection_id,campaign_id,adgroup_id,target_type,target_id,reference_bid,min_bid,max_bid,max_change,schedule)
          values('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cmp-1','grp-1','product','nad-concurrency',100,50,1000,100,jsonb_build_object('timezone','Asia/Seoul','slots',repeat('1',168)))"""], env=env, check=True)
        query = """select coalesce(public.kits_shadow_schedule_claim('33333333-3333-4333-8333-333333333333',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600))::text,'NULL')"""
        def do_claim():
            return subprocess.run([*psql, '-At', '-c', query], env=env, check=True, text=True, capture_output=True).stdout.strip()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: do_claim(), range(2)))
        assert sum('claimId' in result for result in results) == 1, results
        assert results.count('NULL') == 1, results
        subprocess.run([*psql, '-c', """insert into kitsnode_ads_private.shopping_shadow_rules(id,connection_id,campaign_id,adgroup_id,target_type,target_id,reference_bid,min_bid,max_bid,max_change,schedule)
          values('66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cmp-1','grp-1','product','nad-v2-concurrency',100,50,1000,100,jsonb_build_object('timezone','Asia/Seoul','slots',repeat('1',168)))"""], env=env, check=True)
        v2_query = """select public.kits_shadow_schedule_claim_v2('66666666-6666-4666-8666-666666666666',0,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1000*(floor(extract(epoch from statement_timestamp())/3600)::bigint*3600))::text"""
        def do_v2_claim():
            return subprocess.run([*psql, '-At', '-c', v2_query], env=env, check=True, text=True, capture_output=True).stdout.strip()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            v2_results = list(pool.map(lambda _: do_v2_claim(), range(2)))
        assert sum('"status": "claimed"' in result for result in v2_results) == 1, v2_results
        assert sum('"status": "in_progress"' in result for result in v2_results) == 1, v2_results
        # Historical recorded ledger rows should not force a full-ledger scan
        # for the hourly outstanding-state checks.
        subprocess.run([*psql, '-c', """insert into kitsnode_ads_private.shadow_schedule_claims(rule_id,rule_version,connection_id,connection_revision,slot_start,state,entry_id,finished_at)
          select rule_id,rule_version,connection_id,connection_revision,slot_start-(n*interval '1 hour'),state,entry_id,finished_at
          from kitsnode_ads_private.shadow_schedule_claims cross join generate_series(1,10000) n
          where rule_id='44444444-4444-4444-8444-444444444444';
          analyze kitsnode_ads_private.shadow_schedule_claims"""], env=env, check=True)
        plans = [
            ("select count(*) from kitsnode_ads_private.shadow_schedule_claims a where a.state='claimed' and a.created_at < statement_timestamp()-interval '10 minutes'", 'shadow_schedule_claims_stale_idx'),
            ("select count(*) from kitsnode_ads_private.shadow_schedule_claims a where a.state='uncertain'", 'shadow_schedule_claims_uncertain_idx'),
            ("select count(*) from kitsnode_ads_private.shadow_schedule_claims a where a.state='skipped' and a.reason not in ('hour_expired','authorization_changed')", 'shadow_schedule_claims_unexpected_skip_idx'),
        ]
        for check_query, expected_index in plans:
            plan = subprocess.run([*psql, '-At', '-c', 'explain '+check_query], env=env, check=True, text=True, capture_output=True).stdout
            assert expected_index in plan, plan
        # A review must block on a concurrently finishing claim, then reject
        # the stale expected state rather than acknowledge the new state.
        subprocess.run([*psql, '-c', """update kitsnode_ads_private.shadow_schedule_claims set created_at=now()-interval '11 minutes'
          where rule_id='66666666-6666-4666-8666-666666666666'"""], env=env, check=True)
        review_locker = subprocess.Popen([*psql, '-At'], env=env, text=True, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=1)
        try:
            review_locker.stdin.write("begin; update kitsnode_ads_private.shadow_schedule_claims set state='uncertain',reason='invalid_simulation_result',finished_at=now() where rule_id='66666666-6666-4666-8666-666666666666' returning 'locked';\n")
            review_locker.stdin.flush()
            assert review_locker.stdout.readline().strip() == 'locked', 'claim row lock not acquired'
            def race_review():
                return subprocess.run([*psql, '-At', '-c', """select public.kits_shadow_claim_review_record(id,'claimed','11111111-1111-4111-8111-111111111111','CASE-RACE') from kitsnode_ads_private.shadow_schedule_claims where rule_id='66666666-6666-4666-8666-666666666666'"""], env=env, check=True, text=True, capture_output=True).stdout.strip()
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                pending_review=pool.submit(race_review)
                time.sleep(0.3)
                assert not pending_review.done(), 'review did not wait for row lock'
                review_locker.stdin.write('commit;\n');review_locker.stdin.flush()
                assert pending_review.result(timeout=5)=='f', 'review accepted changed claim state'
            review_locker.stdin.close()
            assert review_locker.wait(timeout=5)==0, review_locker.stderr.read()
        finally:
            if review_locker.poll() is None:
                review_locker.kill();review_locker.wait()
        # The append transaction holds the exact auth user row via the private
        # security-definer helper; a concurrent ban must wait until it commits.
        locker = subprocess.Popen([*psql, '-At'], env=env, text=True, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=1)
        try:
            locker.stdin.write("begin; set role service_role; select kitsnode_ads_private.shadow_account_active_locked('11111111-1111-4111-8111-111111111111');\n")
            locker.stdin.flush()
            assert locker.stdout.readline().strip() == 't', 'account row lock not acquired'
            def ban_user():
                return subprocess.run([*psql, '-c', "update auth.users set banned_until=now()+interval '1 hour' where id='11111111-1111-4111-8111-111111111111'"], env=env, check=True, stdout=subprocess.DEVNULL)
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                pending = pool.submit(ban_user)
                time.sleep(0.3)
                assert not pending.done(), 'ban update did not wait for account lock'
                locker.stdin.write('commit;\n')
                locker.stdin.flush()
                pending.result(timeout=5)
            locker.stdin.close()
            assert locker.wait(timeout=5) == 0, locker.stderr.read()
        finally:
            if locker.poll() is None:
                locker.kill()
                locker.wait()
        print('Postgres scheduled claims, auth-row lock, authorization changes, idempotency, and concurrent duplicate checks passed')
    finally:
        subprocess.run(['pg_ctl', '-D', data, '-m', 'fast', 'stop'], stdout=subprocess.DEVNULL, check=True)
