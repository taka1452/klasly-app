-- RLS: オーナーが自スタジオの profiles（会員）を更新できるようにする
-- Supabase SQL Editor で実行

create policy "owner can update studio profiles"
on profiles for update
using (
  studio_id in (
    select studio_id from profiles
    where id = auth.uid() and role = 'owner'
  )
);
