-- ============================================
-- Klasly Instructorポータル - データベースセットアップ
-- Supabase SQL Editor で実行してください
-- ============================================

-- 1. RLSポリシー追加: Instructorが自分のクラスのセッションを閲覧可能
-- ※ class_sessions, bookings に RLS が未設定の場合は先に有効化してください

drop policy if exists "Instructor can view own class sessions" on class_sessions;
create policy "Instructor can view own class sessions"
  on class_sessions for select
  using (
    class_id in (
      select c.id from classes c
      join instructors i on i.id = c.instructor_id
      where i.profile_id = auth.uid()
    )
  );

drop policy if exists "Instructor can view own class bookings" on bookings;
create policy "Instructor can view own class bookings"
  on bookings for select
  using (
    session_id in (
      select cs.id from class_sessions cs
      join classes c on c.id = cs.class_id
      join instructors i on i.id = c.instructor_id
      where i.profile_id = auth.uid()
    )
  );

-- drop_in_attendances（出席管理機能実装済みの場合）
-- テーブルが存在する場合のみ実行。存在しない場合はスキップ
drop policy if exists "Instructor can view own class drop-in attendances" on drop_in_attendances;
create policy "Instructor can view own class drop-in attendances"
  on drop_in_attendances for select
  using (
    session_id in (
      select cs.id from class_sessions cs
      join classes c on c.id = cs.class_id
      join instructors i on i.id = c.instructor_id
      where i.profile_id = auth.uid()
    )
  );

-- 2. instructorsテーブル: Instructorが自分のプロフィールを更新可能
-- ※ RLSが未設定の場合は: alter table instructors enable row level security;

drop policy if exists "Instructor can update own profile" on instructors;
create policy "Instructor can update own profile"
  on instructors for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "Instructor can view own instructor record" on instructors;
create policy "Instructor can view own instructor record"
  on instructors for select
  using (profile_id = auth.uid());
