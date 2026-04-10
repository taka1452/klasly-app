-- ============================================
-- Klasly Demo Data Seed Script
-- Loom動画撮影用デモ環境
--
-- 使い方:
-- 1. Supabase Dashboard > SQL Editor にこのファイルの内容を貼り付け
-- 2. 「Run」で実行
-- 3. 各アカウントでログインして確認
--
-- クリーンアップ（このスクリプトのデータのみ）:
--   DELETE FROM studios WHERE id IN ('b0000001-0000-0000-0000-000000000001','b0000002-0000-0000-0000-000000000001');
--   DELETE FROM auth.users WHERE email LIKE 'demo-%@klasly.com';
-- ============================================

-- ============================================
-- 0. CLEANUP (このスクリプトが作ったデータのみ削除)
-- ============================================
-- SAFE: 固定UUIDのスタジオだけ削除（CASCADE で子テーブルも削除）
DELETE FROM studios WHERE id IN (
  'b0000001-0000-0000-0000-000000000001',
  'b0000002-0000-0000-0000-000000000001'
);
-- SAFE: 固定UUIDのprofilesだけ削除
DELETE FROM profiles WHERE id IN (
  'a0000001-0000-0000-0000-000000000001',
  'a0000001-0000-0000-0000-000000000002',
  'a0000001-0000-0000-0000-000000000003',
  'a0000001-0000-0000-0000-000000000004',
  'a0000001-0000-0000-0000-000000000005',
  'a0000002-0000-0000-0000-000000000001',
  'a0000002-0000-0000-0000-000000000002',
  'a0000002-0000-0000-0000-000000000003',
  'a0000002-0000-0000-0000-000000000004',
  'a0000002-0000-0000-0000-000000000005'
);
-- SAFE: このスクリプトが作ったランダムUUIDのprofiles（デモスタジオに紐づいていたもの）
-- → studios CASCADE で既に削除済みのはずだが念のため
DELETE FROM profiles WHERE studio_id IN (
  'b0000001-0000-0000-0000-000000000001',
  'b0000002-0000-0000-0000-000000000001'
);
-- SAFE: demo-*@klasly.com のauth userだけ削除
DELETE FROM auth.identities WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE 'demo-%@klasly.com'
);
DELETE FROM auth.users WHERE email LIKE 'demo-%@klasly.com';

-- ============================================
-- 1. FIXED UUIDs
-- ============================================
-- EN Studio
DO $$ BEGIN
  -- Auth User IDs
  PERFORM set_config('demo.en_owner_uid',   'a0000001-0000-0000-0000-000000000001', true);
  PERFORM set_config('demo.en_inst1_uid',   'a0000001-0000-0000-0000-000000000002', true);
  PERFORM set_config('demo.en_inst2_uid',   'a0000001-0000-0000-0000-000000000003', true);
  PERFORM set_config('demo.en_inst3_uid',   'a0000001-0000-0000-0000-000000000004', true);
  PERFORM set_config('demo.en_member_uid',  'a0000001-0000-0000-0000-000000000005', true);
  -- Studio
  PERFORM set_config('demo.en_studio_id',   'b0000001-0000-0000-0000-000000000001', true);
  -- Rooms
  PERFORM set_config('demo.en_room1',       'c0000001-0000-0000-0000-000000000001', true);
  PERFORM set_config('demo.en_room2',       'c0000001-0000-0000-0000-000000000002', true);
  PERFORM set_config('demo.en_room3',       'c0000001-0000-0000-0000-000000000003', true);
  -- Instructors
  PERFORM set_config('demo.en_instructor1', 'd0000001-0000-0000-0000-000000000001', true);
  PERFORM set_config('demo.en_instructor2', 'd0000001-0000-0000-0000-000000000002', true);
  PERFORM set_config('demo.en_instructor3', 'd0000001-0000-0000-0000-000000000003', true);

  -- JA Studio
  PERFORM set_config('demo.ja_owner_uid',   'a0000002-0000-0000-0000-000000000001', true);
  PERFORM set_config('demo.ja_inst1_uid',   'a0000002-0000-0000-0000-000000000002', true);
  PERFORM set_config('demo.ja_inst2_uid',   'a0000002-0000-0000-0000-000000000003', true);
  PERFORM set_config('demo.ja_inst3_uid',   'a0000002-0000-0000-0000-000000000004', true);
  PERFORM set_config('demo.ja_member_uid',  'a0000002-0000-0000-0000-000000000005', true);
  PERFORM set_config('demo.ja_studio_id',   'b0000002-0000-0000-0000-000000000001', true);
  PERFORM set_config('demo.ja_room1',       'c0000002-0000-0000-0000-000000000001', true);
  PERFORM set_config('demo.ja_room2',       'c0000002-0000-0000-0000-000000000002', true);
  PERFORM set_config('demo.ja_room3',       'c0000002-0000-0000-0000-000000000003', true);
  PERFORM set_config('demo.ja_instructor1', 'd0000002-0000-0000-0000-000000000001', true);
  PERFORM set_config('demo.ja_instructor2', 'd0000002-0000-0000-0000-000000000002', true);
  PERFORM set_config('demo.ja_instructor3', 'd0000002-0000-0000-0000-000000000003', true);
END $$;

