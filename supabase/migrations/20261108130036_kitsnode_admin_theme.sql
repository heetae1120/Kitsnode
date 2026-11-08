-- LOCAL PREPARATION ONLY. Not applied. No visitor layout changes.
begin;
create function public.kitsnode_valid_admin_theme(p_theme jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare k text; v jsonb; n numeric;
begin
  if p_theme is null or jsonb_typeof(p_theme) <> 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(p_theme)) <> 2
    or not (p_theme ? 'font' and p_theme ? 'tokens')
    or jsonb_typeof(p_theme->'font') <> 'string'
    or p_theme->>'font' not in ('pretendard','system')
    or jsonb_typeof(p_theme->'tokens') <> 'object' then return false; end if;
  for k,v in select key,value from jsonb_each(p_theme->'tokens') loop
    if k in ('canvas','rail','selected','surface','surface-subtle','text','text-secondary','text-muted','border','control-border','divider','primary','primary-hover','primary-soft','success','success-soft','warning','warning-soft','danger','danger-soft','focus','caption-color','description-color') then
      if jsonb_typeof(v) <> 'string' or length(v #>> '{}') <> 7 or (v #>> '{}') !~ '^#[0-9a-fA-F]{6}$' then return false; end if;
    else
      case k
      when 'text-xs' then if jsonb_typeof(v) <> 'number' then return false; end if; n := (v #>> '{}')::numeric; if n < 10 or n > 24 then return false; end if;
      when 'text-sm' then if jsonb_typeof(v) <> 'number' then return false; end if; n := (v #>> '{}')::numeric; if n < 10 or n > 28 then return false; end if;
      when 'text-md' then if jsonb_typeof(v) <> 'number' then return false; end if; n := (v #>> '{}')::numeric; if n < 10 or n > 32 then return false; end if;
      when 'text-base' then if jsonb_typeof(v) <> 'number' then return false; end if; n := (v #>> '{}')::numeric; if n < 10 or n > 32 then return false; end if;
      when 'text-description' then if jsonb_typeof(v) <> 'number' then return false; end if; n := (v #>> '{}')::numeric; if n < 10 or n > 36 then return false; end if;
      when 'text-lg' then if jsonb_typeof(v) <> 'number' then return false; end if; n := (v #>> '{}')::numeric; if n < 12 or n > 40 then return false; end if;
      when 'text-xl' then if jsonb_typeof(v) <> 'number' then return false; end if; n := (v #>> '{}')::numeric; if n < 12 or n > 48 then return false; end if;
      when 'text-2xl' then if jsonb_typeof(v) <> 'number' then return false; end if; n := (v #>> '{}')::numeric; if n < 14 or n > 56 then return false; end if;
      when 'text-3xl' then if jsonb_typeof(v) <> 'number' then return false; end if; n := (v #>> '{}')::numeric; if n < 16 or n > 64 then return false; end if;
      when 'caption-leading' then if jsonb_typeof(v) <> 'number' then return false; end if; n := (v #>> '{}')::numeric; if n < 12 or n > 64 then return false; end if;
      when 'description-leading' then if jsonb_typeof(v) <> 'number' then return false; end if; n := (v #>> '{}')::numeric; if n < 12 or n > 72 then return false; end if;
      when 'weight-regular' then if jsonb_typeof(v) <> 'number' then return false; end if; n := (v #>> '{}')::numeric; if n < 100 or n > 900 or mod(n,100) <> 0 then return false; end if;
      when 'weight-medium' then if jsonb_typeof(v) <> 'number' then return false; end if; n := (v #>> '{}')::numeric; if n < 100 or n > 900 or mod(n,100) <> 0 then return false; end if;
      when 'weight-semibold' then if jsonb_typeof(v) <> 'number' then return false; end if; n := (v #>> '{}')::numeric; if n < 100 or n > 900 or mod(n,100) <> 0 then return false; end if;
      when 'weight-bold' then if jsonb_typeof(v) <> 'number' then return false; end if; n := (v #>> '{}')::numeric; if n < 100 or n > 900 or mod(n,100) <> 0 then return false; end if;
      when 'leading-tight' then if jsonb_typeof(v) <> 'number' then return false; end if; n := (v #>> '{}')::numeric; if n < 1 or n > 2.5 then return false; end if;
      when 'leading-body' then if jsonb_typeof(v) <> 'number' then return false; end if; n := (v #>> '{}')::numeric; if n < 1 or n > 3 then return false; end if;
      else return false;
      end case;
    end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.kitsnode_valid_admin_theme(jsonb) from public, anon, authenticated;
grant execute on function public.kitsnode_valid_admin_theme(jsonb) to service_role;

create table public.kitsnode_admin_theme_state (
  singleton boolean primary key default true check (singleton),
  theme jsonb not null check (public.kitsnode_valid_admin_theme(theme)),
  revision bigint not null check (revision between 0 and 9007199254740991),
  updated_at timestamptz
);
create table public.kitsnode_admin_theme_versions (
  revision bigint primary key check (revision between 1 and 9007199254740991),
  theme jsonb not null check (public.kitsnode_valid_admin_theme(theme)),
  actor text not null check (actor ~ '^[-A-Za-z0-9]{1,39}$'),
  created_at timestamptz not null
);
alter table public.kitsnode_admin_theme_state enable row level security;
alter table public.kitsnode_admin_theme_versions enable row level security;
revoke all on public.kitsnode_admin_theme_state, public.kitsnode_admin_theme_versions from public, anon, authenticated, service_role;
grant select, update on public.kitsnode_admin_theme_state to service_role;
grant select, insert on public.kitsnode_admin_theme_versions to service_role;
-- Seed the initial theme only when this separately approved migration is applied.
insert into public.kitsnode_admin_theme_state(singleton,theme,revision,updated_at)
values(true,'{"font":"pretendard","tokens":{}}',0,null);

create function public.kitsnode_save_admin_theme(p_expected_revision bigint, p_theme jsonb, p_actor text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_row public.kitsnode_admin_theme_state%rowtype; next_revision bigint; stamp timestamptz;
begin
  if p_expected_revision is null or p_expected_revision < 0 or p_expected_revision > 9007199254740991
    or not public.kitsnode_valid_admin_theme(p_theme)
    or p_actor is null or p_actor !~ '^[-A-Za-z0-9]{1,39}$' then
    raise exception 'Invalid admin theme input' using errcode = '22023';
  end if;
  select * into current_row from public.kitsnode_admin_theme_state where singleton = true for update;
  if not found then return jsonb_build_object('status','unavailable'); end if;
  if current_row.revision <> p_expected_revision then
    return jsonb_build_object('status','conflict','revision',current_row.revision);
  end if;
  if current_row.revision >= 9007199254740991 then return jsonb_build_object('status','unavailable'); end if;
  next_revision := current_row.revision + 1; stamp := clock_timestamp();
  update public.kitsnode_admin_theme_state set theme = p_theme, revision = next_revision, updated_at = stamp where singleton = true;
  insert into public.kitsnode_admin_theme_versions(revision,theme,actor,created_at) values(next_revision,p_theme,p_actor,stamp);
  return jsonb_build_object('status','ok','theme',p_theme,'revision',next_revision,'updatedAt',stamp);
end;
$$;
revoke all on function public.kitsnode_save_admin_theme(bigint,jsonb,text) from public, anon, authenticated;
grant execute on function public.kitsnode_save_admin_theme(bigint,jsonb,text) to service_role;
commit;
