ALTER TABLE soap_notes ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_soap_notes_appointment ON soap_notes(appointment_id);
