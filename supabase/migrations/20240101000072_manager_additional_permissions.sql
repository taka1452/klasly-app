-- Add four additional manager permission toggles requested by Sunrise Yoga Studio (Jamie feedback 2026-04).
-- - can_manage_class_pricing:    Edit class prices, drop-in rates, promotional pricing.
-- - can_manage_contracts_tiers:  Edit instructor contracts (hourly plans, flat fees, overage) AND membership tiers.
-- - can_show_tutorial:           Whether this manager sees onboarding tutorials / guided walkthrough hints.
-- - can_export_data:             Allow this manager to export studio data (CSV/PDF).
ALTER TABLE managers ADD COLUMN IF NOT EXISTS can_manage_class_pricing boolean DEFAULT false;
ALTER TABLE managers ADD COLUMN IF NOT EXISTS can_manage_contracts_tiers boolean DEFAULT false;
ALTER TABLE managers ADD COLUMN IF NOT EXISTS can_show_tutorial boolean DEFAULT true;
ALTER TABLE managers ADD COLUMN IF NOT EXISTS can_export_data boolean DEFAULT false;
