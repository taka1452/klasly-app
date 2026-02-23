-- ============================================
-- Klasly - Database Setup SQL
-- Supabase SQL Editor でこのファイルの内容を実行してください
-- ============================================

-- ============================================
-- 1. テーブル作成
-- ============================================

-- 1-1. studios（スタジオ）
create table studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  address text,
  plan text not null default 'free',
  max_members int not null default 10,
  created_at timestamptz default now()
);

-- 1-2. profiles（ユーザープロフィール）
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  studio_id uuid references studios(id) on delete cascade,
  role text not null default 'member',
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz default now()
);

-- 1-3. members（会員詳細）
create table members (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  plan_type text not null default 'drop_in',
  credits int not null default 0,
  status text not null default 'active',
  joined_at date default current_date,
  notes text,
  created_at timestamptz default now()
);

-- 1-4. instructors（インストラクター詳細）
create table instructors (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  bio text,
  specialties text[],
  created_at timestamptz default now()
);

-- 1-5. classes（クラス定義）
create table classes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id) on delete cascade,
  instructor_id uuid references instructors(id),
  name text not null,
  description text,
  day_of_week int not null,
  start_time time not null,
  duration_minutes int not null default 60,
  capacity int not null default 15,
  location text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 1-6. class_sessions（クラスの各回）
create table class_sessions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  session_date date not null,
  start_time time not null,
  capacity int not null,
  is_cancelled boolean default false,
  notes text,
  created_at timestamptz default now(),
  unique(class_id, session_date)
);

-- 1-7. bookings（予約）
create table bookings (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id) on delete cascade,
  session_id uuid references class_sessions(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  status text not null default 'confirmed',
  attended boolean default false,
  created_at timestamptz default now(),
  unique(session_id, member_id)
);

-- 1-8. payments（支払い履歴）
create table payments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  amount int not null,
  currency text default 'usd',
  type text not null,
  status text not null default 'pending',
  stripe_payment_intent_id text,
  description text,
  paid_at timestamptz,
  due_date date,
  created_at timestamptz default now()
);

-- ============================================
-- 2. profiles 自動作成トリガー
-- Supabase Auth でユーザー登録時に自動で profiles に行を作る
-- ============================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- 3. Row Level Security (RLS) ポリシー
-- ============================================

-- --- studios ---
alter table studios enable row level security;

create policy "owner can view own studio"
on studios for select
using (
  id in (
    select studio_id from profiles
    where id = auth.uid() and role = 'owner'
  )
);

create policy "owner can update own studio"
on studios for update
using (
  id in (
    select studio_id from profiles
    where id = auth.uid() and role = 'owner'
  )
);

create policy "anyone can insert studio"
on studios for insert
with check (true);

-- --- profiles ---
alter table profiles enable row level security;

create policy "users can view own profile"
on profiles for select
using (id = auth.uid());

create policy "owner can view studio profiles"
on profiles for select
using (
  studio_id in (
    select studio_id from profiles
    where id = auth.uid() and role = 'owner'
  )
);

create policy "users can update own profile"
on profiles for update
using (id = auth.uid());

create policy "trigger can insert profile"
on profiles for insert
with check (true);

-- --- members ---
alter table members enable row level security;

create policy "owner can view members"
on members for select
using (
  studio_id in (
    select studio_id from profiles
    where id = auth.uid() and role = 'owner'
  )
);

create policy "member can view own data"
on members for select
using (profile_id = auth.uid());

create policy "owner can insert members"
on members for insert
with check (
  studio_id in (
    select studio_id from profiles
    where id = auth.uid() and role = 'owner'
  )
);

create policy "owner can update members"
on members for update
using (
  studio_id in (
    select studio_id from profiles
    where id = auth.uid() and role = 'owner'
  )
);

create policy "owner can delete members"
on members for delete
using (
  studio_id in (
    select studio_id from profiles
    where id = auth.uid() and role = 'owner'
  )
);

-- --- instructors ---
alter table instructors enable row level security;

create policy "owner can manage instructors"
on instructors for all
using (
  studio_id in (
    select studio_id from profiles
    where id = auth.uid() and role = 'owner'
  )
);

create policy "instructor can view own data"
on instructors for select
using (profile_id = auth.uid());

-- --- classes ---
alter table classes enable row level security;

create policy "studio members can view classes"
on classes for select
using (
  studio_id in (
    select studio_id from profiles
    where id = auth.uid()
  )
);

create policy "owner can manage classes"
on classes for all
using (
  studio_id in (
    select studio_id from profiles
    where id = auth.uid() and role = 'owner'
  )
);

-- --- class_sessions ---
alter table class_sessions enable row level security;

create policy "studio members can view sessions"
on class_sessions for select
using (
  studio_id in (
    select studio_id from profiles
    where id = auth.uid()
  )
);

create policy "owner can manage sessions"
on class_sessions for all
using (
  studio_id in (
    select studio_id from profiles
    where id = auth.uid() and role = 'owner'
  )
);

-- --- bookings ---
alter table bookings enable row level security;

create policy "owner can view all bookings"
on bookings for select
using (
  studio_id in (
    select studio_id from profiles
    where id = auth.uid() and role = 'owner'
  )
);

create policy "instructor can view own class bookings"
on bookings for select
using (
  session_id in (
    select cs.id from class_sessions cs
    join classes c on c.id = cs.class_id
    join instructors i on i.id = c.instructor_id
    where i.profile_id = auth.uid()
  )
);

create policy "member can view own bookings"
on bookings for select
using (
  member_id in (
    select id from members where profile_id = auth.uid()
  )
);

create policy "member can insert own bookings"
on bookings for insert
with check (
  member_id in (
    select id from members where profile_id = auth.uid()
  )
);

create policy "member can update own bookings"
on bookings for update
using (
  member_id in (
    select id from members where profile_id = auth.uid()
  )
);

-- --- payments ---
alter table payments enable row level security;

create policy "owner can view all payments"
on payments for select
using (
  studio_id in (
    select studio_id from profiles
    where id = auth.uid() and role = 'owner'
  )
);

create policy "owner can manage payments"
on payments for all
using (
  studio_id in (
    select studio_id from profiles
    where id = auth.uid() and role = 'owner'
  )
);

create policy "member can view own payments"
on payments for select
using (
  member_id in (
    select id from members where profile_id = auth.uid()
  )
);
