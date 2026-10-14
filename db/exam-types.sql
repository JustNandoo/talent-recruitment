-- Existing invitations/results stay on the Serviam bank and scoring rules.
ALTER TABLE serviam.exams ADD COLUMN IF NOT EXISTS exam_type TEXT NOT NULL DEFAULT 'serviam';
