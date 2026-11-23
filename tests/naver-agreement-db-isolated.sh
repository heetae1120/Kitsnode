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
"${psql_cmd[@]}" -f "$root_dir/supabase/migrations/20261123064230_naver_agreement_evidence.sql" >/dev/null
"${psql_cmd[@]}" -f "$root_dir/supabase/migrations/20261123064238_naver_agreement_mapping.sql" >/dev/null
"${psql_cmd[@]}" >/dev/null <<'SQL'
INSERT INTO kitsnode_member_private.naver_agreement_versions(client_id,kind,document_version,term_code,effective_date) VALUES ('app','terms','v1','kits_terms_0123456789abcdef01234567','2020-01-01'),('app','privacy_ack','p1','kits_privacy_0123456789abcdef01234567','2020-01-01');
INSERT INTO kitsnode_member_private.naver_agreement_versions(client_id,kind,document_version,term_code,effective_date)
VALUES ('app','terms','today','kits_terms_aaaaaaaaaaaaaaaaaaaaaaaa',(now() AT TIME ZONE 'Asia/Seoul')::date),('app','privacy_ack','today','kits_privacy_bbbbbbbbbbbbbbbbbbbbbbbb',(now() AT TIME ZONE 'Asia/Seoul')::date),('app','terms','future','kits_terms_cccccccccccccccccccccccc',(now() AT TIME ZONE 'Asia/Seoul')::date+1);
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
INSERT INTO auth.sessions VALUES ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001',NULL),('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000002',NULL);
INSERT INTO auth.identities VALUES ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000001','custom:naver','{"sub":"naver-a"}');
DO $$ DECLARE u uuid:='00000000-0000-4000-8000-000000000001'; s uuid:='00000000-0000-4000-8000-000000000011'; a jsonb:='[{"termCode":"kits_terms_0123456789abcdef01234567","agreeDate":"10:30:00.000 AM 01/03/2020"},{"termCode":"kits_privacy_0123456789abcdef01234567","agreeDate":"10:30:00.000 AM 01/03/2020"}]'; BEGIN
 IF has_function_privilege('authenticated','public.kits_naver_agreement_record_candidate(uuid,uuid,text,text,text,text,jsonb)','EXECUTE') OR has_function_privilege('anon','public.kits_naver_agreement_record_candidate(uuid,uuid,text,text,text,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'unexpected privilege'; END IF;
 IF public.kits_naver_agreement_record_candidate(u,'00000000-0000-4000-8000-000000000012','naver-a','v1','p1','app',a) THEN RAISE EXCEPTION 'wrong user session accepted'; END IF;
 IF public.kits_naver_agreement_record_candidate(u,s,'naver-b','v1','p1','app',a) THEN RAISE EXCEPTION 'wrong identity accepted'; END IF;
 INSERT INTO kitsnode_member_private.deletion_access_blocks VALUES(u);
 IF public.kits_naver_agreement_record_candidate(u,s,'naver-a','v1','p1','app',a) THEN RAISE EXCEPTION 'blocked account accepted'; END IF;
 DELETE FROM kitsnode_member_private.deletion_access_blocks WHERE subject_id=u;
 IF NOT public.kits_naver_agreement_record_candidate(u,s,'naver-a','today','today','app',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('termCode','kits_terms_aaaaaaaaaaaaaaaaaaaaaaaa','agreeDate','10:30:00.000 AM '||pg_catalog.to_char(pg_catalog.clock_timestamp() AT TIME ZONE 'UTC','MM/DD/YYYY')),pg_catalog.jsonb_build_object('termCode','kits_privacy_bbbbbbbbbbbbbbbbbbbbbbbb','agreeDate','10:30:00.000 AM '||pg_catalog.to_char(pg_catalog.clock_timestamp() AT TIME ZONE 'UTC','MM/DD/YYYY')))) THEN RAISE EXCEPTION 'same-day evidence rejected'; END IF;
 IF public.kits_naver_agreement_record_candidate(u,s,'naver-a','future','today','app','[{"termCode":"kits_terms_cccccccccccccccccccccccc","agreeDate":"10:30:00.000 AM 01/03/2020"},{"termCode":"kits_privacy_bbbbbbbbbbbbbbbbbbbbbbbb","agreeDate":"10:30:00.000 AM 01/03/2020"}]') THEN RAISE EXCEPTION 'future document accepted'; END IF;
 DELETE FROM public.kitsnode_member_consents WHERE user_id=u AND terms_version='today';
 IF public.kits_naver_agreement_record_candidate(u,s,'naver-a','v2','p1','app',a) THEN RAISE EXCEPTION 'unmapped version accepted'; END IF;
 IF public.kits_naver_agreement_record_candidate(u,s,'naver-a','v1','p1','other-app',a) THEN RAISE EXCEPTION 'wrong app accepted'; END IF;
 BEGIN UPDATE kitsnode_member_private.naver_agreement_versions SET document_version='v2' WHERE kind='terms'; RAISE EXCEPTION 'mutable mapping'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'naver_version_mapping_is_immutable' THEN RAISE; END IF; END;
 BEGIN INSERT INTO kitsnode_member_private.naver_agreement_versions(client_id,kind,document_version,term_code,effective_date) VALUES ('app','terms','v2','kits_terms_0123456789abcdef01234567','2020-01-02'); RAISE EXCEPTION 'reused code'; EXCEPTION WHEN unique_violation THEN NULL; END;
 IF NOT public.kits_naver_agreement_record_candidate(u,s,'naver-a','v1','p1','app',a) THEN RAISE EXCEPTION 'valid rejected'; END IF;
 IF (SELECT count(*) FROM kitsnode_member_private.naver_agreement_evidence)<>1 OR (SELECT count(*) FROM public.kitsnode_member_consents)<>1 THEN RAISE EXCEPTION 'missing evidence'; END IF;
 DELETE FROM auth.sessions WHERE id=s;
 IF public.kits_naver_agreement_record_candidate(u,s,'naver-a','v2','p2','app',a) THEN RAISE EXCEPTION 'revoked session accepted'; END IF;
 DELETE FROM auth.users WHERE id=u;
 IF EXISTS(SELECT 1 FROM kitsnode_member_private.naver_agreement_evidence) OR EXISTS(SELECT 1 FROM public.kitsnode_member_consents) THEN RAISE EXCEPTION 'cascade failed'; END IF;
