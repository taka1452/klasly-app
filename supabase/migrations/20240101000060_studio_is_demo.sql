-- studios テーブルに is_demo フラグを追加
-- デモ・テスト用スタジオを Admin KPI から除外するために使用

alter table studios
  add column if not exists is_demo boolean not null default false;

comment on column studios.is_demo is
  'true の場合、Admin ダッシュボードの KPI 集計・スタジオ一覧から除外されるデモ/テストスタジオ';
