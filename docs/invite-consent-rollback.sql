-- OPERATOR-REVIEWED ROLLBACK ONLY. Execute only after taking the consent
-- endpoint offline, validating that no reservation remains in flight, and
-- explicitly deciding what to do with recorded customer consent. Do not use as
-- automatic failure recovery: dropping the table deletes consent evidence.
drop function if exists public.kits_invite_release(uuid,uuid,uuid,text,text,text,uuid);
drop function if exists public.kits_invite_begin(uuid,uuid,uuid,text,text,text,uuid);
drop function if exists public.kits_invite_reserve(uuid,uuid,uuid,text,text,text,uuid);
drop function if exists public.kits_invite_record(uuid,uuid,uuid,text,text,text);
drop function if exists public.kits_invite_active_session(uuid,uuid);
drop function if exists kitsnode_ads_private.release_invite_consent_candidate(uuid,uuid,uuid,text,text,text,uuid);
drop function if exists kitsnode_ads_private.begin_invite_send_candidate(uuid,uuid,uuid,text,text,text,uuid);
drop function if exists kitsnode_ads_private.reserve_invite_consent_candidate(uuid,uuid,uuid,text,text,text,uuid);
drop function if exists kitsnode_ads_private.record_invite_consent_candidate(uuid,uuid,uuid,text,text,text);
drop table if exists kitsnode_ads_private.invite_consent_candidate;
