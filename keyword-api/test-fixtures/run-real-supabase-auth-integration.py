#!/usr/bin/env python3
"""Temporary local PG + real Auth test; service key is read only from stdin."""
import os, subprocess, sys, tempfile
key=sys.stdin.read().strip()
if not key: raise SystemExit('missing secret input')
with tempfile.TemporaryDirectory(prefix='kits-real-auth-integration-',dir='/tmp') as temp:
    data=temp+'/data'
    subprocess.run(['initdb','-D',data,'-A','trust','--no-locale'],check=True,stdout=subprocess.DEVNULL)
    subprocess.run(['pg_ctl','-D',data,'-o',f"-k {temp} -p 55459 -c listen_addresses=''",'-l',temp+'/log','start'],check=True,stdout=subprocess.DEVNULL)
    try:
        env={**os.environ,'PGHOST':temp,'PGPORT':'55459'}
        cmd=['psql','-q','-X','-d','postgres','-v','ON_ERROR_STOP=1']
        subprocess.run([*cmd,'-c',"""create role anon; create role authenticated; create role service_role; create role kits_claim_resolver; create role kits_evidence_registrar;
          create schema auth; create table auth.users(id uuid primary key,confirmed_at timestamptz,is_anonymous boolean,deleted_at timestamptz,banned_until timestamptz); create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
          create schema kitsnode_ads_private; grant usage on schema kitsnode_ads_private to service_role,kits_claim_resolver,kits_evidence_registrar;
          create table kitsnode_ads_private.shadow_schedule_claims(id uuid primary key,state text not null,reason text,created_at timestamptz not null,finished_at timestamptz);
          grant select,update on kitsnode_ads_private.shadow_schedule_claims to service_role;"""],env=env,check=True,stdout=subprocess.DEVNULL)
        subprocess.run([*cmd,'-f','keyword-api/test-fixtures/shadow-claim-resolution-candidate.sql'],env=env,check=True,stdout=subprocess.DEVNULL)
        subprocess.run(['node','keyword-api/test-fixtures/test-real-supabase-auth-integration.mjs'],input=key,text=True,env=env,check=True)
    finally:
        subprocess.run(['pg_ctl','-D',data,'-m','fast','stop'],check=True,stdout=subprocess.DEVNULL)
