CREATE FUNCTION public.withdraw_test_seed_naver(p_user uuid,p_provider_id text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) VALUES(p_provider_id,p_user,jsonb_build_object('sub',p_provider_id),'custom:naver',now(),now())
$$;
CREATE FUNCTION public.withdraw_test_naver_count(p_provider_id text) RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT count(*) FROM auth.identities WHERE provider='custom:naver' AND provider_id=p_provider_id $$;
REVOKE ALL ON FUNCTION public.withdraw_test_seed_naver(uuid,text),public.withdraw_test_naver_count(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_test_seed_naver(uuid,text),public.withdraw_test_naver_count(text) TO service_role;
NOTIFY pgrst, 'reload schema';
