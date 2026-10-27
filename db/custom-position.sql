-- Keep the displayed job title separate from the scoring role used by each exam bank.
ALTER TABLE serviam.exams ADD COLUMN IF NOT EXISTS position_name TEXT;
