-- Multi-signature contract envelopes (Jamie 2026-04-30): "Is there an
-- option or ability to collect multiple signatures in a specific order on
-- contracts through Klasly, similar to how Jotform works? And could we
-- connect signed contracts to the instructor for easy access?"
--
-- Design:
-- An "envelope" is one send of a contract template (custom_forms row) for
-- signing. Multiple signers per envelope, each with a sign_order. When
-- signer N signs, signer N+1 receives an email link with their unique
-- sign_token. Once every signer signs, the envelope is `completed`.
--
-- An envelope can be tied to an `instructor_id`, which makes the
-- completed contract surface on the instructor's profile page — Jamie's
-- second ask. Member contracts can leave it null.

create table if not exists public.contract_envelopes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null,
  -- The custom_forms row that defines the contract (must have form_type='contract').
  form_id uuid not null,
  title text not null,
  -- Optional: when the contract is for a specific instructor, surface it
  -- on their profile and use it for contract-tier auditing.
  instructor_id uuid,
  status text not null default 'in_progress'
    check (status in ('draft', 'in_progress', 'completed', 'voided')),
  created_by uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists contract_envelopes_studio_idx
  on public.contract_envelopes (studio_id, created_at desc);

create index if not exists contract_envelopes_instructor_idx
  on public.contract_envelopes (instructor_id, created_at desc)
  where instructor_id is not null;

create index if not exists contract_envelopes_form_idx
  on public.contract_envelopes (form_id, created_at desc);

create table if not exists public.contract_envelope_signers (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references public.contract_envelopes(id) on delete cascade,
  -- 1-based, unique per envelope. Signer 1 is emailed when the envelope
  -- is created; signer 2 is emailed when signer 1 signs; etc.
  sign_order int not null,
  -- Free-form label shown to the signer ("Studio owner", "Instructor",
  -- "Witness"). Helps the receiver understand their role in the document.
  role_label text,
  name text not null,
  email text not null,
  -- Optional FK to a known Klasly profile so we can stamp signatures
  -- with a verified profile_id when present.
  profile_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'notified', 'signed', 'declined')),
  -- Single-use token sent in the magic link. Rotated when re-sending.
  sign_token uuid not null default gen_random_uuid(),
  signed_at timestamptz,
  declined_at timestamptz,
  signature_data text,
  ip_address text,
  user_agent text,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists contract_envelope_signers_order_unique
  on public.contract_envelope_signers (envelope_id, sign_order);

create unique index if not exists contract_envelope_signers_token_idx
  on public.contract_envelope_signers (sign_token);

create index if not exists contract_envelope_signers_envelope_idx
  on public.contract_envelope_signers (envelope_id);

comment on table public.contract_envelopes is
  'A multi-signer send of a contract form. Created when an admin clicks "Send for signing" on a contract template; advances through signers in sign_order; marked completed when the last signer signs.';
comment on table public.contract_envelope_signers is
  'One row per signer on a contract envelope. Each holds the unique sign_token used in the magic-link signing URL.';

-- RLS: studio members read their own studio's envelopes + signers.
-- Inserts / updates come from the API (service role) so we don't need
-- write policies for normal users; signers update via the public sign
-- endpoint which uses the service role on their behalf.
alter table public.contract_envelopes enable row level security;
alter table public.contract_envelope_signers enable row level security;

drop policy if exists contract_envelopes_select_own_studio on public.contract_envelopes;
create policy contract_envelopes_select_own_studio
  on public.contract_envelopes
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.studio_id = contract_envelopes.studio_id
    )
  );

drop policy if exists contract_envelope_signers_select_own_studio on public.contract_envelope_signers;
create policy contract_envelope_signers_select_own_studio
  on public.contract_envelope_signers
  for select
  using (
    exists (
      select 1 from public.contract_envelopes e
      join public.profiles p on p.studio_id = e.studio_id
      where e.id = contract_envelope_signers.envelope_id
        and p.id = auth.uid()
    )
  );
