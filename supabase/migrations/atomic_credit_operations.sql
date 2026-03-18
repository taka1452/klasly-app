-- Atomic credit decrement: prevents race conditions on concurrent bookings.
-- Returns the new credit value, or -99 if insufficient credits.
-- credits = -1 means unlimited; skip decrement and return -1.
CREATE OR REPLACE FUNCTION public.decrement_member_credits(
  p_member_id uuid,
  p_amount int DEFAULT 1
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_credits int;
BEGIN
  UPDATE members
  SET credits = credits - p_amount
  WHERE id = p_member_id
    AND credits >= p_amount  -- only decrement if sufficient
    AND credits >= 0         -- skip unlimited (-1)
  RETURNING credits INTO v_new_credits;

  IF NOT FOUND THEN
    -- Check if the member has unlimited credits
    SELECT credits INTO v_new_credits
    FROM members
    WHERE id = p_member_id;

    IF v_new_credits = -1 THEN
      RETURN -1;  -- unlimited, no deduction needed
    END IF;

    RETURN -99;  -- insufficient credits
  END IF;

  RETURN v_new_credits;
END;
$$;

-- Atomic credit increment (for refunds on cancellation).
CREATE OR REPLACE FUNCTION public.increment_member_credits(
  p_member_id uuid,
  p_amount int DEFAULT 1
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_credits int;
BEGIN
  UPDATE members
  SET credits = credits + p_amount
  WHERE id = p_member_id
    AND credits >= 0  -- skip unlimited (-1)
  RETURNING credits INTO v_new_credits;

  IF NOT FOUND THEN
    -- If unlimited, return -1
    SELECT credits INTO v_new_credits
    FROM members
    WHERE id = p_member_id;
    RETURN COALESCE(v_new_credits, 0);
  END IF;

  RETURN v_new_credits;
END;
$$;

-- Atomic pass usage counter increment.
CREATE OR REPLACE FUNCTION public.increment_pass_usage(
  p_subscription_id uuid
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_count int;
BEGIN
  UPDATE pass_subscriptions
  SET classes_used_this_period = classes_used_this_period + 1
  WHERE id = p_subscription_id
  RETURNING classes_used_this_period INTO v_new_count;

  RETURN COALESCE(v_new_count, 0);
END;
$$;

-- Atomic pass usage counter decrement (for cancellation reversal).
CREATE OR REPLACE FUNCTION public.decrement_pass_usage(
  p_subscription_id uuid
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_count int;
BEGIN
  UPDATE pass_subscriptions
  SET classes_used_this_period = GREATEST(0, classes_used_this_period - 1)
  WHERE id = p_subscription_id
  RETURNING classes_used_this_period INTO v_new_count;

  RETURN COALESCE(v_new_count, 0);
END;
$$;
