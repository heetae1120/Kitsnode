-- Candidate only. The two codes must correspond to the exact published terms
-- and privacy acknowledgement versions. No codes or provider are enabled here.
-- Append-only mapping; populate with a separate reviewed migration only after
-- Naver confirms its returned termCode and a new tag unique to this version.
-- effective_date is the document's published civil date; agreeDate has no
-- documented timezone, so same-day and next-day evidence fails closed.
CREATE TABLE kitsnode_member_private.naver_agreement_versions (
 client_id text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('terms','privacy_ack')),
 document_version text NOT NULL,
 term_code text NOT NULL,
 effective_date date NOT NULL,
 PRIMARY KEY(client_id,kind,document_version),
 UNIQUE(client_id,term_code)
);
ALTER TABLE kitsnode_member_private.naver_agreement_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON kitsnode_member_private.naver_agreement_versions FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION kitsnode_member_private.reject_naver_version_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'naver_version_mapping_is_immutable'; END $$;
CREATE TRIGGER immutable_naver_versions BEFORE UPDATE OR DELETE ON kitsnode_member_private.naver_agreement_versions
FOR EACH ROW EXECUTE FUNCTION kitsnode_member_private.reject_naver_version_mutation();

CREATE TABLE kitsnode_member_private.naver_agreement_evidence (
 user_id uuid NOT NULL,
 terms_version text NOT NULL,
 privacy_version text NOT NULL,
 client_id text NOT NULL,
 agreements jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,terms_version,privacy_version),
 FOREIGN KEY(user_id,terms_version,privacy_version)
  REFERENCES public.kitsnode_member_consents(user_id,terms_version,privacy_version) ON DELETE CASCADE
);
ALTER TABLE kitsnode_member_private.naver_agreement_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON kitsnode_member_private.naver_agreement_evidence FROM PUBLIC,anon,authenticated,service_role;

-- Only a trusted service can invoke this. The outer endpoint verifies the
-- provider token and registered application/term codes before calling it.
CREATE FUNCTION public.kits_naver_agreement_record_candidate(
 p_user uuid,p_session uuid,p_naver_subject text,p_terms_version text,
 p_privacy_version text,p_client_id text,p_agreements jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sess uuid; identity_id uuid; terms_code text; privacy_code text;
 terms_date date; privacy_date date; terms_raw text; privacy_raw text;
BEGIN
 IF p_user IS NULL OR p_session IS NULL OR p_naver_subject IS NULL OR p_terms_version IS NULL OR p_privacy_version IS NULL OR p_client_id IS NULL OR p_agreements IS NULL OR length(p_naver_subject) NOT BETWEEN 1 AND 255
 OR length(p_terms_version) NOT BETWEEN 1 AND 100 OR length(p_privacy_version) NOT BETWEEN 1 AND 100
 OR length(p_client_id) NOT BETWEEN 1 AND 255 OR pg_catalog.jsonb_typeof(p_agreements)<>'array'
 OR pg_catalog.jsonb_array_length(p_agreements)<>2 OR length(p_agreements::text)>4000 THEN RETURN false; END IF;
 -- Prevent withdrawal and session revocation from racing the evidence write.
 PERFORM 1 FROM auth.users WHERE id=p_user FOR SHARE;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,0));
 IF EXISTS(SELECT 1 FROM kitsnode_member_private.deletion_access_blocks WHERE subject_id=p_user) THEN RETURN false; END IF;
 SELECT id INTO sess FROM auth.sessions WHERE id=p_session AND user_id=p_user AND (not_after IS NULL OR not_after>pg_catalog.clock_timestamp()) FOR SHARE;
 IF sess IS NULL THEN RETURN false; END IF;
 SELECT id INTO identity_id FROM auth.identities WHERE user_id=p_user AND provider='custom:naver' AND identity_data->>'sub'=p_naver_subject FOR SHARE;
 IF identity_id IS NULL THEN RETURN false; END IF;
 -- The operator can only append a previously unused Naver code tied to one
 -- exact document version. No client may choose or alter this mapping.
 SELECT term_code,effective_date INTO terms_code,terms_date FROM kitsnode_member_private.naver_agreement_versions
  WHERE client_id=p_client_id AND kind='terms' AND document_version=p_terms_version;
 SELECT term_code,effective_date INTO privacy_code,privacy_date FROM kitsnode_member_private.naver_agreement_versions
  WHERE client_id=p_client_id AND kind='privacy_ack' AND document_version=p_privacy_version;
 IF terms_code IS NULL OR privacy_code IS NULL OR terms_code=privacy_code THEN RETURN false; END IF;
 IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_agreements) a WHERE a->>'termCode'=terms_code)<>1
 OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_agreements) a WHERE a->>'termCode'=privacy_code)<>1 THEN RETURN false; END IF;
 SELECT a->>'agreeDate' INTO terms_raw FROM pg_catalog.jsonb_array_elements(p_agreements) a WHERE a->>'termCode'=terms_code;
 SELECT a->>'agreeDate' INTO privacy_raw FROM pg_catalog.jsonb_array_elements(p_agreements) a WHERE a->>'termCode'=privacy_code;
 IF terms_raw IS NULL OR privacy_raw IS NULL OR terms_raw !~ ' (AM|PM) [0-9]{2}/[0-9]{2}/[0-9]{4}$'
 OR privacy_raw !~ ' (AM|PM) [0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN RETURN false; END IF;
 -- Naver does not document the timezone. Do not infer an instant from it.
 -- Accept only a civil date at least two dates after the published date;
 -- ambiguous near-boundary dates fall back to the ordinary consent screen.
 IF pg_catalog.to_date(pg_catalog.right(terms_raw,10),'MM/DD/YYYY') <= terms_date+1
 OR pg_catalog.to_date(pg_catalog.right(privacy_raw,10),'MM/DD/YYYY') <= privacy_date+1 THEN RETURN false; END IF;
 INSERT INTO public.kitsnode_member_consents(user_id,terms_version,privacy_version) VALUES(p_user,p_terms_version,p_privacy_version)
 ON CONFLICT(user_id,terms_version,privacy_version) DO NOTHING;
 INSERT INTO kitsnode_member_private.naver_agreement_evidence(user_id,terms_version,privacy_version,client_id,agreements)
 VALUES(p_user,p_terms_version,p_privacy_version,p_client_id,p_agreements)
 ON CONFLICT(user_id,terms_version,privacy_version) DO UPDATE SET client_id=EXCLUDED.client_id,agreements=EXCLUDED.agreements,recorded_at=now();
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.kits_naver_agreement_record_candidate(uuid,uuid,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kits_naver_agreement_record_candidate(uuid,uuid,text,text,text,text,jsonb) TO service_role;
