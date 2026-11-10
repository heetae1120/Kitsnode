-- Local staging candidate. Apply only after reviewing role and isolation.
BEGIN;
CREATE TABLE IF NOT EXISTS member_auth_support.request_limits (
  bucket text PRIMARY KEY CHECK (bucket = 'auth-global'),
  window_start timestamptz NOT NULL,
  count integer NOT NULL CHECK (count > 0)
);
ALTER TABLE member_auth_support.request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON member_auth_support.request_limits FROM PUBLIC;
COMMIT;
