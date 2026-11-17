-- Staging candidate only. No remote apply; service-role-only API boundary.
-- This migration defaults the execution capability to false. Read-only access
-- through a shared Naver key does not prove the member owns an ad account.
create schema if not exists kitsnode_ads_private;
revoke all on schema kitsnode_ads_private from public, anon, authenticated;
grant usage on schema kitsnode_ads_private to service_role;

create table kitsnode_ads_private.connections (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  ad_account_id text not null check (ad_account_id ~ '^[1-9][0-9]{0,15}$'),
  customer_id text check (customer_id ~ '^[1-9][0-9]{0,15}$'),
  status text not null default 'pending_review' check (status in ('pending_review','read_connected','disconnected')),
  naver_role text check (naver_role in ('OWNER','MASTER','READ_ONLY')),
  write_verified boolean not null default false,
  revision bigint not null default 0 check (revision >= 0),
  approved_by uuid, evidence_ref text check (length(evidence_ref) between 1 and 128),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (status <> 'read_connected' or (customer_id is not null and naver_role is not null and approved_by is not null and evidence_ref is not null)),
  check (not write_verified or (status = 'read_connected' and naver_role in ('OWNER','MASTER')))
);
-- Pending claims are scoped to the requester; only approval reserves an account.
create unique index kitsnode_ads_one_pending_per_user on kitsnode_ads_private.connections(user_id,ad_account_id) where status = 'pending_review';
create unique index kitsnode_ads_one_approved_account on kitsnode_ads_private.connections(ad_account_id) where status = 'read_connected';
-- A human reviewer records an out-of-band verification reference, not raw
-- personal documents. This records an attestation, not automated proof.
create table kitsnode_ads_private.ownership_evidence (
 id uuid primary key, connection_id uuid not null references kitsnode_ads_private.connections(id),
 user_id uuid not null, ad_account_id text not null,
 method text not null check(method in ('advertiser_confirmation','contract_review')),
 case_ref text not null check(case_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'),
 recorded_by uuid not null, recorded_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '30 days'),
 revoked_at timestamptz, revoked_by uuid
);
create index kitsnode_ads_evidence_connection on kitsnode_ads_private.ownership_evidence(connection_id,recorded_at desc);
create table kitsnode_ads_private.request_limits (
  user_id uuid primary key, window_started_at timestamptz not null, attempts integer not null check(attempts between 1 and 20)
);
create table kitsnode_ads_private.rules (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null references kitsnode_ads_private.connections(id),
  keyword_id text not null check (keyword_id ~ '^nkw-[A-Za-z0-9-]{1,100}$'),
  device text not null check (device in ('PC','MOBILE')),
  position integer not null check (position between 1 and 10 and (device <> 'MOBILE' or position <= 5)),
  min_bid integer not null check (min_bid >= 70), max_bid integer not null check (max_bid >= min_bid and max_bid <= 100000),
  max_change integer not null check (max_change > 0), increment integer not null check (increment > 0),
  enabled boolean not null default false, version bigint not null default 0 check (version >= 0),
  interval_seconds integer not null check (interval_seconds between 300 and 86400),
  next_run_at timestamptz not null default now(),
  check (min_bid % increment = 0 and max_bid % increment = 0 and max_change >= increment)
);
create unique index kitsnode_ads_one_rule_per_keyword on kitsnode_ads_private.rules(connection_id,keyword_id);
create table kitsnode_ads_private.execution_capability (
  singleton boolean primary key default true check(singleton),
  atomic_update_verified boolean not null default false
);
insert into kitsnode_ads_private.execution_capability(singleton) values(true);
create table kitsnode_ads_private.attempts (
  id uuid primary key default gen_random_uuid(), rule_id uuid not null references kitsnode_ads_private.rules(id),
  customer_id text not null, keyword_id text not null, owner_id uuid not null,
  rule_version bigint not null, state text not null check(state in ('claimed','sending','uncertain','finished')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index kitsnode_ads_one_active_attempt on kitsnode_ads_private.attempts(customer_id,keyword_id) where state in ('claimed','sending','uncertain');
create table kitsnode_ads_private.attempt_events (
  event_id uuid primary key default gen_random_uuid(), attempt_id uuid not null references kitsnode_ads_private.attempts(id),
  event_type text not null check (event_type in ('claimed','sending','finished','uncertain')),
  details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

alter table kitsnode_ads_private.connections enable row level security;
alter table kitsnode_ads_private.ownership_evidence enable row level security;
alter table kitsnode_ads_private.rules enable row level security;
alter table kitsnode_ads_private.request_limits enable row level security;
alter table kitsnode_ads_private.execution_capability enable row level security;
alter table kitsnode_ads_private.attempts enable row level security;
alter table kitsnode_ads_private.attempt_events enable row level security;
revoke all on all tables in schema kitsnode_ads_private from public, anon, authenticated, service_role;
grant select,insert,update on kitsnode_ads_private.connections,kitsnode_ads_private.rules,kitsnode_ads_private.attempts,kitsnode_ads_private.request_limits to service_role;
grant select,insert,update on kitsnode_ads_private.ownership_evidence to service_role;
grant select on kitsnode_ads_private.execution_capability to service_role;
grant select,insert on kitsnode_ads_private.attempt_events to service_role;

-- All arguments to these functions come from an authenticated server, not a
-- browser. These invoker functions are executable only by service_role.
-- Fixed one-minute window, atomically bounded per server-authenticated member.
-- Missing/invalid user ID and storage errors must be treated as denial by API.
create function public.kits_ads_rate_limit(p_user_id uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare v_attempts integer; v_now timestamptz:=clock_timestamp();
begin
 if p_user_id is null then return false; end if;
 insert into kitsnode_ads_private.request_limits(user_id,window_started_at,attempts) values(p_user_id,v_now,1)
 on conflict (user_id) do update set
   window_started_at=case when kitsnode_ads_private.request_limits.window_started_at <= v_now-interval '1 minute' then v_now else kitsnode_ads_private.request_limits.window_started_at end,
   attempts=case when kitsnode_ads_private.request_limits.window_started_at <= v_now-interval '1 minute' then 1 else kitsnode_ads_private.request_limits.attempts+1 end
 where kitsnode_ads_private.request_limits.window_started_at <= v_now-interval '1 minute' or kitsnode_ads_private.request_limits.attempts < 20
 returning attempts into v_attempts;
 return found;
end $$;

create function public.kits_ads_request(p_request_id uuid,p_user_id uuid,p_ad_account_id text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid; begin
 if p_request_id is null or p_user_id is null or p_ad_account_id is null or p_ad_account_id !~ '^[1-9][0-9]{0,15}$' then raise exception 'invalid_request'; end if;
 insert into kitsnode_ads_private.connections(id,user_id,ad_account_id) values(p_request_id,p_user_id,p_ad_account_id) returning id into v_id;
 return v_id;
end $$;

create function public.kits_ads_list(p_user_id uuid) returns table(request_id uuid,ad_account_id text,status text,revision bigint)
language sql stable security invoker set search_path='' as $$
 select c.id,c.ad_account_id,c.status,c.revision from kitsnode_ads_private.connections c where c.user_id=p_user_id order by c.created_at desc;
$$;

-- Service-only review metadata; evidence is not returned.
create function public.kits_ads_review(p_request_id uuid) returns table(request_id uuid,user_id uuid,ad_account_id text,status text,revision bigint)
language sql stable security invoker set search_path='' as $$
 select c.id,c.user_id,c.ad_account_id,c.status,c.revision from kitsnode_ads_private.connections c where c.id=p_request_id;
$$;

create function public.kits_ads_review_queue() returns table(request_id uuid,user_id uuid,ad_account_id text,status text,revision bigint,created_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select c.id,c.user_id,c.ad_account_id,c.status,c.revision,c.created_at from kitsnode_ads_private.connections c where c.status in ('pending_review','read_connected') order by c.created_at desc limit 100;
$$;

create function public.kits_ads_evidence_list(p_request_id uuid) returns table(evidence_id uuid,method text,case_ref text,recorded_by uuid,recorded_at timestamptz,expires_at timestamptz,revoked_at timestamptz,revoked_by uuid)
language sql stable security invoker set search_path='' as $$
 select e.id,e.method,e.case_ref,e.recorded_by,e.recorded_at,e.expires_at,e.revoked_at,e.revoked_by from kitsnode_ads_private.ownership_evidence e where e.connection_id=p_request_id order by e.recorded_at desc limit 100;
$$;

create function public.kits_ads_evidence_record(p_id uuid,p_request_id uuid,p_operator_id uuid,p_method text,p_case_ref text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare c kitsnode_ads_private.connections%rowtype;
begin
 if p_id is null or p_operator_id is null or p_method is null or p_method not in ('advertiser_confirmation','contract_review') or p_case_ref is null or p_case_ref !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$' then return false; end if;
 select * into c from kitsnode_ads_private.connections where id=p_request_id for update;
 if not found or c.status<>'pending_review' then return false; end if;
 insert into kitsnode_ads_private.ownership_evidence(id,connection_id,user_id,ad_account_id,method,case_ref,recorded_by) values(p_id,c.id,c.user_id,c.ad_account_id,p_method,p_case_ref,p_operator_id);
 return true;
exception when unique_violation then return false;
end $$;

create function public.kits_ads_evidence_revoke(p_request_id uuid,p_evidence_id uuid,p_operator_id uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare c kitsnode_ads_private.connections%rowtype; v_changed integer;
begin
 if p_operator_id is null then return false; end if;
 select * into c from kitsnode_ads_private.connections where id=p_request_id for update;
 if not found then return false; end if;
 update kitsnode_ads_private.ownership_evidence set revoked_at=now(),revoked_by=p_operator_id where id=p_evidence_id and connection_id=p_request_id and revoked_at is null;
 get diagnostics v_changed=row_count;
 if v_changed=1 and c.status='read_connected' and c.evidence_ref=p_evidence_id::text then
   update kitsnode_ads_private.connections set status='disconnected',write_verified=false,revision=revision+1,updated_at=now() where id=c.id;
   update kitsnode_ads_private.rules set enabled=false,version=version+1 where connection_id=c.id and enabled=true;
 end if;
 return v_changed=1;
end $$;

-- Server-only verified binding, never return this raw result to a member client.
create function public.kits_ads_get_binding(p_request_id uuid,p_user_id uuid) returns table(request_id uuid,user_id uuid,ad_account_id text,customer_id text,naver_role text,write_verified boolean,status text,revision bigint)
language sql stable security invoker set search_path='' as $$
 select c.id,c.user_id,c.ad_account_id,c.customer_id,c.naver_role,c.write_verified,c.status,c.revision from kitsnode_ads_private.connections c where c.id=p_request_id and c.user_id=p_user_id and c.status='read_connected';
$$;

create function public.kits_ads_approve(p_request_id uuid,p_user_id uuid,p_ad_account_id text,p_revision bigint,p_customer_id text,p_naver_role text,p_operator_id uuid,p_evidence_ref text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare v_changed integer; c kitsnode_ads_private.connections%rowtype; begin
 if p_operator_id is null or p_evidence_ref is null or length(p_evidence_ref) not between 1 and 128 or p_customer_id is null or p_customer_id !~ '^[1-9][0-9]{0,15}$' or p_naver_role is null or p_naver_role not in ('OWNER','MASTER','READ_ONLY') then return false; end if;
 select * into c from kitsnode_ads_private.connections where id=p_request_id for update;
 if not found or c.user_id<>p_user_id or c.ad_account_id<>p_ad_account_id or c.revision<>p_revision or c.status<>'pending_review' then return false; end if;
 if not exists(select 1 from kitsnode_ads_private.ownership_evidence e where e.id::text=p_evidence_ref and e.connection_id=c.id and e.user_id=c.user_id and e.ad_account_id=c.ad_account_id and e.revoked_at is null and e.expires_at>now()) then return false; end if;
 update kitsnode_ads_private.connections set customer_id=p_customer_id,naver_role=p_naver_role,approved_by=p_operator_id,evidence_ref=p_evidence_ref,status='read_connected',revision=revision+1,updated_at=now()
 where id=p_request_id and user_id=p_user_id and ad_account_id=p_ad_account_id and revision=p_revision and status='pending_review';
 get diagnostics v_changed = row_count; return v_changed=1;
exception when unique_violation then return false;
end $$;

create function public.kits_ads_disconnect(p_user_id uuid,p_request_id uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare v_changed integer; begin
 update kitsnode_ads_private.connections set status='disconnected',write_verified=false,revision=revision+1,updated_at=now() where id=p_request_id and user_id=p_user_id and status<>'disconnected';
 get diagnostics v_changed = row_count;
 if v_changed=1 then update kitsnode_ads_private.rules set enabled=false,version=version+1 where connection_id=p_request_id and enabled=true; end if;
 return v_changed=1;
end $$;

-- Validated server-side rule draft. Owner is derived from a verified session
-- by the API caller. Editing disables the rule and increments its version.
create function public.kits_ads_save_rule(p_user_id uuid,p_rule_id uuid,p_connection_id uuid,p_expected_version bigint,p_keyword_id text,p_device text,p_position integer,p_min_bid integer,p_max_bid integer,p_max_change integer,p_increment integer,p_interval_seconds integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c kitsnode_ads_private.connections%rowtype; r kitsnode_ads_private.rules%rowtype;
begin
 if p_user_id is null or p_rule_id is null or p_connection_id is null or p_keyword_id is null or p_keyword_id !~ '^nkw-[A-Za-z0-9-]{1,100}$' or p_device is null or p_device not in ('PC','MOBILE') or p_position is null or p_position<1 or p_position>(case when p_device='PC' then 10 else 5 end) or p_min_bid is null or p_max_bid is null or p_min_bid<70 or p_max_bid>100000 or p_max_bid<p_min_bid or p_increment is null or p_increment<1 or p_max_change is null or p_max_change<p_increment or p_max_change>100000 or p_interval_seconds is null or p_interval_seconds not between 300 and 86400 then return null; end if;
 if p_min_bid%p_increment<>0 or p_max_bid%p_increment<>0 then return null; end if;
 select * into c from kitsnode_ads_private.connections where id=p_connection_id for update;
 if not found or c.user_id<>p_user_id or c.status<>'read_connected' then return null; end if;
 if p_expected_version is null then
  insert into kitsnode_ads_private.rules(id,connection_id,keyword_id,device,position,min_bid,max_bid,max_change,increment,interval_seconds) values(p_rule_id,p_connection_id,p_keyword_id,p_device,p_position,p_min_bid,p_max_bid,p_max_change,p_increment,p_interval_seconds) returning * into r;
 else
  select * into r from kitsnode_ads_private.rules where id=p_rule_id and connection_id=p_connection_id for update;
  if not found or r.version<>p_expected_version then return null; end if;
  if exists(select 1 from kitsnode_ads_private.attempts a where a.rule_id=r.id and a.state in ('claimed','sending','uncertain')) then return null; end if;
  update kitsnode_ads_private.rules set keyword_id=p_keyword_id,device=p_device,position=p_position,min_bid=p_min_bid,max_bid=p_max_bid,max_change=p_max_change,increment=p_increment,interval_seconds=p_interval_seconds,enabled=false,version=version+1,next_run_at=now() where id=p_rule_id returning * into r;
 end if;
 return jsonb_build_object('id',r.id,'version',r.version,'enabled',r.enabled);
exception when unique_violation then return null;
end $$;

-- Pause is always allowed for the owner. Enabling requires a server-verified
-- write grant and independently confirmed provider atomic update capability.
create function public.kits_ads_set_rule_enabled(p_user_id uuid,p_rule_id uuid,p_expected_version bigint,p_enabled boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r kitsnode_ads_private.rules%rowtype; c kitsnode_ads_private.connections%rowtype; v_connection uuid;
begin
 if p_user_id is null or p_rule_id is null or p_expected_version is null or p_enabled is null then return null; end if;
 select connection_id into v_connection from kitsnode_ads_private.rules where id=p_rule_id;
 if not found then return null; end if;
 select * into c from kitsnode_ads_private.connections where id=v_connection for update;
 if not found or c.user_id<>p_user_id then return null; end if;
 select * into r from kitsnode_ads_private.rules where id=p_rule_id and connection_id=v_connection for update;
 if not found or r.version<>p_expected_version then return null; end if;
 if p_enabled and (c.status<>'read_connected' or not c.write_verified or not exists(select 1 from kitsnode_ads_private.execution_capability where singleton and atomic_update_verified) or exists(select 1 from kitsnode_ads_private.attempts a where a.rule_id=r.id and a.state in ('claimed','sending','uncertain'))) then return null; end if;
 update kitsnode_ads_private.rules set enabled=p_enabled,version=version+1,next_run_at=case when p_enabled then now() else next_run_at end where id=r.id returning * into r;
 return jsonb_build_object('id',r.id,'version',r.version,'enabled',r.enabled);
end $$;

-- Rule insert/update belongs to a separately authenticated server. Execution is
-- impossible until BOTH write verification and atomic update support are true.
create function public.kits_ads_list_due(p_limit integer default 20) returns table(rule_id uuid,user_id uuid)
language sql stable security invoker set search_path='' as $$
 select r.id,c.user_id from kitsnode_ads_private.rules r join kitsnode_ads_private.connections c on c.id=r.connection_id
 join kitsnode_ads_private.execution_capability f on f.singleton
 where r.enabled and r.next_run_at<=now() and c.status='read_connected' and c.write_verified and f.atomic_update_verified
 order by r.next_run_at,r.id limit least(greatest(p_limit,1),100);
$$;

create function public.kits_ads_claim(p_rule_id uuid,p_user_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r kitsnode_ads_private.rules%rowtype; c kitsnode_ads_private.connections%rowtype; a uuid; v_connection uuid;
begin
 if p_user_id is null or p_rule_id is null then return null; end if;
 select connection_id into v_connection from kitsnode_ads_private.rules where id=p_rule_id;
 if not found then return null; end if;
 select * into c from kitsnode_ads_private.connections where id=v_connection for update;
 if not found or c.user_id<>p_user_id or c.status<>'read_connected' or not c.write_verified then return null; end if;
 select * into r from kitsnode_ads_private.rules where id=p_rule_id and connection_id=v_connection for update skip locked;
 if not found or not r.enabled or r.next_run_at>now() or not exists (select 1 from kitsnode_ads_private.execution_capability where singleton and atomic_update_verified) then return null; end if;
 begin
  insert into kitsnode_ads_private.attempts(rule_id,customer_id,keyword_id,owner_id,rule_version,state) values(r.id,c.customer_id,r.keyword_id,c.user_id,r.version,'claimed') returning id into a;
 exception when unique_violation then return null; end;
 insert into kitsnode_ads_private.attempt_events(attempt_id,event_type) values(a,'claimed');
 update kitsnode_ads_private.rules set next_run_at=now()+make_interval(secs=>r.interval_seconds) where id=r.id;
 return jsonb_build_object('attemptId',a,'connection',jsonb_build_object('userId',c.user_id,'customerId',c.customer_id,'status',c.status,'writeVerified',c.write_verified),'rule',jsonb_build_object('id',r.id,'keywordId',r.keyword_id,'device',r.device,'position',r.position,'minBid',r.min_bid,'maxBid',r.max_bid,'maxChange',r.max_change,'increment',r.increment,'enabled',r.enabled,'version',r.version));
end $$;

create function public.kits_ads_mark_sending(p_attempt_id uuid,p_rule_version bigint,p_before integer,p_after integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare a kitsnode_ads_private.attempts%rowtype; r kitsnode_ads_private.rules%rowtype; c kitsnode_ads_private.connections%rowtype; v_connection uuid;
begin
 if p_attempt_id is null or p_rule_version is null then return false; end if;
 select * into a from kitsnode_ads_private.attempts where id=p_attempt_id for update;
 if not found or a.state<>'claimed' or a.rule_version<>p_rule_version then return false; end if;
 select connection_id into v_connection from kitsnode_ads_private.rules where id=a.rule_id;
 if not found then return false; end if;
 select * into c from kitsnode_ads_private.connections where id=v_connection for update;
 if not found then return false; end if;
 select * into r from kitsnode_ads_private.rules where id=a.rule_id and connection_id=v_connection for update;
 if not found then return false; end if;
 if not r.enabled or r.version<>p_rule_version or c.status<>'read_connected' or not c.write_verified or c.user_id<>a.owner_id or c.customer_id<>a.customer_id or r.keyword_id<>a.keyword_id or not exists(select 1 from kitsnode_ads_private.execution_capability where singleton and atomic_update_verified) then return false; end if;
 if p_before is null or p_after is null or p_before<r.min_bid or p_before>r.max_bid or p_after<r.min_bid or p_after>r.max_bid or p_before%r.increment<>0 or p_after%r.increment<>0 or abs(p_after::bigint-p_before::bigint)>r.max_change or p_before=p_after then return false; end if;
 update kitsnode_ads_private.attempts set state='sending',updated_at=now() where id=a.id;
 insert into kitsnode_ads_private.attempt_events(attempt_id,event_type,details) values(a.id,'sending',jsonb_build_object('beforeBid',p_before,'proposedBid',p_after));
 return true;
end $$;

create function public.kits_ads_finish(p_attempt_id uuid,p_status text,p_reason text default null) returns boolean
language plpgsql security invoker set search_path='' as $$
declare a kitsnode_ads_private.attempts%rowtype; v_state text;
begin
 select * into a from kitsnode_ads_private.attempts where id=p_attempt_id for update;
 if not found or a.state not in ('claimed','sending') or p_status is null or p_status not in ('applied','uncertain','rejected','skipped','unchanged','unavailable') or length(coalesce(p_reason,''))>100 then return false; end if;
 if p_status='applied' and a.state<>'sending' then return false; end if;
 -- Once a write was sent, only verified applied or uncertain may clear/update
 -- the attempt; any other outcome remains blocked for reconciliation.
 if a.state='sending' and p_status not in ('applied','uncertain') then return false; end if;
 v_state:=case when p_status='uncertain' then 'uncertain' else 'finished' end;
 update kitsnode_ads_private.attempts set state=v_state,updated_at=now() where id=a.id;
 insert into kitsnode_ads_private.attempt_events(attempt_id,event_type,details) values(a.id,case when v_state='uncertain' then 'uncertain' else 'finished' end,jsonb_build_object('status',p_status,'reason',p_reason));
 return true;
end $$;

revoke all on function public.kits_ads_rate_limit(uuid),public.kits_ads_request(uuid,uuid,text),public.kits_ads_list(uuid),public.kits_ads_review(uuid),public.kits_ads_get_binding(uuid,uuid),public.kits_ads_approve(uuid,uuid,text,bigint,text,text,uuid,text),public.kits_ads_disconnect(uuid,uuid),public.kits_ads_save_rule(uuid,uuid,uuid,bigint,text,text,integer,integer,integer,integer,integer,integer),public.kits_ads_set_rule_enabled(uuid,uuid,bigint,boolean),public.kits_ads_list_due(integer),public.kits_ads_claim(uuid,uuid),public.kits_ads_mark_sending(uuid,bigint,integer,integer),public.kits_ads_finish(uuid,text,text) from public,anon,authenticated;
grant execute on function public.kits_ads_rate_limit(uuid),public.kits_ads_request(uuid,uuid,text),public.kits_ads_list(uuid),public.kits_ads_review(uuid),public.kits_ads_get_binding(uuid,uuid),public.kits_ads_approve(uuid,uuid,text,bigint,text,text,uuid,text),public.kits_ads_disconnect(uuid,uuid),public.kits_ads_save_rule(uuid,uuid,uuid,bigint,text,text,integer,integer,integer,integer,integer,integer),public.kits_ads_set_rule_enabled(uuid,uuid,bigint,boolean),public.kits_ads_list_due(integer),public.kits_ads_claim(uuid,uuid),public.kits_ads_mark_sending(uuid,bigint,integer,integer),public.kits_ads_finish(uuid,text,text) to service_role;
revoke all on function public.kits_ads_review_queue(),public.kits_ads_evidence_list(uuid),public.kits_ads_evidence_record(uuid,uuid,uuid,text,text),public.kits_ads_evidence_revoke(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.kits_ads_review_queue(),public.kits_ads_evidence_list(uuid),public.kits_ads_evidence_record(uuid,uuid,uuid,text,text),public.kits_ads_evidence_revoke(uuid,uuid,uuid) to service_role;
