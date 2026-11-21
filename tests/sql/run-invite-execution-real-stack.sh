#!/bin/sh
# Disposable local-only stack; no hosted Supabase, real account or external SMTP.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
prefix="kits-invite-test-$$-$(date +%s)"
net="$prefix-net"; db="$prefix-db"; auth="$prefix-auth"; rest="$prefix-rest"
cleanup(){ docker stop "$rest" "$auth" "$db" >/dev/null 2>&1 || :; docker network rm "$net" >/dev/null 2>&1 || :; }
trap cleanup EXIT HUP INT TERM
for image in public.ecr.aws/supabase/gotrue:v2.198.0 public.ecr.aws/supabase/postgres:17.12.0.000 public.ecr.aws/supabase/postgrest:v16.5; do docker image inspect "$image" >/dev/null; done
docker network create "$net" >/dev/null
docker run --rm -d --name "$db" --network "$net" --network-alias db --memory 768m -e POSTGRES_PASSWORD=local-only-password -e POSTGRES_DB=postgres public.ecr.aws/supabase/postgres:17.12.0.000 postgres -D /etc/postgresql -c listen_addresses='*' >/dev/null
ready=0
for i in $(seq 1 90); do if docker exec "$db" pg_isready -h db -p 5432 -U supabase_admin -d postgres >/dev/null 2>&1 && docker exec -e PGPASSWORD=local-only-password "$db" psql -h db -p 5432 -U supabase_admin -d postgres -Atqc 'select 1' 2>/dev/null | grep -qx 1; then ready=1; break; fi; sleep 1; done
[ "$ready" = 1 ] || { echo 'Disposable PostgreSQL did not start' >&2; exit 1; }
docker run --rm -d --name "$auth" --network "$net" --network-alias auth -p 127.0.0.1::9999 \
 -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e API_EXTERNAL_URL=http://auth:9999 \
 -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_DATABASE_URL='postgres://supabase_admin:local-only-password@db:5432/postgres?sslmode=disable' \
 -e GOTRUE_SITE_URL=http://localhost -e GOTRUE_JWT_SECRET=local-test-only-secret-key-at-least-thirty-two-characters -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_AUD=authenticated -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
 -e GOTRUE_DISABLE_SIGNUP=false -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=true public.ecr.aws/supabase/gotrue:v2.198.0 >/dev/null
ready=0
for i in $(seq 1 45); do if docker exec "$db" curl -fsS http://auth:9999/health >/dev/null 2>&1; then ready=1;break;fi; sleep 1; done
[ "$ready" = 1 ] || { echo 'Disposable Supabase Auth did not start' >&2;exit 1; }
docker exec -i "$db" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create role test_invite_authenticator noinherit login password 'local-postgrest-only-password';
grant anon,authenticated,service_role to test_invite_authenticator;
create schema kitsnode_ads_private;
create table public.kitsnode_member_consents(user_id uuid not null references auth.users(id) on delete cascade,terms_version text not null,privacy_version text not null,accepted_at timestamptz not null default now());
grant select on public.kitsnode_member_consents to service_role;
create table kitsnode_ads_private.connections(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,ad_account_id text not null,status text not null,revision bigint not null default 0);
create function public.kits_test_connection(p_id uuid,p_user uuid,p_account text) returns boolean language plpgsql security definer set search_path=pg_catalog as $$ begin insert into kitsnode_ads_private.connections(id,user_id,ad_account_id,status) values(p_id,p_user,p_account,'pending_review'); insert into public.kitsnode_member_consents(user_id,terms_version,privacy_version) values(p_user,'2026-11-14','2026-11-14-naver');return true;end $$;
create function public.kits_ads_rate_limit(p_user_id uuid) returns boolean language sql as $$ select true $$;
create function public.kits_test_revoke(p_user uuid) returns boolean language plpgsql security definer set search_path=pg_catalog as $$ begin delete from public.kitsnode_member_consents where user_id=p_user;return true;end $$;
create function public.kits_ads_list(p_user_id uuid) returns table(request_id uuid,ad_account_id text,status text,revision bigint) language sql security definer set search_path=pg_catalog as $$ select id,ad_account_id,status,revision from kitsnode_ads_private.connections where user_id=p_user_id $$;
revoke all on function public.kits_test_connection(uuid,uuid,text),public.kits_test_revoke(uuid) from public,anon,authenticated;
revoke all on function public.kits_ads_list(uuid) from public,anon,authenticated;
grant execute on function public.kits_test_connection(uuid,uuid,text),public.kits_test_revoke(uuid),public.kits_ads_list(uuid),public.kits_ads_rate_limit(uuid) to service_role;
SQL
docker exec -i "$db" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < "$root/supabase/migrations/20261121055943_kitsnode_invite_consent_recording.sql" >/dev/null
docker exec -i "$db" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < "$root/supabase/migrations/20261121100734_invite_execution_consent.sql" >/dev/null
docker run --rm -d --name "$rest" --network "$net" --network-alias api -p 127.0.0.1::3000 \
 -e PGRST_DB_URI='postgres://test_invite_authenticator:local-postgrest-only-password@db:5432/postgres' -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET=local-test-only-secret-key-at-least-thirty-two-characters public.ecr.aws/supabase/postgrest:v16.5 >/dev/null
ready=0
for i in $(seq 1 45); do if docker exec "$db" curl -fsS http://api:3000/ >/dev/null 2>&1; then ready=1;break;fi; sleep 1; done
[ "$ready" = 1 ] || { echo 'Disposable PostgREST did not start' >&2;exit 1; }
auth_port=$(docker port "$auth" 9999/tcp | sed -n 's/.*:\([0-9]*\)$/\1/p' | head -1)
rest_port=$(docker port "$rest" 3000/tcp | sed -n 's/.*:\([0-9]*\)$/\1/p' | head -1)
[ -n "$auth_port" ] && [ -n "$rest_port" ] || { echo 'Loopback binding missing' >&2;exit 1; }
KITS_TEST_EXTENSION="file://$root/../invite-auto-improve/browser-extension/naver-invite-preflight/consent-proof-bridge-v2-candidate.mjs" KITS_TEST_SUPABASE_MODULE="$root/../advertiser-dashboard/node_modules/@supabase/supabase-js" KITS_TEST_AUTH_URL="http://127.0.0.1:$auth_port" KITS_TEST_REST_URL="http://127.0.0.1:$rest_port" KITS_TEST_JWT_SECRET='local-test-only-secret-key-at-least-thirty-two-characters' node --test "$root/tests/invite-execution-real-stack.test.mjs"
