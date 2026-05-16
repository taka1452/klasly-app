-- Studio-defined discount codes (Jamie 2026-05-14). Two flavours in one
-- table: optionally `member_tag` lets the admin attach a code to a tag
-- like "veteran" so it auto-applies when a tagged member checks out —
-- otherwise the code is a plain "type-it-in" coupon.
--
-- Scope is intentionally string-keyed so we can extend later (events,
-- memberships, contract invoices) without another migration.

create table if not exists public.studio_discount_codes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  code text not null,
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  -- percent: 10 = 10%; fixed: cents off (e.g. 1000 = $10.00)
  discount_value integer not null check (discount_value > 0),
  scope text not null default 'all'
    check (scope in ('all', 'class', 'event', 'membership', 'contract')),
  -- When set, the code auto-applies for members whose `members.tags`
  -- column contains this value (e.g. "veteran", "first_responder").
  member_tag text,
  expires_at timestamptz,
  usage_limit integer,
  used_count integer not null default 0,
  one_time_per_member boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (studio_id, code)
);

create index if not exists idx_studio_discount_codes_studio
  on public.studio_discount_codes (studio_id);
create index if not exists idx_studio_discount_codes_active
  on public.studio_discount_codes (studio_id, is_active)
  where is_active = true;

create table if not exists public.studio_discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  discount_code_id uuid not null references public.studio_discount_codes(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  amount_off_cents integer not null check (amount_off_cents >= 0),
  context text not null check (context in ('class_booking', 'event_booking', 'membership', 'contract_invoice')),
  context_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_discount_redemptions_code
  on public.studio_discount_redemptions (discount_code_id);
create index if not exists idx_discount_redemptions_member
  on public.studio_discount_redemptions (member_id);

-- Member tags so the auto-apply hook can match. Lightweight free-form
-- array — admins write the values (e.g. "veteran") and use the same
-- string when defining a code's member_tag.
alter table public.members
  add column if not exists tags text[] not null default '{}';

create index if not exists idx_members_tags on public.members using gin (tags);

-- RLS: owner / manager can read/write codes; redemptions are insert-only
-- from the booking flow (service-role) and readable by admins.
alter table public.studio_discount_codes enable row level security;
alter table public.studio_discount_redemptions enable row level security;

create policy "discount_codes_admin_select" on public.studio_discount_codes
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.studio_id = studio_id
        and p.role in ('owner', 'manager')
    )
  );

create policy "discount_codes_admin_write" on public.studio_discount_codes
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.studio_id = studio_id
        and p.role in ('owner', 'manager')
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.studio_id = studio_id
        and p.role in ('owner', 'manager')
    )
  );

create policy "discount_redemptions_admin_select" on public.studio_discount_redemptions
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.studio_id = studio_id
        and p.role in ('owner', 'manager')
    )
  );
