-- Record consent supplied with a new email signup only. Metadata is evidence of
-- the submitter's choice, not proof of identity or an authorization claim.
create or replace function kitsnode_member_private.record_signup_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_app_meta_data->>'provider' = 'email'
     and new.raw_user_meta_data->'kitsnode_consent' = jsonb_build_object(
       'termsVersion', '2026-11-14', 'privacyVersion', '2026-11-14-naver',
       'termsAccepted', true, 'privacyAcknowledged', true
     ) then
    insert into public.kitsnode_member_consents (user_id, terms_version, privacy_version)
    values (new.id, '2026-11-14', '2026-11-14-naver')
    on conflict (user_id, terms_version, privacy_version) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function kitsnode_member_private.record_signup_consent() from public, anon, authenticated;
create trigger kitsnode_record_signup_consent
after insert on auth.users
for each row execute function kitsnode_member_private.record_signup_consent();
