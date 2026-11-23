#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
name="kits-signup-cutoff-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || :; }
trap cleanup EXIT HUP INT TERM
docker run -d --name "$name" --network none --memory 512m -e POSTGRES_PASSWORD=local-only-password -e POSTGRES_DB=postgres public.ecr.aws/supabase/postgres:17.12.0.000 postgres -D /etc/postgresql >/dev/null
ready=0
for i in $(seq 1 60); do
 if docker logs "$name" 2>&1 | grep -q 'PostgreSQL init process complete; ready for start up' && docker exec "$name" pg_isready -U supabase_admin -d postgres >/dev/null 2>&1; then ready=1;break;fi
 if [ "$(docker inspect -f '{{.State.Running}}' "$name")" != true ]; then echo 'Database stopped during startup' >&2;exit 1;fi
 sleep 1
done
[ "$ready" = 1 ] || { echo 'Database startup timed out' >&2;exit 1; }
docker cp "$root/supabase/migrations/20261123011803_email_signup_cutoff_gate.sql" "$name:/tmp/cutoff-gate.sql"
docker exec -i "$name" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < "$root/tests/sql/signup-cutoff-gate.sql" >/dev/null
echo 'Signup cutoff SQL checks passed'
