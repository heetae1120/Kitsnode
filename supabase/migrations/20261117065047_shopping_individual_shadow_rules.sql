-- Shopping rules are permanently simulation-only in this schema. No enabled
-- flag, scheduler, or advertising mutation capability is provided.
create table kitsnode_ads_private.shopping_shadow_rules (
 id uuid primary key, connection_id uuid not null references kitsnode_ads_private.connections(id),
 campaign_id text not null check(campaign_id ~ '^cmp-[A-Za-z0-9-]{1,100}$'),
 adgroup_id text not null check(adgroup_id ~ '^grp-[A-Za-z0-9-]{1,100}$'),
 target_type text not null check(target_type in ('group','product','keyword')),
 target_id text not null,
 check((target_type='group' and target_id=adgroup_id) or (target_type='product' and target_id ~ '^nad-[A-Za-z0-9-]{1,100}$') or (target_type='keyword' and target_id ~ '^nkw-[A-Za-z0-9-]{1,100}$')),
 reference_bid integer not null check(reference_bid between 50 and 100000),
 min_bid integer not null check(min_bid between 50 and 100000 and min_bid % 10=0),
 max_bid integer not null check(max_bid between min_bid and 100000 and max_bid % 10=0),
 max_change integer not null check(max_change between 10 and 100000),
 version bigint not null default 0 check(version >= 0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(connection_id,target_type,target_id)
);
create table kitsnode_ads_private.shopping_shadow_history (
 id uuid primary key, rule_id uuid not null references kitsnode_ads_private.shopping_shadow_rules(id),
 rule_version bigint not null, created_at timestamptz not null default now(),
 result jsonb not null check(jsonb_typeof(result)='object' and octet_length(result::text)<=8000)
);
create index shopping_shadow_history_rule_time on kitsnode_ads_private.shopping_shadow_history(rule_id,created_at desc);
alter table kitsnode_ads_private.shopping_shadow_rules enable row level security;
alter table kitsnode_ads_private.shopping_shadow_history enable row level security;
revoke all on kitsnode_ads_private.shopping_shadow_rules,kitsnode_ads_private.shopping_shadow_history from public,anon,authenticated,service_role;
grant select,insert,update on kitsnode_ads_private.shopping_shadow_rules to service_role;
grant select,insert on kitsnode_ads_private.shopping_shadow_history to service_role;
create function public.kits_shopping_shadow_save(p_user_id uuid,p_connection_id uuid,p_campaign_id text,p_adgroup_id text,p_reference_bid integer,p_min_bid integer,p_max_bid integer,p_max_change integer,p_expected_version bigint,p_target_type text,p_target_id text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c kitsnode_ads_private.connections%rowtype; r kitsnode_ads_private.shopping_shadow_rules%rowtype;
begin
 select * into c from kitsnode_ads_private.connections where id=p_connection_id and user_id=p_user_id and status='read_connected' for update;
 if not found then return null; end if;
 if p_expected_version is null then
 if (select count(*) from kitsnode_ads_private.shopping_shadow_rules where connection_id=c.id)>=100 then return null; end if;
 insert into kitsnode_ads_private.shopping_shadow_rules(id,connection_id,campaign_id,adgroup_id,reference_bid,min_bid,max_bid,max_change,target_type,target_id)
 values(gen_random_uuid(),c.id,p_campaign_id,p_adgroup_id,p_reference_bid,p_min_bid,p_max_bid,p_max_change,p_target_type,p_target_id)
 on conflict(connection_id,target_type,target_id) do nothing returning * into r;
 else
 update kitsnode_ads_private.shopping_shadow_rules set campaign_id=p_campaign_id,reference_bid=p_reference_bid,min_bid=p_min_bid,max_bid=p_max_bid,max_change=p_max_change,version=version+1,updated_at=now()
 where connection_id=c.id and adgroup_id=p_adgroup_id and target_type=p_target_type and target_id=p_target_id and version=p_expected_version returning * into r;
 end if;
 if r.id is null then return null; end if;
 return to_jsonb(r);
end $$;
create function public.kits_shopping_shadow_list(p_user_id uuid,p_connection_id uuid) returns setof kitsnode_ads_private.shopping_shadow_rules
language sql stable security invoker set search_path='' as $$
 select r.* from kitsnode_ads_private.shopping_shadow_rules r join kitsnode_ads_private.connections c on c.id=r.connection_id where c.id=p_connection_id and c.user_id=p_user_id and c.status='read_connected' order by r.updated_at desc limit 101;
$$;
create function public.kits_shopping_shadow_append(p_user_id uuid,p_rule_id uuid,p_rule_version bigint,p_connection_revision bigint,p_result jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare c kitsnode_ads_private.connections%rowtype; r kitsnode_ads_private.shopping_shadow_rules%rowtype; v_id uuid;
begin
 select c1.* into c from kitsnode_ads_private.connections c1 join kitsnode_ads_private.shopping_shadow_rules r1 on r1.connection_id=c1.id where r1.id=p_rule_id and c1.user_id=p_user_id and c1.status='read_connected' and c1.revision=p_connection_revision for update of c1;
 if not found then return null; end if;
 select * into r from kitsnode_ads_private.shopping_shadow_rules where id=p_rule_id and connection_id=c.id and version=p_rule_version for update;
 if not found then return null; end if;
 insert into kitsnode_ads_private.shopping_shadow_history(id,rule_id,rule_version,result) values(gen_random_uuid(),r.id,r.version,p_result) returning id into v_id;
 return v_id;
end $$;
create function public.kits_shopping_shadow_history(p_user_id uuid,p_rule_id uuid) returns table(id uuid,rule_version bigint,created_at timestamptz,result jsonb)
language sql stable security invoker set search_path='' as $$
 select h.id,h.rule_version,h.created_at,h.result from kitsnode_ads_private.shopping_shadow_history h join kitsnode_ads_private.shopping_shadow_rules r on r.id=h.rule_id join kitsnode_ads_private.connections c on c.id=r.connection_id where r.id=p_rule_id and c.user_id=p_user_id and c.status='read_connected' order by h.created_at desc limit 100;
$$;
revoke all on function public.kits_shopping_shadow_save(uuid,uuid,text,text,integer,integer,integer,integer,bigint,text,text),public.kits_shopping_shadow_list(uuid,uuid),public.kits_shopping_shadow_append(uuid,uuid,bigint,bigint,jsonb),public.kits_shopping_shadow_history(uuid,uuid) from public,anon,authenticated;
grant execute on function public.kits_shopping_shadow_save(uuid,uuid,text,text,integer,integer,integer,integer,bigint,text,text),public.kits_shopping_shadow_list(uuid,uuid),public.kits_shopping_shadow_append(uuid,uuid,bigint,bigint,jsonb),public.kits_shopping_shadow_history(uuid,uuid) to service_role;
