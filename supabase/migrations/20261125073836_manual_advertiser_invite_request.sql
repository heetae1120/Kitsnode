-- Candidate only: no production migration. Customer requests do not assert an account.
create table kitsnode_ads_private.manual_invite_requests (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending_review' check(status in ('pending_review','matched')),
 connection_id uuid references kitsnode_ads_private.connections(id) on delete set null,
 matched_by uuid,
 created_at timestamptz not null default now(),
 matched_at timestamptz
);
create unique index manual_invite_one_pending on kitsnode_ads_private.manual_invite_requests(user_id) where status='pending_review';
alter table kitsnode_ads_private.manual_invite_requests enable row level security;
revoke all on kitsnode_ads_private.manual_invite_requests from public, anon, authenticated;
grant select,insert,update,delete on kitsnode_ads_private.manual_invite_requests to service_role;

-- Caller has locked the auth user row. Match the member withdrawal advisory
-- lock and hold consent rows until commit so consent withdrawal cannot race.
create function kitsnode_ads_private.manual_invite_member_allowed(p_user uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_user is null then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,0));
 if exists(select 1 from kitsnode_member_private.deletion_access_blocks where subject_id=p_user)
    or exists(select 1 from auth.users where id=p_user and banned_until is not null and banned_until>pg_catalog.clock_timestamp())
    or kitsnode_member_private.email_profile_is_pending(p_user) is distinct from false then return false; end if;
 perform 1 from public.kitsnode_member_consents where user_id=p_user and (terms_version,privacy_version) in (('2026-11-14','2026-11-14-naver'),('2026-11-23','2026-11-23')) and accepted_at is not null for share;
 return found;
end $$;
revoke all on function kitsnode_ads_private.manual_invite_member_allowed(uuid) from public,anon,authenticated,service_role;

create function public.kits_manual_invite_create(p_id uuid,p_user uuid,p_session uuid) returns text
language plpgsql security definer set search_path='' as $$
begin
 if p_id is null or p_user is null or p_session is null then return null; end if;
 perform id from auth.users where id=p_user for update; if not found or kitsnode_ads_private.manual_invite_member_allowed(p_user) is distinct from true then return null; end if;
 perform id from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>now()) for key share; if not found then return null; end if;
 if exists(select 1 from kitsnode_ads_private.manual_invite_requests where user_id=p_user and status='pending_review') then return 'pending_review'; end if;
 if exists(select 1 from kitsnode_ads_private.manual_invite_requests r join kitsnode_ads_private.connections c on c.id=r.connection_id where r.user_id=p_user and r.status='matched' and c.status='pending_review') then return 'matched'; end if;
 insert into kitsnode_ads_private.manual_invite_requests(id,user_id)
 values(p_id,p_user) on conflict (user_id) where status='pending_review' do nothing;
 return 'pending_review';
end $$;
create function public.kits_manual_invite_status(p_user uuid) returns text
language sql stable security invoker set search_path='' as $$
 select coalesce((select case when r.status='pending_review' then 'pending_review' else 'matched' end
 from kitsnode_ads_private.manual_invite_requests r left join kitsnode_ads_private.connections c on c.id=r.connection_id
 where r.user_id=p_user and (r.status='pending_review' or (r.status='matched' and c.status='pending_review'))
 order by case when r.status='pending_review' then 0 else 1 end, r.created_at desc limit 1),'none');
$$;
create function public.kits_manual_invite_queue() returns table(request_id uuid,user_id uuid,created_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select r.id,r.user_id,r.created_at from kitsnode_ads_private.manual_invite_requests r
 where r.status='pending_review' order by r.created_at limit 100;
$$;
-- Operator must verify the customer/account relationship separately; this only
-- creates a pending request, and never grants access or represents approval.
create function public.kits_manual_invite_attach(p_request uuid,p_connection uuid,p_operator uuid,p_session uuid,p_account text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r kitsnode_ads_private.manual_invite_requests%rowtype; cid uuid; request_user uuid;
begin
 if p_request is null or p_connection is null or p_operator is null or p_session is null or p_account is null or p_account !~ '^[1-9][0-9]{0,15}$' then return null; end if;
 perform id from auth.users where id=p_operator and (banned_until is null or banned_until<=pg_catalog.clock_timestamp()) for key share; if not found then return null; end if;
 perform id from auth.sessions where id=p_session and user_id=p_operator and (not_after is null or not_after>now()) for key share; if not found then return null; end if;
 select user_id into request_user from kitsnode_ads_private.manual_invite_requests where id=p_request; if not found then return null; end if;
 perform id from auth.users where id=request_user for update; if not found or kitsnode_ads_private.manual_invite_member_allowed(request_user) is distinct from true then return null; end if;
 select * into r from kitsnode_ads_private.manual_invite_requests where id=p_request for update;
 if not found or r.status<>'pending_review' then return null; end if;
 -- Account already connected to another customer is never reassigned here.
 if exists(select 1 from kitsnode_ads_private.connections c where c.ad_account_id=p_account and c.status='read_connected' and c.user_id<>r.user_id) then return null; end if;
 select c.id into cid from kitsnode_ads_private.connections c where c.user_id=r.user_id and c.ad_account_id=p_account and c.status in ('pending_review','read_connected') order by c.created_at desc limit 1;
 if cid is null then
  insert into kitsnode_ads_private.connections(id,user_id,ad_account_id) values(p_connection,r.user_id,p_account) returning id into cid;
 end if;
 update kitsnode_ads_private.manual_invite_requests set status='matched',connection_id=cid,matched_by=p_operator,matched_at=now() where id=p_request and status='pending_review';
 return cid;
exception when unique_violation or foreign_key_violation then return null;
end $$;
revoke all on function public.kits_manual_invite_create(uuid,uuid,uuid),public.kits_manual_invite_status(uuid),public.kits_manual_invite_queue(),public.kits_manual_invite_attach(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.kits_manual_invite_create(uuid,uuid,uuid),public.kits_manual_invite_status(uuid),public.kits_manual_invite_queue(),public.kits_manual_invite_attach(uuid,uuid,uuid,uuid,text) to service_role;
