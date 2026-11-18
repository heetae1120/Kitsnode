-- ISOLATED TEST ONLY; no production migration. Owner IDs must be supplied by a
-- trusted service after session and advertisement-target authorization.
create schema rank_tracking_test;
create table rank_tracking_test.trackings (
 tracking_id uuid primary key, user_id uuid not null, connection_id uuid not null,
 target_id text not null, version integer not null default 0 check(version >= 0),
 tracking jsonb not null check(tracking->>'mode'='simulation'),
 unique (user_id,connection_id,target_id,tracking_id)
);
create table rank_tracking_test.requests (
 tracking_id uuid not null references rank_tracking_test.trackings(tracking_id),
 request_id uuid not null, primary key(tracking_id,request_id)
);
create index rank_tracking_owner_idx on rank_tracking_test.trackings(user_id,connection_id,target_id,tracking_id);
create function rank_tracking_test.commit_observation(p_user uuid,p_connection uuid,p_target text,p_tracking uuid,p_request uuid,p_expected integer,p_tracking_data jsonb) returns text
language plpgsql set search_path='' as $$
declare r rank_tracking_test.trackings%rowtype;
begin
 select * into r from rank_tracking_test.trackings where tracking_id=p_tracking and user_id=p_user and connection_id=p_connection and target_id=p_target for update;
 if not found then return 'not_found'; end if;
 if exists(select 1 from rank_tracking_test.requests where tracking_id=p_tracking and request_id=p_request) then return 'duplicate'; end if;
 if r.version<>p_expected then return 'conflict'; end if;
 if p_tracking_data->>'mode' is distinct from 'simulation' or p_tracking_data->>'id' is distinct from p_tracking::text then return 'invalid'; end if;
 insert into rank_tracking_test.requests values(p_tracking,p_request);
 update rank_tracking_test.trackings set tracking=p_tracking_data,version=version+1 where tracking_id=p_tracking;
 return 'saved';
end $$;
