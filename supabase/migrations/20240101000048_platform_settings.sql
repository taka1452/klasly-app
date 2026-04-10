-- platform_settings テーブル
-- Klasly プラットフォーム全体の管理設定（Admin専用）
-- key/value形式でプラットフォーム手数料などを管理する

create table if not exists platform_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);

-- RLS 有効化（APIレベルでAdmin認証を行うためポリシーはすべて拒否）
alter table platform_settings enable row level security;

-- 全操作をRLSでブロック（API側のservice role keyによるアクセスのみ許可）
create policy "Block direct client access"
  on platform_settings
  for all
  using (false)
  with check (false);

-- 初期値: プラットフォーム手数料 0.5%
insert into platform_settings (key, value, updated_at)
  values ('platform_fee_percent', '0.5', now())
  on conflict (key) do nothing;
