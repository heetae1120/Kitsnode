#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
name="kits-username-concurrency-$$-$(date +%s)"
cleanup() { status=$?; if [ "$status" -ne 0 ]; then docker inspect -f 'running={{.State.Running}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}}' "$name" 2>/dev/null || :; docker logs --tail 40 "$name" 2>&1 || :; fi; docker rm -f "$name" >/dev/null 2>&1 || :; }
trap cleanup EXIT HUP INT TERM
docker run -d --name "$name" --network none --memory 768m -e POSTGRES_PASSWORD=local-only-password -e POSTGRES_DB=postgres public.ecr.aws/supabase/postgres:17.12.0.000 postgres -D /etc/postgresql >/dev/null
ready=0
for i in $(seq 1 60); do
 # During first boot pg_isready succeeds against the temporary init server,
 # which entrypoint deliberately shuts down after applying image migrations.
 # Wait until the image's temporary init server has stopped and the entrypoint
 # has emitted its completion marker, then check the final server is ready.
 if docker logs "$name" 2>&1 | grep -q 'PostgreSQL init process complete; ready for start up' && docker exec "$name" pg_isready -U supabase_admin -d postgres >/dev/null 2>&1; then ready=1;break;fi
 if [ "$(docker inspect -f '{{.State.Running}}' "$name")" != true ]; then echo 'Database stopped during startup' >&2;docker logs --tail 30 "$name" >&2;exit 1;fi
 sleep 1
done
[ "$ready" = 1 ] || { echo 'Database startup timed out' >&2;exit 1; }
docker cp "$root/supabase/migrations/20261121180546_username_login_service.sql" "$name:/tmp/username-base.sql"
docker cp "$root/supabase/migrations/20261123013537_username_server_managed_limits.sql" "$name:/tmp/username-managed.sql"
docker exec -i "$name" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < "$root/tests/sql/username-managed-limits.sql" >/dev/null
docker exec "$name" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c 'TRUNCATE kitsnode_member_private.username_login_limits' >/dev/null

# Run and wait for all subprocesses *inside the container*; xargs propagates
# failed commands. This prevents cleanup from racing detached docker exec jobs.
same=$(docker exec -i "$name" sh -s <<'INNER'
seq 1 20 | xargs -P 20 -I# psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -Atqc "SELECT public.kitsnode_consume_username_limit_auto('login','same_user')"
INNER
)
[ "$(printf '%s\n' "$same" | grep -c '^t$')" -eq 5 ] || { echo 'Concurrent subject limit incorrect' >&2;exit 1; }
[ "$(printf '%s\n' "$same" | grep -c '^f$')" -eq 15 ] || { echo 'Concurrent subject response count incorrect' >&2;exit 1; }
docker exec "$name" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c 'TRUNCATE kitsnode_member_private.username_login_limits' >/dev/null
distinct=$(docker exec -i "$name" sh -s <<'INNER'
seq 1 120 | xargs -P 20 -I# psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -Atqc "SELECT public.kitsnode_consume_username_limit_auto('login','test_user_#')"
INNER
)
[ "$(printf '%s\n' "$distinct" | grep -c '^t$')" -eq 100 ] || { echo 'Concurrent global limit incorrect' >&2;exit 1; }
[ "$(printf '%s\n' "$distinct" | grep -c '^f$')" -eq 20 ] || { echo 'Concurrent global response count incorrect' >&2;exit 1; }
count=$(docker exec "$name" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -Atqc "select count(*) from kitsnode_member_private.username_login_limits where kind='login' and scope='subject'")
[ "$count" -eq 100 ] || { echo 'Rejected requests created subject rows' >&2;exit 1; }
distinct_availability=$(docker exec -i "$name" sh -s <<'INNER'
seq 1 320 | xargs -P 20 -I# psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -Atqc "SELECT public.kitsnode_consume_username_limit_auto('availability','test_user_#')"
INNER
)
[ "$(printf '%s\n' "$distinct_availability" | grep -c '^t$')" -eq 300 ] || { echo 'Concurrent availability limit incorrect' >&2;exit 1; }
[ "$(printf '%s\n' "$distinct_availability" | grep -c '^f$')" -eq 20 ] || { echo 'Concurrent availability response count incorrect' >&2;exit 1; }
echo 'Concurrent username limits passed'
