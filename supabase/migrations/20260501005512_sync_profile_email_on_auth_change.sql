-- Keep public.profiles.email in sync with auth.users.email after a confirmed
-- email change. Without this, users updating their login email via
-- /api/account/email would still see the old address in Settings → Profile,
-- and notifications that read profile.email (e.g. waiver invites,
-- room-booking emails, tier-overage receipts) would keep going to the old
-- inbox even after Supabase has confirmed the new address.
--
-- Jamie feedback 2026-04-30: "I updated my login to my new email address,
-- however my old email is still displayed under Profile at the bottom of
-- Settings. I'm also still receiving emails from Klasly at my old email
-- address."

create or replace function public.sync_profile_email_from_auth()
returns trigger as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
       set email = new.email
     where id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_email_changed on auth.users;

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row
execute function public.sync_profile_email_from_auth();

-- One-time backfill: bring any existing profiles whose email diverged from
-- the source-of-truth auth.users.email back into alignment.
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is distinct from u.email;
