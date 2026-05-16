-- Discount codes on instructor invoices (Sarah 2026-05-14 "sometimes I
-- need to discount a monthly rate before sending an invoice"). Reuses
-- the studio_discount_codes table. Redemption is recorded when the
-- invoice transitions to "sent".
alter table public.instructor_invoices
  add column if not exists discount_code_id uuid references public.studio_discount_codes(id) on delete set null,
  add column if not exists discount_amount_off_cents integer not null default 0
    check (discount_amount_off_cents >= 0);
