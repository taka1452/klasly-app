-- Atomic contract signing — closes the race condition in
-- /api/contracts/sign/[token] where two signers (or the same signer
-- double-clicking) could both pass the prior-unsigned check before
-- either of them committed.
--
-- The function takes a row-level lock (SELECT ... FOR UPDATE) on the
-- target signer, then verifies the prior-signer state inside the same
-- transaction. Concurrent callers serialize on the lock.
--
-- Returns a jsonb result: { success: true } or { error: "..." }. The
-- API translates the error string into the HTTP response.
create or replace function public.sign_contract_signer(
  p_signer_id uuid,
  p_signature_data text,
  p_ip_address text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_signer record;
  v_priors int;
begin
  -- Row lock; concurrent callers wait here.
  select id, envelope_id, sign_order, status
  into v_signer
  from public.contract_envelope_signers
  where id = p_signer_id
  for update;

  if v_signer is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_signer.status = 'signed' then
    return jsonb_build_object('error', 'already_signed');
  end if;
  if v_signer.status = 'declined' then
    return jsonb_build_object('error', 'declined');
  end if;

  -- Prior-unsigned check inside the same transaction.
  select count(*) into v_priors
  from public.contract_envelope_signers
  where envelope_id = v_signer.envelope_id
    and sign_order < v_signer.sign_order
    and status <> 'signed';

  if v_priors > 0 then
    return jsonb_build_object('error', 'prior_unsigned');
  end if;

  update public.contract_envelope_signers
  set status = 'signed',
      signed_at = now(),
      signature_data = p_signature_data,
      ip_address = p_ip_address,
      user_agent = p_user_agent
  where id = p_signer_id;

  return jsonb_build_object('success', true);
end;
$$;

comment on function public.sign_contract_signer(uuid, text, text, text) is
  'Atomically marks a contract envelope signer as signed, with row-level locking to prevent two signers from racing past the prior-unsigned check. Used by /api/contracts/sign/[token].';
