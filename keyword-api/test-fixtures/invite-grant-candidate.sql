-- Disposable PostgreSQL candidate only. Unapplied; Auth session layout and
-- lifecycle must be validated against the deployed Supabase version.
create table kitsnode_ads_private.invite_grants (
 request_id uuid primary key references kitsnode_ads_private.connections(id),
 user_id uuid not null, session_id uuid not null, nonce uuid not null unique,
 ad_account_id text not null, viewer_id text not null, revision bigint not null,
 secret_hash text not null unique check(secret_hash ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz not null, consumed_at timestamptz
);
alter table kitsnode_ads_private.invite_grants enable row level security;
revoke all on kitsnode_ads_private.invite_grants from public,anon,authenticated,service_role;
grant select,insert,update on kitsnode_ads_private.invite_grants to service_role;

create function public.kits_invite_grant_issue(p_request_id uuid,p_user_id uuid,p_session_id uuid,p_nonce uuid,p_account text,p_viewer text,p_revision bigint,p_hash text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare c kitsnode_ads_private.connections%rowtype; s kitsnode_ads_private.invite_consents%rowtype;
begin
 if p_hash !~ '^[0-9a-f]{64}$' or p_viewer !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' or p_viewer='kitsnode' then return false; end if;
 select * into c from kitsnode_ads_private.connections where id=p_request_id for update;
 if not found or c.user_id<>p_user_id or c.ad_account_id<>p_account or c.status<>'pending_review' or c.revision<>p_revision then return false; end if;
 select * into s from kitsnode_ads_private.invite_consents where connection_id=c.id for update;
 if not found or s.user_id<>p_user_id or s.ad_account_id<>p_account or not s.granted or s.recipient_id<>'kitsnode' or s.role<>'OPERATIONS_MANAGER' then return false; end if;
 if not exists(select 1 from auth.sessions where id=p_session_id and user_id=p_user_id and (not_after is null or not_after>clock_timestamp())) then return false; end if;
 insert into kitsnode_ads_private.invite_grants(request_id,user_id,session_id,nonce,ad_account_id,viewer_id,revision,secret_hash,expires_at)
 values(p_request_id,p_user_id,p_session_id,p_nonce,p_account,p_viewer,p_revision,p_hash,clock_timestamp()+interval '2 minutes') on conflict do nothing;
 return found;
end $$;

create function public.kits_invite_grant_consume(p_hash text,p_nonce uuid,p_account text,p_viewer text) returns table(request_id uuid,user_id uuid,nonce uuid,account_id text,viewer_id text,recipient_id text,role text)
language plpgsql security invoker set search_path='' as $$
declare g kitsnode_ads_private.invite_grants%rowtype; c kitsnode_ads_private.connections%rowtype; s kitsnode_ads_private.invite_consents%rowtype;
begin
 select * into g from kitsnode_ads_private.invite_grants where secret_hash=p_hash;
 if not found or g.consumed_at is not null or g.expires_at<=clock_timestamp() or g.nonce<>p_nonce or g.ad_account_id<>p_account or g.viewer_id<>p_viewer then return; end if;
 select * into c from kitsnode_ads_private.connections where id=g.request_id for update;
 if not found or c.user_id<>g.user_id or c.ad_account_id<>g.ad_account_id or c.status<>'pending_review' or c.revision<>g.revision then return; end if;
 select * into s from kitsnode_ads_private.invite_consents where connection_id=c.id for update;
 if not found or s.user_id<>g.user_id or s.ad_account_id<>g.ad_account_id or not s.granted or s.recipient_id<>'kitsnode' or s.role<>'OPERATIONS_MANAGER' then return; end if;
 select * into g from kitsnode_ads_private.invite_grants where secret_hash=p_hash for update;
 if not found or g.consumed_at is not null or g.expires_at<=clock_timestamp() or g.nonce<>p_nonce or g.ad_account_id<>p_account or g.viewer_id<>p_viewer or g.request_id<>c.id or g.user_id<>c.user_id or g.revision<>c.revision then return; end if;
 if not exists(select 1 from auth.sessions a where a.id=g.session_id and a.user_id=g.user_id and (a.not_after is null or a.not_after>clock_timestamp())) then return; end if;
 update kitsnode_ads_private.invite_grants set consumed_at=clock_timestamp() where secret_hash=p_hash;
 return query select g.request_id,g.user_id,g.nonce,g.ad_account_id,g.viewer_id,'kitsnode'::text,'OPERATIONS_MANAGER'::text;
end $$;
revoke all on function public.kits_invite_grant_issue(uuid,uuid,uuid,uuid,text,text,bigint,text),public.kits_invite_grant_consume(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.kits_invite_grant_issue(uuid,uuid,uuid,uuid,text,text,bigint,text),public.kits_invite_grant_consume(text,uuid,text,text) to service_role;
