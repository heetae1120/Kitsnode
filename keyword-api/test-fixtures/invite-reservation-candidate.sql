-- Candidate only; not applied. RPC inputs must come from an authenticated server.
-- Consent records authorization of this exact purpose, not proof of account ownership.
create table kitsnode_ads_private.invite_consents (
 connection_id uuid primary key references kitsnode_ads_private.connections(id),
 user_id uuid not null, ad_account_id text not null, recipient_id text not null,
 role text not null check(role='OPERATIONS_MANAGER'),
 granted boolean not null default true, revision bigint not null default 0,
 created_at timestamptz not null default now(), revoked_at timestamptz
);
create table kitsnode_ads_private.invite_attempts (
 connection_id uuid primary key references kitsnode_ads_private.connections(id),
 user_id uuid not null, ad_account_id text not null, consent_revision bigint not null,
 connection_revision bigint not null, recipient_id text not null,
 role text not null check(role='OPERATIONS_MANAGER'),
 outcome text not null default 'reserved' check(outcome in ('reserved','blocked','uncertain','pending_review')),
 created_at timestamptz not null default now(), finished_at timestamptz
);
alter table kitsnode_ads_private.invite_consents enable row level security;
alter table kitsnode_ads_private.invite_attempts enable row level security;
revoke all on kitsnode_ads_private.invite_consents,kitsnode_ads_private.invite_attempts from public,anon,authenticated,service_role;
grant select,insert,update on kitsnode_ads_private.invite_consents,kitsnode_ads_private.invite_attempts to service_role;

-- Only a verified member, after explicit purpose/recipient/role consent, can be
-- passed here by the server. Re-consent requires a fresh connection request.
create function public.kits_ads_invite_consent(p_request_id uuid,p_user_id uuid,p_recipient_id text,p_role text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare c kitsnode_ads_private.connections%rowtype;
begin
 if p_recipient_id is null or p_recipient_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' or p_role is distinct from 'OPERATIONS_MANAGER' then return false; end if;
 select * into c from kitsnode_ads_private.connections where id=p_request_id for update;
 if not found or c.user_id is distinct from p_user_id or c.status<>'pending_review' then return false; end if;
 insert into kitsnode_ads_private.invite_consents(connection_id,user_id,ad_account_id,recipient_id,role)
 values(c.id,c.user_id,c.ad_account_id,p_recipient_id,p_role) on conflict do nothing;
 return found;
end $$;
create function public.kits_ads_invite_revoke(p_request_id uuid,p_user_id uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare c kitsnode_ads_private.connections%rowtype;
begin
 select * into c from kitsnode_ads_private.connections where id=p_request_id for update;
 if not found or c.user_id is distinct from p_user_id then return false; end if;
 update kitsnode_ads_private.invite_consents set granted=false,revision=revision+1,revoked_at=now()
 where connection_id=c.id and user_id=c.user_id and granted=true;
 return found;
end $$;
create function public.kits_ads_invite_job(p_request_id uuid) returns table(user_id uuid,ad_account_id text,state text,consent boolean,revision text)
language sql stable security invoker set search_path='' as $$
 select c.user_id,c.ad_account_id,c.status,s.granted,c.revision::text||':'||s.revision::text
 from kitsnode_ads_private.connections c join kitsnode_ads_private.invite_consents s on s.connection_id=c.id and s.user_id=c.user_id and s.ad_account_id=c.ad_account_id
 where c.id=p_request_id;
$$;
create function public.kits_ads_invite_reserve(p_request_id uuid,p_user_id uuid,p_ad_account_id text,p_revision text,p_recipient_id text,p_role text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare c kitsnode_ads_private.connections%rowtype; s kitsnode_ads_private.invite_consents%rowtype;
begin
 if p_recipient_id is null or p_recipient_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' or p_role is distinct from 'OPERATIONS_MANAGER' then return false; end if;
 select * into c from kitsnode_ads_private.connections where id=p_request_id for update;
 if not found or c.user_id is distinct from p_user_id or c.ad_account_id is distinct from p_ad_account_id or c.status<>'pending_review' then return false; end if;
 select * into s from kitsnode_ads_private.invite_consents where connection_id=c.id for update;
 if not found or not s.granted or s.user_id<>c.user_id or s.ad_account_id<>c.ad_account_id or s.recipient_id<>p_recipient_id or s.role<>p_role or p_revision is distinct from (c.revision::text||':'||s.revision::text) then return false; end if;
 insert into kitsnode_ads_private.invite_attempts(connection_id,user_id,ad_account_id,consent_revision,connection_revision,recipient_id,role)
 values(c.id,c.user_id,c.ad_account_id,s.revision,c.revision,p_recipient_id,p_role) on conflict do nothing;
 return found;
end $$;
create function public.kits_ads_invite_finish(p_request_id uuid,p_outcome text) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if p_outcome is null or p_outcome not in ('blocked','uncertain','pending_review') then return false; end if;
 update kitsnode_ads_private.invite_attempts set outcome=p_outcome,finished_at=now() where connection_id=p_request_id and outcome='reserved';
 return found;
end $$;
revoke all on function public.kits_ads_invite_consent(uuid,uuid,text,text),public.kits_ads_invite_revoke(uuid,uuid),public.kits_ads_invite_job(uuid),public.kits_ads_invite_reserve(uuid,uuid,text,text,text,text),public.kits_ads_invite_finish(uuid,text) from public,anon,authenticated;
grant execute on function public.kits_ads_invite_consent(uuid,uuid,text,text),public.kits_ads_invite_revoke(uuid,uuid),public.kits_ads_invite_job(uuid),public.kits_ads_invite_reserve(uuid,uuid,text,text,text,text),public.kits_ads_invite_finish(uuid,text) to service_role;
