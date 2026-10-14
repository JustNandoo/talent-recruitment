CREATE TABLE IF NOT EXISTS serviam.exam_templates (
  id TEXT PRIMARY KEY,
  definition TEXT NOT NULL,
  sources TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL REFERENCES serviam.users(id),
  created_at BIGINT NOT NULL
);
ALTER TABLE serviam.exam_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON serviam.exam_templates FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON serviam.exam_templates FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON serviam.exam_templates FROM authenticated; END IF;
END $$;
ALTER TABLE serviam.exams ADD COLUMN IF NOT EXISTS exam_definition TEXT;