END $$;
SQL
"${psql_cmd[@]}" >/dev/null <<'SQL'
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000003');
INSERT INTO auth.sessions VALUES ('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000003',NULL),('00000000-0000-4000-8000-000000000032','00000000-0000-4000-8000-000000000003',NULL);
INSERT INTO auth.identities VALUES ('00000000-0000-4000-8000-000000000033','00000000-0000-4000-8000-000000000003','custom:naver','{"sub":"naver-c"}');
SQL
for session_suffix in 31 32; do
 "${psql_cmd[@]}" -At -c "BEGIN; SELECT public.kits_naver_agreement_record_candidate('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-0000000000${session_suffix}','naver-c','v1','p1','app','[{\"termCode\":\"kits_terms_0123456789abcdef01234567\",\"agreeDate\":\"10:30:00.000 AM 01/03/2020\"},{\"termCode\":\"kits_privacy_0123456789abcdef01234567\",\"agreeDate\":\"10:30:00.000 AM 01/03/2020\"}]'::jsonb); SELECT pg_sleep(0.2); COMMIT;" >"$tmp_dir/result-$session_suffix" &
done
wait
for session_suffix in 31 32; do rg -q '^t$' "$tmp_dir/result-$session_suffix"; done
"${psql_cmd[@]}" >/dev/null <<'SQL'
DO $$ BEGIN
 IF (SELECT count(*) FROM public.kitsnode_member_consents WHERE user_id='00000000-0000-4000-8000-000000000003')<>1 OR (SELECT count(*) FROM kitsnode_member_private.naver_agreement_evidence WHERE user_id='00000000-0000-4000-8000-000000000003')<>1 THEN RAISE EXCEPTION 'concurrent evidence duplicated'; END IF;
END $$;
DELETE FROM auth.users WHERE id='00000000-0000-4000-8000-000000000003';
SQL
printf '%s\n' 'Isolated PostgreSQL verified scoped consent evidence, revoked sessions, privileges and deletion cascade.'
