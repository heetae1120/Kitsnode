CREATE SCHEMA kitsnode_member_private;CREATE SCHEMA kitsnode_ads_private;CREATE SCHEMA kitsnode_ads_test_20261117;CREATE SCHEMA kits_ai_private;
CREATE TABLE kitsnode_ads_private.connections(id uuid PRIMARY KEY,user_id uuid NOT NULL,status text NOT NULL,write_verified boolean NOT NULL,approved_by uuid,revision bigint NOT NULL DEFAULT 0,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE kitsnode_ads_test_20261117.connections(id uuid PRIMARY KEY,user_id uuid NOT NULL);
CREATE TABLE kitsnode_ads_private.rules(id uuid PRIMARY KEY,connection_id uuid REFERENCES kitsnode_ads_private.connections(id),enabled boolean NOT NULL,version bigint NOT NULL DEFAULT 0);
CREATE TABLE kitsnode_ads_private.attempts(id uuid PRIMARY KEY,rule_id uuid REFERENCES kitsnode_ads_private.rules(id),owner_id uuid NOT NULL,state text NOT NULL);
CREATE TABLE kitsnode_ads_private.attempt_events(id uuid PRIMARY KEY,attempt_id uuid REFERENCES kitsnode_ads_private.attempts(id));
CREATE TABLE kitsnode_ads_private.shopping_shadow_rules(id uuid PRIMARY KEY,connection_id uuid REFERENCES kitsnode_ads_private.connections(id));
CREATE TABLE kitsnode_ads_private.shopping_shadow_history(id uuid PRIMARY KEY,rule_id uuid REFERENCES kitsnode_ads_private.shopping_shadow_rules(id));
CREATE TABLE kitsnode_ads_private.master_report_cooldowns(connection_id uuid REFERENCES kitsnode_ads_private.connections(id));
CREATE TABLE kitsnode_ads_private.ownership_evidence(connection_id uuid REFERENCES kitsnode_ads_private.connections(id),user_id uuid,recorded_by uuid,revoked_by uuid);
CREATE TABLE kitsnode_ads_private.request_limits(user_id uuid);
CREATE TABLE kitsnode_ads_private.shadow_schedule_claims(id uuid PRIMARY KEY,connection_id uuid REFERENCES kitsnode_ads_private.connections(id),rule_id uuid REFERENCES kitsnode_ads_private.shopping_shadow_rules(id),entry_id uuid REFERENCES kitsnode_ads_private.shopping_shadow_history(id),state text NOT NULL);
CREATE TABLE public.kitsnode_member_consents(user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE public.staff_memberships(user_id uuid PRIMARY KEY,registered_by uuid,legacy_user_id uuid);
CREATE TABLE public.staff_store_grants(user_id uuid PRIMARY KEY REFERENCES public.staff_memberships(user_id),granted_by uuid);
CREATE TABLE public.staff_jobs(id uuid PRIMARY KEY,owner_user_id uuid REFERENCES public.staff_store_grants(user_id));
CREATE TABLE public.staff_results(id uuid PRIMARY KEY,job_id uuid REFERENCES public.staff_jobs(id),owner_user_id uuid NOT NULL);
CREATE TABLE kits_ai_private.staff(user_id uuid PRIMARY KEY);
CREATE TABLE kits_ai_private.tasks(id uuid PRIMARY KEY,requester_id uuid REFERENCES kits_ai_private.staff(user_id));
CREATE TABLE kits_ai_private.task_events(id uuid PRIMARY KEY,task_id uuid REFERENCES kits_ai_private.tasks(id),actor_id uuid);
CREATE TABLE kits_ai_private.unikim_mac_transfer_grants(user_id uuid);
CREATE FUNCTION public.withdraw_test_seed(p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE conn uuid:=gen_random_uuid();ruleid uuid:=gen_random_uuid(); BEGIN
 INSERT INTO public.kitsnode_member_consents VALUES(p_user);
 INSERT INTO kitsnode_ads_private.connections(id,user_id,status,write_verified) VALUES(conn,p_user,'read_connected',true);
 INSERT INTO kitsnode_ads_private.rules(id,connection_id,enabled) VALUES(ruleid,conn,true);
 INSERT INTO public.staff_memberships(user_id,registered_by) VALUES(p_user,p_user);
 INSERT INTO public.staff_store_grants(user_id,granted_by) VALUES(p_user,p_user);
 INSERT INTO kits_ai_private.staff(user_id) VALUES(p_user);
END $$;
REVOKE ALL ON FUNCTION public.withdraw_test_seed(uuid) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.withdraw_test_seed(uuid) TO service_role;

CREATE TABLE public.staff_companies(id uuid);
CREATE TABLE public.staff_stores(id uuid);
