-- ============================================
-- Klasly 出席管理機能 - データベースセットアップ
-- Supabase SQL Editor で実行してください
-- ============================================

-- 1. ドロップイン出席テーブル（予約なしの参加記録）
create table if not exists drop_in_attendances (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id) on delete cascade not null,
  session_id uuid references class_sessions(id) on delete cascade not null,
  member_id uuid references members(id) on delete cascade not null,
  attended_at timestamptz default now(),
  credit_deducted boolean default false,
  notes text,
  created_at timestamptz default now(),
  unique(session_id, member_id)
);

-- 2. bookingsテーブルに回数券消費フラグを追加
alter table bookings
  add column if not exists credit_deducted boolean default false;

-- 3. RLSを有効化
alter table drop_in_attendances enable row level security;

-- 4. RLSポリシー: drop_in_attendances
drop policy if exists "Owner can manage drop-in attendances" on drop_in_attendances;
create policy "Owner can manage drop-in attendances"
  on drop_in_attendances for all
  using (
    studio_id in (
      select studio_id from profiles where id = auth.uid() and role = 'owner'
    )
  );

drop policy if exists "Instructor can view drop-in attendances" on drop_in_attendances;
create policy "Instructor can view drop-in attendances"
  on drop_in_attendances for select
  using (
    studio_id in (
      select studio_id from profiles where id = auth.uid() and role = 'instructor'
    )
  );

drop policy if exists "Member can view own drop-in attendances" on drop_in_attendances;
create policy "Member can view own drop-in attendances"
  on drop_in_attendances for select
  using (
    member_id in (
      select id from members where profile_id = auth.uid()
    )
  );

-- 5. 出席サマリー用のビュー
create or replace view session_attendance_summary as
select
  cs.id as session_id,
  cs.studio_id,
  cs.session_date,
  cs.class_id,
  c.name as class_name,
  cs.capacity,
  coalesce(
    (select count(*) from bookings b
     where b.session_id = cs.id and b.attended = true and b.status = 'confirmed'),
    0
  ) as booked_attended,
  coalesce(
    (select count(*) from drop_in_attendances d
     where d.session_id = cs.id),
    0
  ) as drop_in_attended,
  coalesce(
    (select count(*) from bookings b
     where b.session_id = cs.id and b.attended = true and b.status = 'confirmed'),
    0
  ) +
  coalesce(
    (select count(*) from drop_in_attendances d
     where d.session_id = cs.id),
    0
  ) as total_attended,
  coalesce(
    (select count(*) from bookings b
     where b.session_id = cs.id and b.status = 'confirmed'),
    0
  ) as total_booked
from class_sessions cs
join classes c on c.id = cs.class_id;
