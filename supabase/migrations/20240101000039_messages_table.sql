-- ============================================
-- messages テーブル
-- オーナー ↔ メンバー間のメッセージング
-- ============================================

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references studios(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- インデックス（スレッド取得・未読カウント用）
create index if not exists messages_studio_id_idx on messages(studio_id);
create index if not exists messages_recipient_id_idx on messages(recipient_id);
create index if not exists messages_sender_recipient_idx on messages(sender_id, recipient_id);
create index if not exists messages_created_at_idx on messages(created_at);

-- RLS 有効化
alter table messages enable row level security;

-- オーナーはスタジオ内の全メッセージを閲覧可
create policy "owner can see all studio messages"
  on messages for select
  using (
    studio_id in (
      select studio_id from profiles
      where id = auth.uid() and role = 'owner'
    )
  );

-- 自分が送受信したメッセージを閲覧可（メンバー用）
create policy "users can see own messages"
  on messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- sender_id = 自分でないと送信不可
create policy "users can send messages"
  on messages for insert
  with check (sender_id = auth.uid());

-- 受信者のみ既読更新可
create policy "recipient can mark as read"
  on messages for update
  using (recipient_id = auth.uid());
