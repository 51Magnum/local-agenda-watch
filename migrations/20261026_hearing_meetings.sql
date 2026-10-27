-- Additive: existing project/feed rows are not changed. Missing optional fields stay NULL.
CREATE TABLE IF NOT EXISTS law_hearing_meetings (
  area_id text NOT NULL,
  case_id text NOT NULL,
  hearing_key text NOT NULL,
  meeting_url text,
  agenda_url text,
  packet_url text,
  meeting_body text,
  -- Text preserves a date-only source without inventing midnight or a timezone.
  meeting_datetime text,
  agenda_item_number text,
  comment_deadline text,
  comment_deadline_source_url text,
  speak_signup_url text,
  last_checked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  manual_override jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count BETWEEN 0 AND 3),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  last_error text,
  PRIMARY KEY (area_id, case_id, hearing_key),
  CHECK (comment_deadline IS NULL OR comment_deadline_source_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS law_hearing_meetings_checked ON law_hearing_meetings(last_attempt_at DESC);
