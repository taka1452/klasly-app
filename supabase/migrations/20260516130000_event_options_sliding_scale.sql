-- Sliding scale on event options (Jamie / Sarah extension of the class
-- sliding scale shipped 2026-05-15). Same Option A model: set Minimum
-- and Suggested per option, attendee picks any amount in the range at
-- checkout. Suggested price stays in `price_cents` for backward compat;
-- when pricing_mode = 'sliding_scale' it's surfaced as the suggested
-- amount instead of a fixed price.

alter table public.event_options
  add column if not exists pricing_mode text not null default 'fixed',
  add column if not exists price_min_cents integer;

alter table public.event_options
  add constraint event_options_pricing_mode_check
    check (pricing_mode in ('fixed', 'sliding_scale'));

alter table public.event_options
  add constraint event_options_sliding_scale_bounds
    check (
      pricing_mode <> 'sliding_scale'
      or (
        price_min_cents is not null
        and price_min_cents >= 0
        and price_min_cents <= price_cents
      )
    );
