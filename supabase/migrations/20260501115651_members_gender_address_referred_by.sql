-- Jamie feedback 2026-04-30: tighten the Add Member form. Gender becomes a
-- required intake field, plus optional address and referred-by columns so
-- studios can capture how a member found them. Phone and birthdate are not
-- new columns (phone lives on profiles, date_of_birth already exists on
-- members); the UI just promotes them to required.

alter table public.members
  add column if not exists gender text,
  add column if not exists address text,
  add column if not exists referred_by text;

-- Restrict gender values up-front. NULL stays allowed because every existing
-- row in the table predates this column; the form enforces required for
-- newly-created members instead of failing inserts of legacy rows.
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'members'
      and constraint_name = 'members_gender_check'
  ) then
    alter table public.members
      add constraint members_gender_check
      check (gender is null or gender in ('female', 'male', 'prefer_not_to_say'));
  end if;
end$$;

comment on column public.members.gender is 'female | male | prefer_not_to_say. Required at create time via the UI; nullable at the DB level so legacy rows remain valid.';
comment on column public.members.address is 'Optional postal/street address captured at signup.';
comment on column public.members.referred_by is 'Optional free-text "how did you hear about us" / referrer captured at signup.';
