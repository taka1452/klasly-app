-- ============================================
-- Instructor Studio Rental
-- Adds rental contract fields to instructors table.
-- rental_type: 'none' (default), 'flat_monthly', 'per_class'
-- rental_amount: amount in cents (e.g. 10000 = $100)
-- ============================================

ALTER TABLE instructors ADD COLUMN rental_type text NOT NULL DEFAULT 'none';
ALTER TABLE instructors ADD COLUMN rental_amount integer NOT NULL DEFAULT 0;
