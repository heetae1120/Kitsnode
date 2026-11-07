-- KITSNODE only. No direct Data API access is granted to anon or authenticated.
create table public.kitsnode_layout_state (
  singleton boolean primary key default true check (singleton),
  published_revision bigint not null default 0,
  published jsonb not null default '{}'::jsonb,
  draft_revision bigint not null default 0,
  draft_base_revision bigint not null default 0,
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.kitsnode_layout_versions (
  revision bigint primary key,
  content jsonb not null,
  actor text not null,
  created_at timestamptz not null default now()
);
alter table public.kitsnode_layout_state enable row level security;
alter table public.kitsnode_layout_versions enable row level security;
revoke all on public.kitsnode_layout_state, public.kitsnode_layout_versions from public, anon, authenticated;
grant select, insert, update on public.kitsnode_layout_state to service_role;
grant select, insert on public.kitsnode_layout_versions to service_role;

create function public.kitsnode_save_draft(p_expected_draft bigint, p_expected_published bigint, p_content jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_row public.kitsnode_layout_state%rowtype;
begin
  select * into current_row from public.kitsnode_layout_state where singleton = true for update;
  if not found then return jsonb_build_object('status','not_initialized'); end if;
  if current_row.draft_revision <> p_expected_draft or current_row.published_revision <> p_expected_published then
    return jsonb_build_object('status','conflict','draftRevision',current_row.draft_revision,'publishedRevision',current_row.published_revision);
  end if;
  update public.kitsnode_layout_state set draft=p_content, draft_revision=draft_revision+1, draft_base_revision=published_revision, updated_at=now() where singleton=true returning * into current_row;
  return jsonb_build_object('status','ok','draftRevision',current_row.draft_revision,'publishedRevision',current_row.published_revision);
end $$;

create function public.kitsnode_publish_draft(p_expected_draft bigint, p_expected_published bigint, p_actor text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_row public.kitsnode_layout_state%rowtype;
begin
  select * into current_row from public.kitsnode_layout_state where singleton = true for update;
  if not found then return jsonb_build_object('status','not_initialized'); end if;
  if current_row.draft_revision <> p_expected_draft or current_row.published_revision <> p_expected_published or current_row.draft_base_revision <> current_row.published_revision then
    return jsonb_build_object('status','conflict','draftRevision',current_row.draft_revision,'publishedRevision',current_row.published_revision);
  end if;
  update public.kitsnode_layout_state set published=draft, published_revision=published_revision+1, draft_base_revision=published_revision+1, draft_revision=draft_revision+1, updated_at=now() where singleton=true returning * into current_row;
  insert into public.kitsnode_layout_versions(revision,content,actor) values(current_row.published_revision,current_row.published,p_actor);
  return jsonb_build_object('status','ok','draftRevision',current_row.draft_revision,'publishedRevision',current_row.published_revision,'updatedAt',current_row.updated_at);
end $$;
revoke all on function public.kitsnode_save_draft(bigint,bigint,jsonb) from public, anon, authenticated;
revoke all on function public.kitsnode_publish_draft(bigint,bigint,text) from public, anon, authenticated;
grant execute on function public.kitsnode_save_draft(bigint,bigint,jsonb) to service_role;
grant execute on function public.kitsnode_publish_draft(bigint,bigint,text) to service_role;
