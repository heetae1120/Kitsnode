-- Apply to the independent D1 before deploying the updated worker.
CREATE TABLE IF NOT EXISTS deletion_retry_cursor (singleton INTEGER PRIMARY KEY CHECK(singleton=1), cursor TEXT);
INSERT INTO deletion_retry_cursor(singleton,cursor) VALUES(1,NULL) ON CONFLICT(singleton) DO NOTHING;
