-- Optional business name; existing members remain unchanged.
alter table public.kitsnode_email_profiles add column company text
 check (company is null or (char_length(company) between 1 and 100 and company !~ '[[:cntrl:]]'));

-- Reuse the existing verified-session, current-consent and unique-username
-- checks. A collision rolls back before any company field is saved.
create function public.kitsnode_complete_email_profile_with_company(
 p_expected_user uuid,p_username text,p_name text,p_phone text,p_company text,p_age_confirmed boolean
) returns text language plpgsql security definer set search_path='' as $$
declare result text; company_value text:=nullif(btrim(coalesce(p_company,'')),''); stored_company text;
begin
 if p_expected_user is null or (select auth.uid()) is distinct from p_expected_user then return 'verification_required'; end if;
 if company_value is not null and (char_length(company_value)>100 or company_value ~ '[[:cntrl:]]') then return 'invalid_input'; end if;
 result:=public.kitsnode_complete_email_profile(p_username,p_name,p_phone,p_age_confirmed);
 if result='created' then
  update public.kitsnode_email_profiles set company=company_value where user_id=(select auth.uid());
  if not found then raise exception 'profile_not_created'; end if;
 elsif result='already_registered' then
  select company into stored_company from public.kitsnode_email_profiles where user_id=(select auth.uid());
  if stored_company is distinct from company_value then return 'profile_exists'; end if;
 end if;
 return result;
end $$;
revoke all on function public.kitsnode_complete_email_profile_with_company(uuid,text,text,text,text,boolean) from public,anon;
grant execute on function public.kitsnode_complete_email_profile_with_company(uuid,text,text,text,text,boolean) to authenticated;
