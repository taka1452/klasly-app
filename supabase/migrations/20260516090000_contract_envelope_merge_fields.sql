-- Add merge_fields to contract_envelopes so admins can pre-populate
-- form fields per-envelope before sending for signing.
-- Structure: { "fieldId": "value", ... } matching the custom_forms.fields[].id keys.
ALTER TABLE contract_envelopes
  ADD COLUMN IF NOT EXISTS merge_fields jsonb DEFAULT '{}';
