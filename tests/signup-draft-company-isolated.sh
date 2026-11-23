#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
name="kits-signup-company-$$-$(date +%s)"
cleanup(){ docker rm -f "$name" >/dev/null 2>&1 || :; }
trap cleanup EXIT HUP INT TERM
docker run -d --name "$name" --network none --memory 512m -e POSTGRES_PASSWORD=local-only-password -e POSTGRES_DB=postgres public.ecr.aws/supabase/postgres:17.12.0.000 postgres -D /etc/postgresql >/dev/null
ready=0
for i in $(seq 1 90); do
 if docker logs "$name" 2>&1 | grep -q 'PostgreSQL init process complete; ready for start up' && docker exec "$name" pg_isready -U supabase_admin -d postgres >/dev/null 2>&1; then ready=1;break;fi
 if [ "$(docker inspect -f '{{.State.Running}}' "$name")" != true ]; then echo 'Database exited during startup' >&2;exit 1;fi
 sleep 1
done
[ "$ready" = 1 ] || { echo 'Database readiness timed out' >&2;exit 1; }
docker exec -i "$name" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
do $$begin
 if exists(select 1 from pg_event_trigger where evtname='graphql_watch_drop') then alter event trigger graphql_watch_drop disable; end if;
 if exists(select 1 from pg_event_trigger where evtname='graphql_watch_ddl') then alter event trigger graphql_watch_ddl disable; end if;
end$$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create table public.kitsnode_email_profiles(user_id uuid primary key,username text unique,name text,phone text);
create function public.kitsnode_complete_email_profile(u text,n text,p text,a boolean) returns text language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not a then return 'verification_required'; end if;
 if exists(select 1 from public.kitsnode_email_profiles where user_id=(select auth.uid()) and username=u and name=n and phone=p) then return 'already_registered'; end if;
 begin insert into public.kitsnode_email_profiles values((select auth.uid()),u,n,p); exception when unique_violation then return 'username_taken'; end;
 return 'created';
end $$;
SQL
docker exec -i "$name" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 <"$root/supabase/migrations/20261123034607_add_email_profile_company.sql" >/dev/null
docker exec -i "$name" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
do $$begin
 if has_function_privilege('anon','public.kitsnode_complete_email_profile_with_company(uuid,text,text,text,text,boolean)','execute') then raise exception 'anonymous execution allowed'; end if;
 if not has_function_privilege('authenticated','public.kitsnode_complete_email_profile_with_company(uuid,text,text,text,text,boolean)','execute') then raise exception 'authenticated execution denied'; end if;
end$$;
set role authenticated;
select set_config('test.uid','11111111-1111-4111-8111-111111111111',false);
do $$declare r text;begin
 r:=public.kitsnode_complete_email_profile_with_company('22222222-2222-4222-8222-222222222222','seller_one','Synthetic','01012345678','',true);
 if r<>'verification_required' then raise exception 'identity mismatch allowed'; end if;
 r:=public.kitsnode_complete_email_profile_with_company('11111111-1111-4111-8111-111111111111','seller_one','Synthetic','01012345678','Example Ltd',true);
 if r<>'created' then raise exception 'profile not created'; end if;
 r:=public.kitsnode_complete_email_profile_with_company('11111111-1111-4111-8111-111111111111','seller_one','Synthetic','01012345678','Example Ltd',true);
 if r<>'already_registered' then raise exception 'retry not idempotent'; end if;
 r:=public.kitsnode_complete_email_profile_with_company('11111111-1111-4111-8111-111111111111','seller_one','Synthetic','01012345678',repeat('x',101),true);
 if r<>'invalid_input' then raise exception 'invalid company accepted'; end if;
end$$;
select set_config('test.uid','22222222-2222-4222-8222-222222222222',false);
do $$declare r text;begin
 r:=public.kitsnode_complete_email_profile_with_company('22222222-2222-4222-8222-222222222222','seller_one','Synthetic','01012345678','',true);
 if r<>'username_taken' then raise exception 'duplicate username accepted'; end if;
end$$;
reset role;
do $$begin
 if (select company from public.kitsnode_email_profiles where username='seller_one')<>'Example Ltd' then raise exception 'company absent'; end if;
 if (select count(*) from public.kitsnode_email_profiles)<>1 then raise exception 'unexpected profile'; end if;
end$$;
SQL
echo 'Profile company and identity checks passed'