-- ============================================
-- 2. AUTH USERS (6 accounts)
-- ============================================
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
VALUES
  -- EN
  (current_setting('demo.en_owner_uid')::uuid,  '00000000-0000-0000-0000-000000000000', 'demo-owner@klasly.com',      crypt('demo1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', 'authenticated', 'authenticated'),
  (current_setting('demo.en_inst1_uid')::uuid,   '00000000-0000-0000-0000-000000000000', 'demo-instructor@klasly.com', crypt('demo1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', 'authenticated', 'authenticated'),
  (current_setting('demo.en_inst2_uid')::uuid,   '00000000-0000-0000-0000-000000000000', 'demo-inst2@klasly.com',      crypt('demo1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', 'authenticated', 'authenticated'),
  (current_setting('demo.en_inst3_uid')::uuid,   '00000000-0000-0000-0000-000000000000', 'demo-inst3@klasly.com',      crypt('demo1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', 'authenticated', 'authenticated'),
  (current_setting('demo.en_member_uid')::uuid,  '00000000-0000-0000-0000-000000000000', 'demo-member@klasly.com',     crypt('demo1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', 'authenticated', 'authenticated'),
  -- JA
  (current_setting('demo.ja_owner_uid')::uuid,  '00000000-0000-0000-0000-000000000000', 'demo-owner-ja@klasly.com',      crypt('demo1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', 'authenticated', 'authenticated'),
  (current_setting('demo.ja_inst1_uid')::uuid,   '00000000-0000-0000-0000-000000000000', 'demo-instructor-ja@klasly.com', crypt('demo1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', 'authenticated', 'authenticated'),
  (current_setting('demo.ja_inst2_uid')::uuid,   '00000000-0000-0000-0000-000000000000', 'demo-inst2-ja@klasly.com',      crypt('demo1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', 'authenticated', 'authenticated'),
  (current_setting('demo.ja_inst3_uid')::uuid,   '00000000-0000-0000-0000-000000000000', 'demo-inst3-ja@klasly.com',      crypt('demo1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', 'authenticated', 'authenticated'),
  (current_setting('demo.ja_member_uid')::uuid,  '00000000-0000-0000-0000-000000000000', 'demo-member-ja@klasly.com',     crypt('demo1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', 'authenticated', 'authenticated');

-- Auth identities (required for Supabase auth to work)
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT id, id, json_build_object('sub', id::text, 'email', email), 'email', id::text, now(), now(), now()
FROM auth.users WHERE email LIKE 'demo-%@klasly.com';

-- ============================================
-- 3. STUDIOS
-- ============================================
INSERT INTO studios (id, name, email, phone, address, plan, plan_status, max_members, email_notifications_enabled, booking_requires_credits, payout_model, studio_fee_percentage, studio_fee_type, timezone, currency, is_demo, session_generation_weeks, created_at)
VALUES
  (current_setting('demo.en_studio_id')::uuid, 'Klasly Demo Studio', 'demo@klasly.com', '+1-555-0100', '123 Yoga Lane, San Francisco, CA 94102', 'pro', 'active', 100, true, false, 'studio', 20.0, 'percentage', 'America/Los_Angeles', 'usd', true, 8, now() - interval '6 months'),
  (current_setting('demo.ja_studio_id')::uuid, 'Klasly デモスタジオ', 'demo-ja@klasly.com', '03-1234-5678', '東京都渋谷区神宮前1-2-3', 'pro', 'active', 100, true, false, 'studio', 20.0, 'percentage', 'Asia/Tokyo', 'jpy', true, 8, now() - interval '6 months');

-- ============================================
-- 4. PROFILES
-- ============================================
INSERT INTO profiles (id, studio_id, role, full_name, email, onboarding_completed, onboarding_step, created_at)
VALUES
  -- EN Studio
  (current_setting('demo.en_owner_uid')::uuid,  current_setting('demo.en_studio_id')::uuid, 'owner',      'Alex Johnson',    'demo-owner@klasly.com',      true, 4, now() - interval '6 months'),
  (current_setting('demo.en_inst1_uid')::uuid,  current_setting('demo.en_studio_id')::uuid, 'instructor', 'Sarah Mitchell',  'demo-instructor@klasly.com', true, 4, now() - interval '5 months'),
  (current_setting('demo.en_inst2_uid')::uuid,  current_setting('demo.en_studio_id')::uuid, 'instructor', 'James Chen',      'demo-inst2@klasly.com',      true, 4, now() - interval '4 months'),
  (current_setting('demo.en_inst3_uid')::uuid,  current_setting('demo.en_studio_id')::uuid, 'instructor', 'Emma Roberts',    'demo-inst3@klasly.com',      true, 4, now() - interval '3 months'),
  (current_setting('demo.en_member_uid')::uuid, current_setting('demo.en_studio_id')::uuid, 'member',     'Taylor Williams', 'demo-member@klasly.com',     true, 4, now() - interval '2 months'),
  -- JA Studio
  (current_setting('demo.ja_owner_uid')::uuid,  current_setting('demo.ja_studio_id')::uuid, 'owner',      '山田太郎',   'demo-owner-ja@klasly.com',      true, 4, now() - interval '6 months'),
  (current_setting('demo.ja_inst1_uid')::uuid,  current_setting('demo.ja_studio_id')::uuid, 'instructor', '田中美咲',   'demo-instructor-ja@klasly.com', true, 4, now() - interval '5 months'),
  (current_setting('demo.ja_inst2_uid')::uuid,  current_setting('demo.ja_studio_id')::uuid, 'instructor', '佐藤健太',   'demo-inst2-ja@klasly.com',      true, 4, now() - interval '4 months'),
  (current_setting('demo.ja_inst3_uid')::uuid,  current_setting('demo.ja_studio_id')::uuid, 'instructor', '鈴木あかり', 'demo-inst3-ja@klasly.com',      true, 4, now() - interval '3 months'),
  (current_setting('demo.ja_member_uid')::uuid, current_setting('demo.ja_studio_id')::uuid, 'member',     '高橋花子',   'demo-member-ja@klasly.com',     true, 4, now() - interval '2 months');

-- ============================================
-- 5. ROOMS
-- ============================================
INSERT INTO rooms (id, studio_id, name, description, capacity, is_active, created_at)
VALUES
  -- EN
  (current_setting('demo.en_room1')::uuid, current_setting('demo.en_studio_id')::uuid, 'Main Studio',   'Spacious room with natural light, mirrors, and wood flooring', 20, true, now() - interval '6 months'),
  (current_setting('demo.en_room2')::uuid, current_setting('demo.en_studio_id')::uuid, 'Hot Room',      'Heated studio for hot yoga and power classes',                 15, true, now() - interval '6 months'),
  (current_setting('demo.en_room3')::uuid, current_setting('demo.en_studio_id')::uuid, 'Private Room',  'Intimate space for private sessions and meditation',            5, true, now() - interval '6 months'),
  -- JA
  (current_setting('demo.ja_room1')::uuid, current_setting('demo.ja_studio_id')::uuid, 'メインスタジオ',     '自然光が差し込む広々とした鏡付きスタジオ', 20, true, now() - interval '6 months'),
  (current_setting('demo.ja_room2')::uuid, current_setting('demo.ja_studio_id')::uuid, 'ホットルーム',       'ホットヨガ・パワークラス用の温熱スタジオ',   15, true, now() - interval '6 months'),
  (current_setting('demo.ja_room3')::uuid, current_setting('demo.ja_studio_id')::uuid, 'プライベートルーム', 'プライベートレッスン・瞑想用の静かな空間',     5, true, now() - interval '6 months');

-- ============================================
-- 6. INSTRUCTORS
-- ============================================
INSERT INTO instructors (id, studio_id, profile_id, bio, specialties, rental_type, rental_amount, created_at)
VALUES
  -- EN
  (current_setting('demo.en_instructor1')::uuid, current_setting('demo.en_studio_id')::uuid, current_setting('demo.en_inst1_uid')::uuid, 'Certified yoga instructor with 8 years of experience. Specializes in Vinyasa and Restorative yoga.',   ARRAY['Vinyasa', 'Restorative', 'Yin'], 'none', 0, now() - interval '5 months'),
  (current_setting('demo.en_instructor2')::uuid, current_setting('demo.en_studio_id')::uuid, current_setting('demo.en_inst2_uid')::uuid, 'Former athlete turned Pilates expert. Passionate about alignment and core strength.',                   ARRAY['Pilates', 'Core', 'Strength'], 'none', 0, now() - interval '4 months'),
  (current_setting('demo.en_instructor3')::uuid, current_setting('demo.en_studio_id')::uuid, current_setting('demo.en_inst3_uid')::uuid, 'Meditation and mindfulness teacher with a background in psychology.',                                    ARRAY['Meditation', 'Mindfulness', 'Breathwork'], 'none', 0, now() - interval '3 months'),
  -- JA
  (current_setting('demo.ja_instructor1')::uuid, current_setting('demo.ja_studio_id')::uuid, current_setting('demo.ja_inst1_uid')::uuid, 'ヨガ歴8年の認定インストラクター。ヴィンヤサとリストラティブヨガが得意です。',         ARRAY['ヴィンヤサ', 'リストラティブ', '陰ヨガ'], 'none', 0, now() - interval '5 months'),
  (current_setting('demo.ja_instructor2')::uuid, current_setting('demo.ja_studio_id')::uuid, current_setting('demo.ja_inst2_uid')::uuid, '元アスリートからピラティスインストラクターに。正しいアライメントとコア強化に情熱を注いでいます。', ARRAY['ピラティス', 'コア', 'ストレングス'], 'none', 0, now() - interval '4 months'),
  (current_setting('demo.ja_instructor3')::uuid, current_setting('demo.ja_studio_id')::uuid, current_setting('demo.ja_inst3_uid')::uuid, '心理学のバックグラウンドを持つ瞑想・マインドフルネス講師。',                         ARRAY['瞑想', 'マインドフルネス', '呼吸法'], 'none', 0, now() - interval '3 months');

-- ============================================
-- 7. MEMBERS (12 per studio: the login member + 11 extras)
-- ============================================
-- Helper: generate member UUIDs deterministically
DO $$
DECLARE
  en_studio uuid := current_setting('demo.en_studio_id')::uuid;
  ja_studio uuid := current_setting('demo.ja_studio_id')::uuid;
  en_names text[] := ARRAY['Olivia Parker', 'Liam Anderson', 'Sophia Garcia', 'Noah Martinez', 'Isabella Brown', 'Ethan Davis', 'Mia Wilson', 'Lucas Moore', 'Charlotte Lee', 'Mason Taylor', 'Amelia White'];
  ja_names text[] := ARRAY['佐々木美優', '中村大輝', '小林さくら', '加藤翔太', '吉田凛', '松本蓮', '井上楓', '木村陽斗', '清水結菜', '山本悠真', '藤田あおい'];
  en_emails text[] := ARRAY['olivia.p@example.com', 'liam.a@example.com', 'sophia.g@example.com', 'noah.m@example.com', 'isabella.b@example.com', 'ethan.d@example.com', 'mia.w@example.com', 'lucas.m@example.com', 'charlotte.l@example.com', 'mason.t@example.com', 'amelia.w@example.com'];
  ja_emails text[] := ARRAY['sasaki@example.com', 'nakamura@example.com', 'kobayashi@example.com', 'kato@example.com', 'yoshida@example.com', 'matsumoto@example.com', 'inoue@example.com', 'kimura@example.com', 'shimizu@example.com', 'yamamoto@example.com', 'fujita@example.com'];
  plan_types text[] := ARRAY['drop_in', 'monthly', 'drop_in', 'monthly', 'drop_in', 'monthly', 'drop_in', 'pack', 'monthly', 'drop_in', 'pack'];
  credits int[] := ARRAY[3, 0, 5, 0, 2, 0, 1, 8, 0, 4, 6];
  statuses text[] := ARRAY['active', 'active', 'active', 'active', 'active', 'active', 'active', 'active', 'active', 'active', 'active'];
  i int;
  profile_uid uuid;
  member_uid uuid;
BEGIN
  -- First: the login member accounts (already have auth users)
  -- EN member
  INSERT INTO members (id, studio_id, profile_id, plan_type, credits, status, joined_at, waiver_signed, created_at)
  VALUES (gen_random_uuid(), en_studio, current_setting('demo.en_member_uid')::uuid, 'monthly', 10, 'active', now() - interval '2 months', true, now() - interval '2 months');
  -- JA member
  INSERT INTO members (id, studio_id, profile_id, plan_type, credits, status, joined_at, waiver_signed, created_at)
  VALUES (gen_random_uuid(), ja_studio, current_setting('demo.ja_member_uid')::uuid, 'monthly', 10, 'active', now() - interval '2 months', true, now() - interval '2 months');

  -- Extra EN members (no auth user, just profiles + members for display)
  FOR i IN 1..11 LOOP
    profile_uid := gen_random_uuid();
    member_uid := gen_random_uuid();
    INSERT INTO profiles (id, studio_id, role, full_name, email, onboarding_completed, onboarding_step, created_at)
    VALUES (profile_uid, en_studio, 'member', en_names[i], en_emails[i], true, 4, now() - interval '3 months' + (i || ' days')::interval);
    INSERT INTO members (id, studio_id, profile_id, plan_type, credits, status, joined_at, waiver_signed, created_at)
    VALUES (member_uid, en_studio, profile_uid, plan_types[i], credits[i], statuses[i], now() - interval '3 months' + (i || ' days')::interval, true, now() - interval '3 months' + (i || ' days')::interval);
  END LOOP;

  -- Extra JA members
  FOR i IN 1..11 LOOP
    profile_uid := gen_random_uuid();
    member_uid := gen_random_uuid();
    INSERT INTO profiles (id, studio_id, role, full_name, email, onboarding_completed, onboarding_step, created_at)
    VALUES (profile_uid, ja_studio, 'member', ja_names[i], ja_emails[i], true, 4, now() - interval '3 months' + (i || ' days')::interval);
    INSERT INTO members (id, studio_id, profile_id, plan_type, credits, status, joined_at, waiver_signed, created_at)
    VALUES (member_uid, ja_studio, profile_uid, plan_types[i], credits[i], statuses[i], now() - interval '3 months' + (i || ' days')::interval, true, now() - interval '3 months' + (i || ' days')::interval);
  END LOOP;
END $$;

-- ============================================
-- 8. CLASS TEMPLATES + CLASSES (legacy)
-- ============================================
DO $$
DECLARE
  en_studio uuid := current_setting('demo.en_studio_id')::uuid;
  ja_studio uuid := current_setting('demo.ja_studio_id')::uuid;
  -- Class template IDs (shared between classes and class_templates)
  en_ct1 uuid := 'e0000001-0000-0000-0000-000000000001';
  en_ct2 uuid := 'e0000001-0000-0000-0000-000000000002';
  en_ct3 uuid := 'e0000001-0000-0000-0000-000000000003';
  en_ct4 uuid := 'e0000001-0000-0000-0000-000000000004';
  en_ct5 uuid := 'e0000001-0000-0000-0000-000000000005';
  en_ct6 uuid := 'e0000001-0000-0000-0000-000000000006';
  ja_ct1 uuid := 'e0000002-0000-0000-0000-000000000001';
  ja_ct2 uuid := 'e0000002-0000-0000-0000-000000000002';
  ja_ct3 uuid := 'e0000002-0000-0000-0000-000000000003';
  ja_ct4 uuid := 'e0000002-0000-0000-0000-000000000004';
  ja_ct5 uuid := 'e0000002-0000-0000-0000-000000000005';
  ja_ct6 uuid := 'e0000002-0000-0000-0000-000000000006';
BEGIN
  -- EN Classes (legacy table)
  INSERT INTO classes (id, studio_id, instructor_id, room_id, name, description, day_of_week, start_time, duration_minutes, capacity, location, is_active, is_public, price_cents, is_online, schedule_type, created_at)
  VALUES
    (en_ct1, en_studio, current_setting('demo.en_instructor1')::uuid, current_setting('demo.en_room1')::uuid, 'Morning Vinyasa Flow',  'Start your day with an energizing vinyasa flow. All levels welcome.',         1, '07:00', 60, 20, NULL, true, true, 2500, false, 'recurring', now() - interval '5 months'),
    (en_ct2, en_studio, current_setting('demo.en_instructor1')::uuid, current_setting('demo.en_room1')::uuid, 'Gentle Yoga',           'A slow, relaxing class focusing on flexibility and breath awareness.',        3, '11:00', 75, 20, NULL, true, true, 2000, false, 'recurring', now() - interval '5 months'),
    (en_ct3, en_studio, current_setting('demo.en_instructor2')::uuid, current_setting('demo.en_room1')::uuid, 'Power Pilates',         'Build core strength and improve posture with dynamic Pilates exercises.',     2, '17:00', 60, 15, NULL, true, true, 2500, false, 'recurring', now() - interval '4 months'),
    (en_ct4, en_studio, current_setting('demo.en_instructor3')::uuid, current_setting('demo.en_room3')::uuid, 'Mindful Meditation',    'Guided meditation for stress relief and mental clarity.',                     4, '07:30', 45, 5,  NULL, true, true, 1500, false, 'recurring', now() - interval '3 months'),
    (en_ct5, en_studio, current_setting('demo.en_instructor1')::uuid, current_setting('demo.en_room2')::uuid, 'Hot Yoga Basics',       'Traditional hot yoga sequence in our heated studio. Bring a towel!',          5, '09:00', 90, 15, NULL, true, true, 3000, false, 'recurring', now() - interval '4 months'),
    (en_ct6, en_studio, current_setting('demo.en_instructor3')::uuid, current_setting('demo.en_room1')::uuid, 'Restorative Stretch',   'Wind down with gentle stretching and restorative poses. Perfect for beginners.', 6, '17:00', 60, 20, NULL, true, true, 2000, false, 'recurring', now() - interval '3 months');

  -- EN Class Templates
  INSERT INTO class_templates (id, studio_id, instructor_id, room_id, name, description, duration_minutes, capacity, price_cents, class_type, is_active, is_public, sort_order, created_at)
  VALUES
    (en_ct1, en_studio, current_setting('demo.en_instructor1')::uuid, current_setting('demo.en_room1')::uuid, 'Morning Vinyasa Flow',  'Start your day with an energizing vinyasa flow. All levels welcome.',           60, 20, 2500, 'in_person', true, true, 1, now() - interval '5 months'),
    (en_ct2, en_studio, current_setting('demo.en_instructor1')::uuid, current_setting('demo.en_room1')::uuid, 'Gentle Yoga',           'A slow, relaxing class focusing on flexibility and breath awareness.',          75, 20, 2000, 'in_person', true, true, 2, now() - interval '5 months'),
    (en_ct3, en_studio, current_setting('demo.en_instructor2')::uuid, current_setting('demo.en_room1')::uuid, 'Power Pilates',         'Build core strength and improve posture with dynamic Pilates exercises.',       60, 15, 2500, 'in_person', true, true, 3, now() - interval '4 months'),
    (en_ct4, en_studio, current_setting('demo.en_instructor3')::uuid, current_setting('demo.en_room3')::uuid, 'Mindful Meditation',    'Guided meditation for stress relief and mental clarity.',                       45,  5, 1500, 'in_person', true, true, 4, now() - interval '3 months'),
    (en_ct5, en_studio, current_setting('demo.en_instructor1')::uuid, current_setting('demo.en_room2')::uuid, 'Hot Yoga Basics',       'Traditional hot yoga sequence in our heated studio. Bring a towel!',            90, 15, 3000, 'in_person', true, true, 5, now() - interval '4 months'),
    (en_ct6, en_studio, current_setting('demo.en_instructor3')::uuid, current_setting('demo.en_room1')::uuid, 'Restorative Stretch',   'Wind down with gentle stretching and restorative poses. Perfect for beginners.', 60, 20, 2000, 'in_person', true, true, 6, now() - interval '3 months');

  -- JA Classes (legacy table)
  INSERT INTO classes (id, studio_id, instructor_id, room_id, name, description, day_of_week, start_time, duration_minutes, capacity, location, is_active, is_public, price_cents, is_online, schedule_type, created_at)
  VALUES
    (ja_ct1, ja_studio, current_setting('demo.ja_instructor1')::uuid, current_setting('demo.ja_room1')::uuid, '朝のヴィンヤサフロー',   'エネルギッシュなヴィンヤサフローで一日をスタート。全レベル歓迎。',           1, '07:00', 60, 20, NULL, true, true, 3000, false, 'recurring', now() - interval '5 months'),
    (ja_ct2, ja_studio, current_setting('demo.ja_instructor1')::uuid, current_setting('demo.ja_room1')::uuid, 'やさしいヨガ',           '柔軟性と呼吸に焦点を当てたゆったりとしたクラスです。',                       3, '11:00', 75, 20, NULL, true, true, 2500, false, 'recurring', now() - interval '5 months'),
    (ja_ct3, ja_studio, current_setting('demo.ja_instructor2')::uuid, current_setting('demo.ja_room1')::uuid, 'パワーピラティス',       'ダイナミックなピラティスでコア強化と姿勢改善を目指します。',                 2, '17:00', 60, 15, NULL, true, true, 3000, false, 'recurring', now() - interval '4 months'),
    (ja_ct4, ja_studio, current_setting('demo.ja_instructor3')::uuid, current_setting('demo.ja_room3')::uuid, 'マインドフル瞑想',       'ストレス解消と心の明晰さのためのガイド付き瞑想。',                           4, '07:30', 45,  5, NULL, true, true, 2000, false, 'recurring', now() - interval '3 months'),
    (ja_ct5, ja_studio, current_setting('demo.ja_instructor1')::uuid, current_setting('demo.ja_room2')::uuid, 'ホットヨガ基礎',         '温熱スタジオでの伝統的なホットヨガ。タオルをお忘れなく！',                   5, '09:00', 90, 15, NULL, true, true, 3500, false, 'recurring', now() - interval '4 months'),
    (ja_ct6, ja_studio, current_setting('demo.ja_instructor3')::uuid, current_setting('demo.ja_room1')::uuid, 'リストラティブストレッチ', 'やさしいストレッチとリストラティブポーズ。初心者にぴったり。',               6, '17:00', 60, 20, NULL, true, true, 2500, false, 'recurring', now() - interval '3 months');

  -- JA Class Templates
  INSERT INTO class_templates (id, studio_id, instructor_id, room_id, name, description, duration_minutes, capacity, price_cents, class_type, is_active, is_public, sort_order, created_at)
  VALUES
    (ja_ct1, ja_studio, current_setting('demo.ja_instructor1')::uuid, current_setting('demo.ja_room1')::uuid, '朝のヴィンヤサフロー',   'エネルギッシュなヴィンヤサフローで一日をスタート。全レベル歓迎。',            60, 20, 3000, 'in_person', true, true, 1, now() - interval '5 months'),
    (ja_ct2, ja_studio, current_setting('demo.ja_instructor1')::uuid, current_setting('demo.ja_room1')::uuid, 'やさしいヨガ',           '柔軟性と呼吸に焦点を当てたゆったりとしたクラスです。',                        75, 20, 2500, 'in_person', true, true, 2, now() - interval '5 months'),
    (ja_ct3, ja_studio, current_setting('demo.ja_instructor2')::uuid, current_setting('demo.ja_room1')::uuid, 'パワーピラティス',       'ダイナミックなピラティスでコア強化と姿勢改善を目指します。',                  60, 15, 3000, 'in_person', true, true, 3, now() - interval '4 months'),
    (ja_ct4, ja_studio, current_setting('demo.ja_instructor3')::uuid, current_setting('demo.ja_room3')::uuid, 'マインドフル瞑想',       'ストレス解消と心の明晰さのためのガイド付き瞑想。',                            45,  5, 2000, 'in_person', true, true, 4, now() - interval '3 months'),
    (ja_ct5, ja_studio, current_setting('demo.ja_instructor1')::uuid, current_setting('demo.ja_room2')::uuid, 'ホットヨガ基礎',         '温熱スタジオでの伝統的なホットヨガ。タオルをお忘れなく！',                     90, 15, 3500, 'in_person', true, true, 5, now() - interval '4 months'),
    (ja_ct6, ja_studio, current_setting('demo.ja_instructor3')::uuid, current_setting('demo.ja_room1')::uuid, 'リストラティブストレッチ', 'やさしいストレッチとリストラティブポーズ。初心者にぴったり。',                60, 20, 2500, 'in_person', true, true, 6, now() - interval '3 months');
END $$;

-- ============================================
-- 9. CLASS SESSIONS (2 weeks: past 7 days + next 7 days)
-- ============================================
DO $$
DECLARE
  en_studio uuid := current_setting('demo.en_studio_id')::uuid;
  ja_studio uuid := current_setting('demo.ja_studio_id')::uuid;
  -- Schedule: [template_id, room_id, instructor_id, day_of_week, start_time, duration]
  -- We'll generate sessions for each day that matches the day_of_week
  d date;
  dow int;
  sess_id uuid;
  -- EN class IDs
  en_ct1 uuid := 'e0000001-0000-0000-0000-000000000001';
  en_ct2 uuid := 'e0000001-0000-0000-0000-000000000002';
  en_ct3 uuid := 'e0000001-0000-0000-0000-000000000003';
  en_ct4 uuid := 'e0000001-0000-0000-0000-000000000004';
  en_ct5 uuid := 'e0000001-0000-0000-0000-000000000005';
  en_ct6 uuid := 'e0000001-0000-0000-0000-000000000006';
  ja_ct1 uuid := 'e0000002-0000-0000-0000-000000000001';
  ja_ct2 uuid := 'e0000002-0000-0000-0000-000000000002';
  ja_ct3 uuid := 'e0000002-0000-0000-0000-000000000003';
  ja_ct4 uuid := 'e0000002-0000-0000-0000-000000000004';
  ja_ct5 uuid := 'e0000002-0000-0000-0000-000000000005';
  ja_ct6 uuid := 'e0000002-0000-0000-0000-000000000006';
BEGIN
  FOR d IN SELECT generate_series(CURRENT_DATE - 7, CURRENT_DATE + 7, '1 day')::date LOOP
    dow := EXTRACT(DOW FROM d)::int; -- 0=Sun, 1=Mon, ...

    -- EN Sessions
    -- Mon (1): Morning Vinyasa 7:00 (ct1)
    IF dow = 1 THEN
      INSERT INTO class_sessions (id, studio_id, class_id, template_id, room_id, instructor_id, session_date, start_time, end_time, duration_minutes, capacity, is_cancelled, is_public, session_type, created_at)
      VALUES (gen_random_uuid(), en_studio, en_ct1, en_ct1, current_setting('demo.en_room1')::uuid, current_setting('demo.en_instructor1')::uuid, d, '07:00', '08:00', 60, 20, false, true, 'class', now());
    END IF;
    -- Tue (2): Power Pilates 17:00 (ct3)
    IF dow = 2 THEN
      INSERT INTO class_sessions (id, studio_id, class_id, template_id, room_id, instructor_id, session_date, start_time, end_time, duration_minutes, capacity, is_cancelled, is_public, session_type, created_at)
      VALUES (gen_random_uuid(), en_studio, en_ct3, en_ct3, current_setting('demo.en_room1')::uuid, current_setting('demo.en_instructor2')::uuid, d, '17:00', '18:00', 60, 15, false, true, 'class', now());
    END IF;
    -- Wed (3): Gentle Yoga 11:00 (ct2)
    IF dow = 3 THEN
      INSERT INTO class_sessions (id, studio_id, class_id, template_id, room_id, instructor_id, session_date, start_time, end_time, duration_minutes, capacity, is_cancelled, is_public, session_type, created_at)
      VALUES (gen_random_uuid(), en_studio, en_ct2, en_ct2, current_setting('demo.en_room1')::uuid, current_setting('demo.en_instructor1')::uuid, d, '11:00', '12:15', 75, 20, false, true, 'class', now());
    END IF;
    -- Thu (4): Mindful Meditation 7:30 (ct4) + Morning Vinyasa 7:00 (ct1 extra)
    IF dow = 4 THEN
      INSERT INTO class_sessions (id, studio_id, class_id, template_id, room_id, instructor_id, session_date, start_time, end_time, duration_minutes, capacity, is_cancelled, is_public, session_type, created_at)
      VALUES (gen_random_uuid(), en_studio, en_ct4, en_ct4, current_setting('demo.en_room3')::uuid, current_setting('demo.en_instructor3')::uuid, d, '07:30', '08:15', 45, 5, false, true, 'class', now());
      INSERT INTO class_sessions (id, studio_id, class_id, template_id, room_id, instructor_id, session_date, start_time, end_time, duration_minutes, capacity, is_cancelled, is_public, session_type, created_at)
      VALUES (gen_random_uuid(), en_studio, en_ct1, en_ct1, current_setting('demo.en_room1')::uuid, current_setting('demo.en_instructor1')::uuid, d, '07:00', '08:00', 60, 20, false, true, 'class', now());
    END IF;
    -- Fri (5): Hot Yoga 9:00 (ct5)
    IF dow = 5 THEN
      INSERT INTO class_sessions (id, studio_id, class_id, template_id, room_id, instructor_id, session_date, start_time, end_time, duration_minutes, capacity, is_cancelled, is_public, session_type, created_at)
      VALUES (gen_random_uuid(), en_studio, en_ct5, en_ct5, current_setting('demo.en_room2')::uuid, current_setting('demo.en_instructor1')::uuid, d, '09:00', '10:30', 90, 15, false, true, 'class', now());
    END IF;
    -- Sat (6): Restorative Stretch 17:00 (ct6) + Power Pilates 11:00 (ct3 extra)
    IF dow = 6 THEN
      INSERT INTO class_sessions (id, studio_id, class_id, template_id, room_id, instructor_id, session_date, start_time, end_time, duration_minutes, capacity, is_cancelled, is_public, session_type, created_at)
      VALUES (gen_random_uuid(), en_studio, en_ct6, en_ct6, current_setting('demo.en_room1')::uuid, current_setting('demo.en_instructor3')::uuid, d, '17:00', '18:00', 60, 20, false, true, 'class', now());
      INSERT INTO class_sessions (id, studio_id, class_id, template_id, room_id, instructor_id, session_date, start_time, end_time, duration_minutes, capacity, is_cancelled, is_public, session_type, created_at)
      VALUES (gen_random_uuid(), en_studio, en_ct3, en_ct3, current_setting('demo.en_room1')::uuid, current_setting('demo.en_instructor2')::uuid, d, '11:00', '12:00', 60, 15, false, true, 'class', now());
    END IF;

    -- JA Sessions (same schedule pattern)
    IF dow = 1 THEN
      INSERT INTO class_sessions (id, studio_id, class_id, template_id, room_id, instructor_id, session_date, start_time, end_time, duration_minutes, capacity, is_cancelled, is_public, session_type, created_at)
      VALUES (gen_random_uuid(), ja_studio, ja_ct1, ja_ct1, current_setting('demo.ja_room1')::uuid, current_setting('demo.ja_instructor1')::uuid, d, '07:00', '08:00', 60, 20, false, true, 'class', now());
    END IF;
    IF dow = 2 THEN
      INSERT INTO class_sessions (id, studio_id, class_id, template_id, room_id, instructor_id, session_date, start_time, end_time, duration_minutes, capacity, is_cancelled, is_public, session_type, created_at)
      VALUES (gen_random_uuid(), ja_studio, ja_ct3, ja_ct3, current_setting('demo.ja_room1')::uuid, current_setting('demo.ja_instructor2')::uuid, d, '17:00', '18:00', 60, 15, false, true, 'class', now());
    END IF;
    IF dow = 3 THEN
      INSERT INTO class_sessions (id, studio_id, class_id, template_id, room_id, instructor_id, session_date, start_time, end_time, duration_minutes, capacity, is_cancelled, is_public, session_type, created_at)
      VALUES (gen_random_uuid(), ja_studio, ja_ct2, ja_ct2, current_setting('demo.ja_room1')::uuid, current_setting('demo.ja_instructor1')::uuid, d, '11:00', '12:15', 75, 20, false, true, 'class', now());
    END IF;
    IF dow = 4 THEN
      INSERT INTO class_sessions (id, studio_id, class_id, template_id, room_id, instructor_id, session_date, start_time, end_time, duration_minutes, capacity, is_cancelled, is_public, session_type, created_at)
      VALUES (gen_random_uuid(), ja_studio, ja_ct4, ja_ct4, current_setting('demo.ja_room3')::uuid, current_setting('demo.ja_instructor3')::uuid, d, '07:30', '08:15', 45, 5, false, true, 'class', now());
      INSERT INTO class_sessions (id, studio_id, class_id, template_id, room_id, instructor_id, session_date, start_time, end_time, duration_minutes, capacity, is_cancelled, is_public, session_type, created_at)
      VALUES (gen_random_uuid(), ja_studio, ja_ct1, ja_ct1, current_setting('demo.ja_room1')::uuid, current_setting('demo.ja_instructor1')::uuid, d, '07:00', '08:00', 60, 20, false, true, 'class', now());
    END IF;
    IF dow = 5 THEN
      INSERT INTO class_sessions (id, studio_id, class_id, template_id, room_id, instructor_id, session_date, start_time, end_time, duration_minutes, capacity, is_cancelled, is_public, session_type, created_at)
      VALUES (gen_random_uuid(), ja_studio, ja_ct5, ja_ct5, current_setting('demo.ja_room2')::uuid, current_setting('demo.ja_instructor1')::uuid, d, '09:00', '10:30', 90, 15, false, true, 'class', now());
    END IF;
    IF dow = 6 THEN
      INSERT INTO class_sessions (id, studio_id, class_id, template_id, room_id, instructor_id, session_date, start_time, end_time, duration_minutes, capacity, is_cancelled, is_public, session_type, created_at)
      VALUES (gen_random_uuid(), ja_studio, ja_ct6, ja_ct6, current_setting('demo.ja_room1')::uuid, current_setting('demo.ja_instructor3')::uuid, d, '17:00', '18:00', 60, 20, false, true, 'class', now());
      INSERT INTO class_sessions (id, studio_id, class_id, template_id, room_id, instructor_id, session_date, start_time, end_time, duration_minutes, capacity, is_cancelled, is_public, session_type, created_at)
      VALUES (gen_random_uuid(), ja_studio, ja_ct3, ja_ct3, current_setting('demo.ja_room1')::uuid, current_setting('demo.ja_instructor2')::uuid, d, '11:00', '12:00', 60, 15, false, true, 'class', now());
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 10. BOOKINGS (random members for past sessions)
-- ============================================
DO $$
DECLARE
  sess record;
  mem record;
  booking_count int;
  i int;
BEGIN
  -- For each past session in demo studios, add 3-8 bookings
  FOR sess IN
    SELECT cs.id as session_id, cs.studio_id, cs.session_date
    FROM class_sessions cs
    JOIN studios s ON s.id = cs.studio_id
    WHERE s.is_demo = true AND cs.session_date <= CURRENT_DATE
    ORDER BY cs.session_date
  LOOP
    booking_count := 3 + floor(random() * 6)::int; -- 3 to 8
    i := 0;
    FOR mem IN
      SELECT m.id FROM members m WHERE m.studio_id = sess.studio_id ORDER BY random() LIMIT booking_count
    LOOP
      i := i + 1;
      INSERT INTO bookings (id, studio_id, session_id, member_id, status, attended, credit_deducted, created_at)
      VALUES (
        gen_random_uuid(), sess.studio_id, sess.session_id, mem.id,
        CASE WHEN random() < 0.9 THEN 'confirmed' ELSE 'cancelled' END,
        CASE WHEN sess.session_date < CURRENT_DATE AND random() < 0.85 THEN true ELSE false END,
        false,
        sess.session_date - interval '2 days'
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- For future sessions, add 2-5 bookings
  FOR sess IN
    SELECT cs.id as session_id, cs.studio_id, cs.session_date
    FROM class_sessions cs
    JOIN studios s ON s.id = cs.studio_id
    WHERE s.is_demo = true AND cs.session_date > CURRENT_DATE
    ORDER BY cs.session_date
  LOOP
    booking_count := 2 + floor(random() * 4)::int; -- 2 to 5
    FOR mem IN
      SELECT m.id FROM members m WHERE m.studio_id = sess.studio_id ORDER BY random() LIMIT booking_count
    LOOP
      INSERT INTO bookings (id, studio_id, session_id, member_id, status, attended, credit_deducted, created_at)
      VALUES (gen_random_uuid(), sess.studio_id, sess.session_id, mem.id, 'confirmed', false, false, now() - interval '1 day')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- 11. PAYMENTS (past 3 months)
-- ============================================
DO $$
DECLARE
  en_studio uuid := current_setting('demo.en_studio_id')::uuid;
  ja_studio uuid := current_setting('demo.ja_studio_id')::uuid;
  mem record;
  pay_date timestamptz;
  m int;
BEGIN
  -- EN payments
  FOR m IN 0..2 LOOP
    FOR mem IN SELECT id FROM members WHERE studio_id = en_studio ORDER BY random() LIMIT 5 LOOP
      pay_date := now() - (m || ' months')::interval - (floor(random() * 15) || ' days')::interval;
      INSERT INTO payments (id, studio_id, member_id, amount, currency, type, status, description, paid_at, created_at)
      VALUES (gen_random_uuid(), en_studio, mem.id,
        CASE WHEN random() < 0.5 THEN 2500 ELSE 5000 END,
        'usd',
        CASE WHEN random() < 0.5 THEN 'drop_in' ELSE 'monthly' END,
        'paid', 'Class payment', pay_date, pay_date);
    END LOOP;
  END LOOP;

  -- JA payments
  FOR m IN 0..2 LOOP
    FOR mem IN SELECT id FROM members WHERE studio_id = ja_studio ORDER BY random() LIMIT 5 LOOP
      pay_date := now() - (m || ' months')::interval - (floor(random() * 15) || ' days')::interval;
      INSERT INTO payments (id, studio_id, member_id, amount, currency, type, status, description, paid_at, created_at)
      VALUES (gen_random_uuid(), ja_studio, mem.id,
        CASE WHEN random() < 0.5 THEN 3000 ELSE 8000 END,
        'jpy',
        CASE WHEN random() < 0.5 THEN 'drop_in' ELSE 'monthly' END,
        'paid', 'クラス支払い', pay_date, pay_date);
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- 12. FEATURE FLAGS (enable key extensions)
-- ============================================
INSERT INTO studio_features (studio_id, feature_key, enabled) VALUES
  -- EN Studio
  (current_setting('demo.en_studio_id')::uuid, 'extension.class_reviews', true),
  (current_setting('demo.en_studio_id')::uuid, 'extension.community', true),
  (current_setting('demo.en_studio_id')::uuid, 'extension.achievements', true),
  (current_setting('demo.en_studio_id')::uuid, 'extension.favorites', true),
  (current_setting('demo.en_studio_id')::uuid, 'extension.analytics', true),
  (current_setting('demo.en_studio_id')::uuid, 'extension.studio_pass', true),
  (current_setting('demo.en_studio_id')::uuid, 'extension.video_content', true),
  (current_setting('demo.en_studio_id')::uuid, 'extension.email_campaigns', true),
  (current_setting('demo.en_studio_id')::uuid, 'extension.appointments', true),
  (current_setting('demo.en_studio_id')::uuid, 'collective.room_management', true),
  -- JA Studio
  (current_setting('demo.ja_studio_id')::uuid, 'extension.class_reviews', true),
  (current_setting('demo.ja_studio_id')::uuid, 'extension.community', true),
  (current_setting('demo.ja_studio_id')::uuid, 'extension.achievements', true),
  (current_setting('demo.ja_studio_id')::uuid, 'extension.favorites', true),
  (current_setting('demo.ja_studio_id')::uuid, 'extension.analytics', true),
  (current_setting('demo.ja_studio_id')::uuid, 'extension.studio_pass', true),
  (current_setting('demo.ja_studio_id')::uuid, 'extension.video_content', true),
  (current_setting('demo.ja_studio_id')::uuid, 'extension.email_campaigns', true),
  (current_setting('demo.ja_studio_id')::uuid, 'extension.appointments', true),
  (current_setting('demo.ja_studio_id')::uuid, 'collective.room_management', true);

-- ============================================
-- 13. COMMUNITY POSTS & COMMENTS
-- ============================================
DO $$
DECLARE
  en_studio uuid := current_setting('demo.en_studio_id')::uuid;
  ja_studio uuid := current_setting('demo.ja_studio_id')::uuid;
  en_post1 uuid := gen_random_uuid();
  en_post2 uuid := gen_random_uuid();
  en_post3 uuid := gen_random_uuid();
  ja_post1 uuid := gen_random_uuid();
  ja_post2 uuid := gen_random_uuid();
  ja_post3 uuid := gen_random_uuid();
  en_member_profile uuid;
  ja_member_profile uuid;
BEGIN
  -- Get a random member profile for comments
  SELECT p.id INTO en_member_profile FROM profiles p JOIN members m ON m.profile_id = p.id WHERE m.studio_id = en_studio AND p.id != current_setting('demo.en_owner_uid')::uuid LIMIT 1;
  SELECT p.id INTO ja_member_profile FROM profiles p JOIN members m ON m.profile_id = p.id WHERE m.studio_id = ja_studio AND p.id != current_setting('demo.ja_owner_uid')::uuid LIMIT 1;

  -- EN Posts
  INSERT INTO community_posts (id, studio_id, author_id, author_role, title, content, created_at) VALUES
    (en_post1, en_studio, current_setting('demo.en_owner_uid')::uuid, 'owner', 'Welcome to our community!', 'We are excited to launch our online community space! Share your practice, ask questions, and connect with fellow yogis.', now() - interval '14 days'),
    (en_post2, en_studio, current_setting('demo.en_inst1_uid')::uuid, 'instructor', 'Tips for your home practice', 'Here are 5 tips to maintain a consistent home yoga practice between studio visits. Consistency is more important than duration!', now() - interval '7 days'),
    (en_post3, en_studio, current_setting('demo.en_member_uid')::uuid, 'member', 'First month experience', 'Just completed my first month at the studio and I am loving it! The Morning Vinyasa class is my favorite.', now() - interval '3 days');

  -- EN Comments
  INSERT INTO community_comments (post_id, author_id, author_role, content, created_at) VALUES
    (en_post1, current_setting('demo.en_member_uid')::uuid, 'member', 'This is great! Looking forward to connecting with everyone.', now() - interval '13 days'),
    (en_post1, current_setting('demo.en_inst1_uid')::uuid, 'instructor', 'Welcome everyone! Feel free to ask any questions about the classes.', now() - interval '12 days'),
    (en_post2, en_member_profile, 'member', 'These tips are really helpful, thank you Sarah!', now() - interval '6 days'),
    (en_post3, current_setting('demo.en_inst1_uid')::uuid, 'instructor', 'So glad you are enjoying it! See you in class.', now() - interval '2 days');

  -- JA Posts
  INSERT INTO community_posts (id, studio_id, author_id, author_role, title, content, created_at) VALUES
    (ja_post1, ja_studio, current_setting('demo.ja_owner_uid')::uuid, 'owner', 'コミュニティへようこそ！', 'オンラインコミュニティスペースをオープンしました！練習の共有、質問、仲間との交流にご活用ください。', now() - interval '14 days'),
    (ja_post2, ja_studio, current_setting('demo.ja_inst1_uid')::uuid, 'instructor', '自宅練習のコツ', 'スタジオの合間に自宅で続けるヨガ練習のコツを5つご紹介します。大切なのは時間の長さより継続性です！', now() - interval '7 days'),
    (ja_post3, ja_studio, current_setting('demo.ja_member_uid')::uuid, 'member', '入会1ヶ月の感想', 'スタジオに通い始めて1ヶ月が経ちました。朝のヴィンヤサフローがお気に入りです！', now() - interval '3 days');

  -- JA Comments
  INSERT INTO community_comments (post_id, author_id, author_role, content, created_at) VALUES
    (ja_post1, current_setting('demo.ja_member_uid')::uuid, 'member', '素敵ですね！皆さんとの交流を楽しみにしています。', now() - interval '13 days'),
    (ja_post1, current_setting('demo.ja_inst1_uid')::uuid, 'instructor', 'ようこそ！クラスに関する質問はいつでもどうぞ。', now() - interval '12 days'),
    (ja_post2, ja_member_profile, 'member', 'とても参考になります。ありがとうございます、美咲先生！', now() - interval '6 days'),
    (ja_post3, current_setting('demo.ja_inst1_uid')::uuid, 'instructor', '楽しんでいただけて嬉しいです！またクラスでお会いしましょう。', now() - interval '2 days');
END $$;

-- ============================================
-- 14. CLASS REVIEWS
-- ============================================
DO $$
DECLARE
  sess record;
  mem record;
  review_count int := 0;
BEGIN
  -- Add reviews for past sessions (max 8 per studio)
  FOR sess IN
    SELECT cs.id as session_id, cs.studio_id, cs.class_id, cs.instructor_id
    FROM class_sessions cs
    JOIN studios s ON s.id = cs.studio_id
    WHERE s.is_demo = true
      AND cs.session_date < CURRENT_DATE
      AND cs.class_id IS NOT NULL
    ORDER BY cs.session_date DESC
    LIMIT 20
  LOOP
    EXIT WHEN review_count >= 16; -- 8 per studio max
    FOR mem IN
      SELECT b.member_id FROM bookings b
      WHERE b.session_id = sess.session_id AND b.status = 'confirmed' AND b.attended = true
      ORDER BY random() LIMIT 1
    LOOP
      INSERT INTO class_reviews (studio_id, member_id, session_id, class_id, instructor_id, rating, comment, created_at)
      VALUES (
        sess.studio_id, mem.member_id, sess.session_id, sess.class_id, sess.instructor_id,
        4 + floor(random() * 2)::int, -- 4 or 5 stars
        CASE floor(random() * 5)::int
          WHEN 0 THEN 'Amazing class! Felt so refreshed afterwards.'
          WHEN 1 THEN 'Great instructor, very attentive to form corrections.'
          WHEN 2 THEN 'Perfect way to start/end the day. Highly recommend!'
          WHEN 3 THEN 'Loved the energy in this class. Will definitely come back.'
          WHEN 4 THEN 'Challenging but rewarding. Thank you!'
        END,
        now() - (floor(random() * 7) || ' days')::interval
      )
      ON CONFLICT DO NOTHING;
      review_count := review_count + 1;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- 15. PRODUCTS (pricing options)
-- ============================================
INSERT INTO products (id, studio_id, name, type, credits, price, currency, description, is_active, sort_order, created_at)
VALUES
  -- EN
  (gen_random_uuid(), current_setting('demo.en_studio_id')::uuid, 'Drop-In Class',    'one_time',     1, 2500, 'usd', 'Single class visit',           true, 1, now() - interval '5 months'),
  (gen_random_uuid(), current_setting('demo.en_studio_id')::uuid, '5-Class Pack',     'one_time',     5, 10000, 'usd', 'Save 20% with a 5-class pack', true, 2, now() - interval '5 months'),
  (gen_random_uuid(), current_setting('demo.en_studio_id')::uuid, '10-Class Pack',    'one_time',    10, 17500, 'usd', 'Save 30% with a 10-class pack', true, 3, now() - interval '5 months'),
  (gen_random_uuid(), current_setting('demo.en_studio_id')::uuid, 'Monthly Unlimited','subscription', 0, 14900, 'usd', 'Unlimited classes for one month', true, 4, now() - interval '5 months'),
  -- JA
  (gen_random_uuid(), current_setting('demo.ja_studio_id')::uuid, 'ドロップイン',      'one_time',     1, 3000, 'jpy', '1回分のクラス参加',             true, 1, now() - interval '5 months'),
  (gen_random_uuid(), current_setting('demo.ja_studio_id')::uuid, '5回チケット',       'one_time',     5, 12000, 'jpy', '20%お得な5回パック',            true, 2, now() - interval '5 months'),
  (gen_random_uuid(), current_setting('demo.ja_studio_id')::uuid, '10回チケット',      'one_time',    10, 21000, 'jpy', '30%お得な10回パック',           true, 3, now() - interval '5 months'),
  (gen_random_uuid(), current_setting('demo.ja_studio_id')::uuid, '月額フリーパス',    'subscription', 0, 15000, 'jpy', '1ヶ月間クラス通い放題',         true, 4, now() - interval '5 months');

-- ============================================
-- DONE!
-- ============================================
-- Login accounts:
-- EN Owner:      demo-owner@klasly.com / demo1234
-- EN Instructor: demo-instructor@klasly.com / demo1234
-- EN Member:     demo-member@klasly.com / demo1234
-- JA Owner:      demo-owner-ja@klasly.com / demo1234
-- JA Instructor: demo-instructor-ja@klasly.com / demo1234
-- JA Member:     demo-member-ja@klasly.com / demo1234
