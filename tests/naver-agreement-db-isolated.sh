#!/usr/bin/env bash
set -euo pipefail
root_dir=$(cd "$(dirname "$0")/.." && pwd)
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/kitsnaver-db.XXXXXX")
cleanup() { pg_ctl -D "$tmp_dir/data" -m immediate stop >/dev/null 2>&1 || true; python3 -c 'import shutil,sys; shutil.rmtree(sys.argv[1],ignore_errors=True)' "$tmp_dir"; }
trap cleanup EXIT
initdb -D "$tmp_dir/data" --auth=trust --no-locale >/dev/null
pg_ctl -D "$tmp_dir/data" -l "$tmp_dir/server.log" -o "-k $tmp_dir -p 19387 -h ''" start >/dev/null
psql_cmd=(psql -X -v ON_ERROR_STOP=1 -h "$tmp_dir" -p 19387 postgres)
"${psql_cmd[@]}" >/dev/null <<'SQL'
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA kitsnode_member_private;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,not_after timestamptz);
CREATE TABLE auth.identities(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,provider text,identity_data jsonb);
CREATE TABLE kitsnode_member_private.deletion_access_blocks(subject_id uuid PRIMARY KEY);
CREATE TABLE public.kitsnode_member_consents(user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,terms_version text NOT NULL,privacy_version text NOT NULL,accepted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,terms_version,privacy_version));
SQL
"${psql_cmd[@]}" -f "$root_dir/supabase/migrations/20261123052714_naver_agreement_evidence_candidate.sql" >/dev/null
"${psql_cmd[@]}" >/dev/null <<'SQL'
INSERT INTO kitsnode_member_private.naver_agreement_versions(client_id,kind,document_version,term_code,effective_date) VALUES ('app','terms','v1','terms-v1','2026-11-23'),('app','privacy_ack','p1','privacy-v1','2026-11-23');
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
INSERT INTO auth.sessions VALUES ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001',NULL),('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000002',NULL);
INSERT INTO auth.identities VALUES ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000001','custom:naver','{"sub":"naver-a"}');
DO $$ DECLARE u uuid:='00000000-0000-4000-8000-000000000001'; s uuid:='00000000-0000-4000-8000-000000000011'; a jsonb:='[{"termCode":"terms-v1","agreeDate":"10:30:00.000 AM 11/25/2026"},{"termCode":"privacy-v1","agreeDate":"10:30:00.000 AM 11/25/2026"}]'; BEGIN
 IF has_function_privilege('authenticated','public.kits_naver_agreement_record_candidate(uuid,uuid,text,text,text,text,jsonb)','EXECUTE') OR has_function_privilege('anon','public.kits_naver_agreement_record_candidate(uuid,uuid,text,text,text,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'unexpected privilege'; END IF;
 IF public.kits_naver_agreement_record_candidate(u,'00000000-0000-4000-8000-000000000012','naver-a','v1','p1','app',a) THEN RAISE EXCEPTION 'wrong user session accepted'; END IF;
 IF public.kits_naver_agreement_record_candidate(u,s,'naver-b','v1','p1','app',a) THEN RAISE EXCEPTION 'wrong identity accepted'; END IF;
 INSERT INTO kitsnode_member_private.deletion_access_blocks VALUES(u);
 IF public.kits_naver_agreement_record_candidate(u,s,'naver-a','v1','p1','app',a) THEN RAISE EXCEPTION 'blocked account accepted'; END IF;
 DELETE FROM kitsnode_member_private.deletion_access_blocks WHERE subject_id=u;
 IF public.kits_naver_agreement_record_candidate(u,s,'naver-a','v1','p1','app','[{"termCode":"terms-v1","agreeDate":"10:30:00.000 AM 11/23/2026"},{"termCode":"privacy-v1","agreeDate":"10:30:00.000 AM 11/24/2026"}]') THEN RAISE EXCEPTION 'ambiguous effective date accepted'; END IF;
 IF public.kits_naver_agreement_record_candidate(u,s,'naver-a','v1','p1','app','[{"termCode":"terms-v1","agreeDate":"10:30:00.000 AM 11/24/2026"},{"termCode":"privacy-v1","agreeDate":"10:30:00.000 AM 11/24/2026"}]') THEN RAISE EXCEPTION 'ambiguous next date accepted'; END IF;
 IF public.kits_naver_agreement_record_candidate(u,s,'naver-a','v2','p1','app',a) THEN RAISE EXCEPTION 'unmapped version accepted'; END IF;
 IF public.kits_naver_agreement_record_candidate(u,s,'naver-a','v1','p1','other-app',a) THEN RAISE EXCEPTION 'wrong app accepted'; END IF;
 BEGIN UPDATE kitsnode_member_private.naver_agreement_versions SET document_version='v2' WHERE kind='terms'; RAISE EXCEPTION 'mutable mapping'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'naver_version_mapping_is_immutable' THEN RAISE; END IF; END;
 BEGIN INSERT INTO kitsnode_member_private.naver_agreement_versions(client_id,kind,document_version,term_code,effective_date) VALUES ('app','terms','v2','terms-v1','2026-11-24'); RAISE EXCEPTION 'reused code'; EXCEPTION WHEN unique_violation THEN NULL; END;
 IF NOT public.kits_naver_agreement_record_candidate(u,s,'naver-a','v1','p1','app',a) THEN RAISE EXCEPTION 'valid rejected'; END IF;
 IF (SELECT count(*) FROM kitsnode_member_private.naver_agreement_evidence)<>1 OR (SELECT count(*) FROM public.kitsnode_member_consents)<>1 THEN RAISE EXCEPTION 'missing evidence'; END IF;
 DELETE FROM auth.sessions WHERE id=s;
 IF public.kits_naver_agreement_record_candidate(u,s,'naver-a','v2','p2','app',a) THEN RAISE EXCEPTION 'revoked session accepted'; END IF;
 DELETE FROM auth.users WHERE id=u;
 IF EXISTS(SELECT 1 FROM kitsnode_member_private.naver_agreement_evidence) OR EXISTS(SELECT 1 FROM public.kitsnode_member_consents) THEN RAISE EXCEPTION 'cascade failed'; END IF;
END $$;
SQL
printf '%s\n' 'Isolated PostgreSQL verified scoped consent evidence, revoked sessions, privileges and deletion cascade.'
