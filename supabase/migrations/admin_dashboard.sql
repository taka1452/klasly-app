-- ============================================
-- Klasly Admin Dashboard - データベースセットアップ
-- Supabase SQL Editor で実行してください
-- ============================================

-- ========== 管理系テーブル ==========

-- 1. スタジオ管理メモ
create table if not exists admin_notes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id) on delete cascade not null,
  content text not null,
  created_by text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. サポートチケット
create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number serial unique,
  studio_id uuid references studios(id) on delete set null,
  subject text not null,
  description text,
  status text not null default 'open',
  priority text not null default 'medium',
  created_by text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. チケットコメント
create table if not exists support_ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references support_tickets(id) on delete cascade not null,
  content text not null,
  created_by text not null,
  created_at timestamptz default now()
);

-- ========== ログ系テーブル ==========

-- 4. Webhookログ
create table if not exists webhook_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_id text,
  studio_id uuid references studios(id) on delete set null,
  status text not null default 'success',
  payload jsonb,
  error_message text,
  created_at timestamptz default now()
);

create index if not exists idx_webhook_logs_created_at on webhook_logs(created_at desc);
create index if not exists idx_webhook_logs_event_type on webhook_logs(event_type);
create index if not exists idx_webhook_logs_studio_id on webhook_logs(studio_id);

-- 5. Cronジョブログ
create table if not exists cron_logs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null default 'success',
  affected_count int default 0,
  details jsonb,
  error_message text,
  started_at timestamptz default now(),
  completed_at timestamptz
);

create index if not exists idx_cron_logs_started_at on cron_logs(started_at desc);

-- 6. メール送信ログ
create table if not exists email_logs (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id) on delete set null,
  to_email text not null,
  template text not null,
  subject text,
  status text not null default 'sent',
  resend_id text,
  error_message text,
  created_at timestamptz default now()
);

create index if not exists idx_email_logs_created_at on email_logs(created_at desc);
create index if not exists idx_email_logs_studio_id on email_logs(studio_id);

-- ========== クーポン系テーブル ==========

-- 7. クーポン（割引ルール）
create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  stripe_coupon_id text not null unique,
  name text not null,
  discount_type text not null,
  discount_value numeric not null,
  duration text not null,
  duration_months int,
  status text not null default 'active',
  notes text,
  created_by text not null,
  created_at timestamptz default now()
);

-- 8. プロモーションコード
create table if not exists promotion_codes (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid references coupons(id) on delete cascade not null,
  stripe_promo_id text not null unique,
  code text not null,
  max_redemptions int,
  times_redeemed int default 0,
  expires_at timestamptz,
  first_time_only boolean default true,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_promotion_codes_code on promotion_codes(code);

-- 9. クーポン利用履歴
create table if not exists coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id) on delete cascade not null,
  coupon_id uuid references coupons(id) on delete cascade not null,
  promotion_code_id uuid references promotion_codes(id) on delete set null,
  stripe_subscription_id text,
  redeemed_at timestamptz default now()
);

-- ========== studiosテーブルへの追加 ==========
alter table studios
  add column if not exists admin_memo text;
