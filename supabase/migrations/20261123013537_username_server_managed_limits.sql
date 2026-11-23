-- The HMAC key is generated and kept inside the database; no API or Edge
-- environment variable exposes it. This migration does not activate an Edge.
create table kitsnode_member_private.username_limit_key (
 singleton boolean primary key default true check (singleton),
 secret bytea not null check (octet_length(secret)=32)
);
alter table kitsnode_member_private.username_limit_key enable row level security;
revoke all on kitsnode_member_private.username_limit_key from public,anon,authenticated,service_role;
insert into kitsnode_member_private.username_limit_key(singleton,secret)
 values(true,extensions.gen_random_bytes(32));
create index username_login_limits_expiry_idx
 on kitsnode_member_private.username_login_limits(kind,window_start)
 where scope='subject';

-- Service-only wrapper fixes the limits on the server; callers cannot weaken
-- them or obtain the stored digest key. Input is never stored or logged here.
create function public.kitsnode_consume_username_limit_auto(p_kind text,p_username text)
returns boolean language plpgsql security definer set search_path='' as $$
declare normalized text:=lower(btrim(p_username)); k bytea; hashed text;
 t timestamptz:=clock_timestamp(); g record; s record; max_global integer;
begin
 if p_kind is null or p_kind not in ('availability','login') or normalized is null or normalized !~ '^[a-z0-9][a-z0-9_-]{3,19}$' then return false; end if;
 select secret into k from kitsnode_member_private.username_limit_key where singleton;
 if k is null or octet_length(k)<>32 then return false; end if;
 hashed:=encode(extensions.hmac(convert_to(normalized,'UTF8'),k,'sha256'),'hex');
 -- The global row serializes admission for this request kind. Reject before
 -- allocating a per-subject row, so random rejected usernames cannot grow it.
 max_global:=case when p_kind='login' then 100 else 300 end;
 insert into kitsnode_member_private.username_login_limits values(p_kind,'global','global',t,0) on conflict do nothing;
 select * into g from kitsnode_member_private.username_login_limits
  where kind=p_kind and scope='global' and digest='global' for update;
 if g.window_start+interval '60 seconds'>t and g.hits>=max_global then return false; end if;
 -- Once per window, remove a bounded batch of old subject entries. The
 -- partial expiry index keeps this bounded even for a long-lived deployment.
 if g.hits=0 or g.window_start+interval '60 seconds'<=t then
  delete from kitsnode_member_private.username_login_limits where ctid in (
   select ctid from kitsnode_member_private.username_login_limits
   where kind=p_kind and scope='subject' and window_start<t-interval '24 hours'
   order by window_start limit 500
  );
 end if;
 insert into kitsnode_member_private.username_login_limits values(p_kind,'subject',hashed,t,0) on conflict do nothing;
 select * into s from kitsnode_member_private.username_login_limits
  where kind=p_kind and scope='subject' and digest=hashed for update;
 if s.window_start+interval '60 seconds'>t and s.hits>=5 then return false; end if;
 update kitsnode_member_private.username_login_limits set
  hits=case when window_start+interval '60 seconds'<=t then 1 else hits+1 end,
  window_start=case when window_start+interval '60 seconds'<=t then t else window_start end
  where kind=p_kind and ((scope='global' and digest='global') or (scope='subject' and digest=hashed));
 return true;
end $$;
revoke all on function public.kitsnode_consume_username_limit_auto(text,text) from public,anon,authenticated;
grant execute on function public.kitsnode_consume_username_limit_auto(text,text) to service_role;
