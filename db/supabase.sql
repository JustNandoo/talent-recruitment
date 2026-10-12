CREATE SCHEMA IF NOT EXISTS serviam;
CREATE TABLE IF NOT EXISTS serviam.schema_versions (version INTEGER PRIMARY KEY, applied_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS serviam.users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  password TEXT NOT NULL, created_at BIGINT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','superadmin')),
  is_active SMALLINT NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  must_change_password SMALLINT NOT NULL DEFAULT 0 CHECK (must_change_password IN (0,1)),
  sort_id BIGINT GENERATED ALWAYS AS IDENTITY
);
CREATE TABLE IF NOT EXISTS serviam.exams (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
  role TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL, started_at BIGINT, finished_at BIGINT,
  section_index INTEGER NOT NULL DEFAULT 0, section_deadline BIGINT,
  answers TEXT NOT NULL DEFAULT '{}', result TEXT, question_order TEXT NOT NULL,
  interview TEXT NOT NULL DEFAULT '{}', note TEXT NOT NULL DEFAULT '',
  finish_reason TEXT, consent_at BIGINT, decision TEXT NOT NULL DEFAULT 'belum_diputuskan',
  reviewed_at BIGINT, created_by TEXT NOT NULL, sort_id BIGINT GENERATED ALWAYS AS IDENTITY
);
CREATE TABLE IF NOT EXISTS serviam.sessions (
  token_hash TEXT PRIMARY KEY, kind TEXT NOT NULL,
  user_id TEXT REFERENCES serviam.users(id) ON DELETE CASCADE,
  exam_id TEXT REFERENCES serviam.exams(id) ON DELETE CASCADE, expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS serviam.audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor TEXT NOT NULL, action TEXT NOT NULL, exam_id TEXT, at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS serviam.rate_limits (
  key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS exam_status ON serviam.exams(status);
CREATE INDEX IF NOT EXISTS session_expiry ON serviam.sessions(expires_at);
CREATE INDEX IF NOT EXISTS rate_expiry ON serviam.rate_limits(reset_at);
ALTER TABLE serviam.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE serviam.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE serviam.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE serviam.audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE serviam.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA serviam FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA serviam FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA serviam FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON SCHEMA serviam FROM anon;
    REVOKE ALL ON ALL TABLES IN SCHEMA serviam FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA serviam FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON SCHEMA serviam FROM authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA serviam FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA serviam FROM authenticated;
  END IF;
END $$;
