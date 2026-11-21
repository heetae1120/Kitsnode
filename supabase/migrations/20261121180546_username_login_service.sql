-- Restricted service-side lookup. Public clients never receive email addresses.
create function public.kitsnode_lookup_email_login(p_username text)
returns table(user_id uuid,email text) language sql stable security definer set search_path='' as $$
 select p.user_id,u.email from public.kitsnode_email_profiles p join auth.users u on u.id=p.user_id
 where p.username=lower(btrim(p_username)) and u.email_confirmed_at is not null
 and exists(select 1 from auth.identities i where i.user_id=u.id and i.provider='email')
$$;
revoke all on function public.kitsnode_lookup_email_login(text) from public,anon,authenticated;
grant execute on function public.kitsnode_lookup_email_login(text) to service_role;

create table kitsnode_member_private.username_login_limits (
 kind text not null, scope text not null check(scope in ('global','subject')), digest text not null,
 window_start timestamptz not null, hits integer not null check(hits>=0),primary key(kind,scope,digest)
);
alter table kitsnode_member_private.username_login_limits enable row level security;
revoke all on kitsnode_member_private.username_login_limits from public,anon,authenticated,service_role;
create function public.kitsnode_consume_username_limit(p_kind text,p_subject_hash text,p_global_limit integer,p_subject_limit integer,p_window_seconds integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare t timestamptz:=clock_timestamp(); r record;
begin
 if p_kind is null or p_kind not in ('availability','login') or p_subject_hash is null or p_subject_hash !~ '^[0-9a-f]{64}$' or p_global_limit is null or p_subject_limit is null or p_window_seconds is null or p_global_limit not between 1 and 10000 or p_subject_limit not between 1 and 10000 or p_window_seconds not between 1 and 86400 then return false; end if;
 insert into kitsnode_member_private.username_login_limits values(p_kind,'global','global',t,0) on conflict do nothing;
 insert into kitsnode_member_private.username_login_limits values(p_kind,'subject',p_subject_hash,t,0) on conflict do nothing;
 for r in select * from kitsnode_member_private.username_login_limits where kind=p_kind and ((scope='global' and digest='global') or (scope='subject' and digest=p_subject_hash)) order by scope for update loop
  if r.window_start+make_interval(secs=>p_window_seconds)>t and r.hits >= (case when r.scope='global' then p_global_limit else p_subject_limit end) then return false; end if;
 end loop;
 update kitsnode_member_private.username_login_limits set hits=case when window_start+make_interval(secs=>p_window_seconds)<=t then 1 else hits+1 end,window_start=case when window_start+make_interval(secs=>p_window_seconds)<=t then t else window_start end where kind=p_kind and ((scope='global' and digest='global') or (scope='subject' and digest=p_subject_hash));
 return true;
end $$;
revoke all on function public.kitsnode_consume_username_limit(text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.kitsnode_consume_username_limit(text,text,integer,integer,integer) to service_role;
