-- Candidate schema for a separately provisioned D1 database. Never stores email,
-- tokens, passwords, names or copied member profiles.
CREATE TABLE deletion_intents (
 request_id TEXT PRIMARY KEY NOT NULL,
 subject_id TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 completed_at INTEGER,
 CHECK (length(request_id)=36 AND length(subject_id)=36 AND length(actor_id)=36),
 CHECK (completed_at IS NULL OR completed_at >= created_at)
) STRICT;
CREATE UNIQUE INDEX deletion_intents_subject_unique ON deletion_intents(subject_id);
CREATE TABLE deletion_retry_cursor (singleton INTEGER PRIMARY KEY CHECK(singleton=1), cursor TEXT);
INSERT INTO deletion_retry_cursor(singleton,cursor) VALUES(1,NULL);
CREATE TRIGGER deletion_intents_immutable BEFORE UPDATE ON deletion_intents
WHEN NEW.request_id IS NOT OLD.request_id OR NEW.subject_id IS NOT OLD.subject_id
 OR NEW.actor_id IS NOT OLD.actor_id OR NEW.created_at IS NOT OLD.created_at
 OR (OLD.completed_at IS NOT NULL AND NEW.completed_at IS NOT OLD.completed_at)
BEGIN SELECT RAISE(ABORT,'immutable_intent'); END;
CREATE TRIGGER deletion_intents_no_delete BEFORE DELETE ON deletion_intents
BEGIN SELECT RAISE(ABORT,'intent_cannot_be_deleted'); END;
