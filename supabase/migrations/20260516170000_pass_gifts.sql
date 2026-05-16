-- Pass gifting (T2-4). A member with remaining classes on a class_pack
-- pass can transfer some of them to another member in the same studio.
-- Two-step flow: sender creates a pending gift row (and we decrement
-- their remaining classes), recipient redeems it which creates a fresh
-- pass_subscription with the gifted count.
--
-- Pending gifts can be revoked by the sender before redemption — that
-- restores their original count.

create table if not exists public.pass_gifts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  studio_pass_id uuid not null references public.studio_passes(id) on delete cascade,
  from_member_id uuid not null references public.members(id) on delete cascade,
  to_member_id uuid not null references public.members(id) on delete cascade,
  from_subscription_id uuid not null references public.pass_subscriptions(id) on delete cascade,
  class_count integer not null check (class_count > 0),
  message text,
  status text not null default 'pending' check (status in ('pending', 'redeemed', 'revoked')),
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_subscription_id uuid references public.pass_subscriptions(id) on delete set null
);

create index if not exists idx_pass_gifts_to_member
  on public.pass_gifts (to_member_id, status);
create index if not exists idx_pass_gifts_from_member
  on public.pass_gifts (from_member_id, status);

alter table public.pass_gifts enable row level security;

-- Members can read gifts they sent or received.
create policy "pass_gifts_member_select" on public.pass_gifts
  for select using (
    exists (
      select 1 from public.members m
      where (m.id = from_member_id or m.id = to_member_id)
        and m.profile_id = auth.uid()
    )
  );

-- Admins can read all gifts in their studio.
create policy "pass_gifts_admin_select" on public.pass_gifts
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.studio_id = studio_id
        and p.role in ('owner', 'manager')
    )
  );
