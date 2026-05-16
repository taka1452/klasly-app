-- Sliding scale / "Pay What You Can" pricing (Option A per Jamie+Sarah,
-- 2026-05-14): on a class, set a minimum and a suggested price; attendee
-- picks any amount in the range at checkout.
--
-- Existing semantics preserved:
--   * `price_cents` continues to be the listed price (suggested price when
--     pricing_mode = 'sliding_scale')
--   * `pricing_mode = 'fixed'` (default) keeps the current single-price
--     behaviour — no checkout picker is shown
alter table public.class_templates
  add column if not exists pricing_mode text not null default 'fixed',
  add column if not exists price_min_cents integer;

alter table public.class_templates
  add constraint class_templates_pricing_mode_check
    check (pricing_mode in ('fixed', 'sliding_scale'));

alter table public.class_templates
  add constraint class_templates_sliding_scale_bounds
    check (
      pricing_mode <> 'sliding_scale'
      or (
        price_min_cents is not null
        and price_min_cents >= 0
        and price_cents is not null
        and price_min_cents <= price_cents
      )
    );
