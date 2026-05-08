-- Allow events to offer both full payment and installment options.
-- The new 'both' value lets the member choose at checkout.
-- event_bookings.payment_type stays 'full'|'installment' (per-booking choice).

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_payment_type_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_payment_type_check
    CHECK (payment_type IN ('full', 'installment', 'both'));
