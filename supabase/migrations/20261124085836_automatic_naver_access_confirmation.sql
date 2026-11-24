-- Read-only Naver access is confirmed by the server immediately before this
-- service-only compare-and-swap. It does not establish advertiser identity.
alter table kitsnode_ads_private.connections add column if not exists approval_method text not null default 'operator' check (approval_method in ('operator','naver_access'));
alter table kitsnode_ads_private.connections drop constraint connections_check;
alter table kitsnode_ads_private.connections add constraint connections_read_binding_check check (status <> 'read_connected' or (customer_id is not null and naver_role is not null and ((approval_method='operator' and approved_by is not null and evidence_ref is not null) or (approval_method='naver_access' and approved_by is null and evidence_ref is null))));
create function public.kits_ads_confirm_naver_access(p_request_id uuid,p_user_id uuid,p_ad_account_id text,p_revision bigint,p_customer_id text,p_naver_role text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_user_id is null or p_request_id is null or p_ad_account_id !~ '^[1-9][0-9]{0,15}$' or p_customer_id !~ '^[1-9][0-9]{0,15}$' or p_naver_role not in ('OWNER','MASTER','READ_ONLY') then return false; end if;
 update kitsnode_ads_private.connections set status='read_connected',customer_id=p_customer_id,naver_role=p_naver_role,approval_method='naver_access',approved_by=null,evidence_ref=null,write_verified=false,revision=revision+1,updated_at=now()
 where id=p_request_id and user_id=p_user_id and ad_account_id=p_ad_account_id and revision=p_revision and status='pending_review';
 get diagnostics n=row_count; return n=1;
exception when unique_violation then return false;
end $$;
revoke all on function public.kits_ads_confirm_naver_access(uuid,uuid,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.kits_ads_confirm_naver_access(uuid,uuid,text,bigint,text,text) to service_role;
