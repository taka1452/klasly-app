-- Online class support: add is_online and online_link to classes and class_sessions
-- Default false ensures existing classes remain in-person

ALTER TABLE classes
  ADD COLUMN is_online boolean NOT NULL DEFAULT false,
  ADD COLUMN online_link text;

ALTER TABLE class_sessions
  ADD COLUMN is_online boolean NOT NULL DEFAULT false,
  ADD COLUMN online_link text;
