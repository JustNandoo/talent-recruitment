-- Retain existing templates and all invitations/results as history.
-- New templates explicitly set archived=0 when created by an examiner.
ALTER TABLE serviam.exam_templates ADD COLUMN IF NOT EXISTS archived INTEGER NOT NULL DEFAULT 1;
