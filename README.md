# Klasly — Studio Management App

**Built for small studios. Not enterprise gyms.**

小規模ヨガ・フィットネス・ダンス・ピラティス・ボディワーク系スタジオ向けのオールインワン管理ツール（会員 30〜300 名規模）。会員管理・スケジュール・予約・決済・コミュニケーション・コンテンツ配信までを一画面でまかなう SaaS。

---

## Tech Stack

| 項目 | 技術 |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend / DB / Auth | Supabase (PostgreSQL + Auth + RLS) |
| Hosting | Vercel |
| Payment | Stripe + **Stripe Connect**（スタジオごとに直接受領） |
| Email | Resend (`notifications@klasly.app`) |
| Push | Web Push（VAPID）+ Service Worker（PWA） |
| Domain | klasly.app (Porkbun) |

## URL構成

| URL | 用途 |
|---|---|
| klasly.app | LP（静的 HTML） |
| app.klasly.app | Web アプリ（Next.js） |
| app.klasly.app/s/`<slug>` | スタジオごとの公開ブッキングページ |
| app.klasly.app/widget/`<slug>` | WordPress 等への iframe 埋め込み |

## 料金プラン

- **Pro $19/月** または **$190/年**（約 17% 割引）
- 30 日間無料トライアル
- 無料プランなし

---

## ユーザーロール

| ロール | 説明 | デフォルトページ |
|---|---|---|
| Admin | Klasly システム管理者（`ADMIN_EMAILS` で制御） | `/admin` |
| Owner | スタジオオーナー。全機能にアクセス可能 | `/dashboard` |
| Manager | Owner が権限を細かく付与（後述） | Owner と同じレイアウト・付与権限の範囲のみ |
| Instructor | 自分のクラス・予約者・収益・部屋予約・契約 | `/instructor` |
| Member | 予約・残回数・パス・支払い・メッセージ・実績 | `/schedule` |

### Manager 権限フラグ（`managers.permissions_*`）

`can_manage_members` / `can_manage_classes` / `can_manage_bookings` / `can_manage_instructors` / `can_manage_payments` / `can_manage_settings` / `can_manage_rooms` / `can_manage_announcements` / `can_manage_contracts` / `can_manage_events` / `can_manage_passes` / `can_manage_campaigns` / `can_manage_videos` 等。

---

## 機能一覧

### Phase 1: コア（MVP）
- 認証（メール/パスワード・パスワードリセット・OAuth コールバック）
- スタジオオンボーディング（7 ステップウィザード）
- 会員管理（CRUD・必須属性: name/email/phone/DOB/gender、CSV インポート）
- インストラクター管理（CRUD・自己招待リンク・CSV インポート）
- クラステンプレート（曜日・時間・定員・部屋・価格・繰り返し終了日・遷移時間・特定日スキップ・複製）
- セッション自動生成（cron で 4 週間先まで延伸、Never-ending repeat 対応）
- 予約（クラス予約・キャンセル・定員管理・キャンセル待ち・自動繰り上げ）
- ダッシュボード（KPI・セットアップタスク・クイックアクション）
- ロール別アクセス制御（RLS + ミドルウェア）

### Phase 2: 決済
- Stripe Connect（国別オンボーディング、postal/bank format 自動切替、再オンボード）
- 月額/年額サブスクリプション（Klasly Pro）
- スタジオ側の Stripe Webhook 処理（`invoice.paid` / `invoice.payment_failed` / `customer.subscription.*` ほか）
- メンバー側のクレジット購入・パス購入・サブスク
- 支払い履歴・領収書・未払いアラート
- **予約クレジット要否の自動判定**: `studios.booking_requires_credits = null` で Stripe Connect 完了状況により自動。`true`/`false` で手動オーバーライド

### Phase 3: 通知・エクスポート・ウェイトリスト
- Resend メールテンプレート（40 種以上、後述）
- CSV エクスポート（members / instructors / classes / bookings / payments ほか）
- CSV インポート（members / instructors / classes / pricing）— Map → Review → Done フロー、エラー行 CSV 再ダウンロード可
- ウェイトリスト自動繰り上げ
- スタジオ閉店日（`studio_closures`）— 一括キャンセル + 自動クレジット返金

### Phase 4: 出席・契約・Instructor ポータル
- ドロップイン出席記録 / 出席サマリー（ビュー）
- 電子 Waiver（成人 + 未成年保護者署名・公開トークンリンク・SafeMarkdown）
- Instructor ポータル（`/instructor` 配下）
  - Today / My Schedule / My Classes / Room Bookings / Membership / My Earnings / My Profile / Overage / Appointments
- Instructor 月次インボイス（PDF 生成）
- Membership Tiers（時間枠・超過課金）+ Tier Overage 月次請求 cron

### Phase 5: コミュニケーション
- アプリ内メッセージング（オーナー⇔メンバー、未読バッジ、メール通知）
- スタジオ Announcements（ニュースフィード・既読追跡）
- Community Board（投稿・コメント・通知）
- メールキャンペーン（受信箱送信・テンプレート・配信リスト）
- Web Push 通知（PWA・1 時間前リマインダー・予約通知・新着メッセージ）

### Phase 6: 拡張機能（Feature Flags）
スタジオごとに有効化（`studio_features` テーブル + `lib/features/` API）。

| カテゴリ | フラグ |
|---|---|
| Core（既定 ON） | Members / Classes / Bookings / Attendance / Payments / Waiver / Messaging / Instructor Portal / CSV Export・Import |
| Collective Mode（既定 OFF） | Instructor Direct Payout / Room Management / Instructor Self-Scheduling / Hour Tracking / Instructor Billing / Schedule Visibility / Manager Role |
| Extensions（既定 OFF） | Embed Widget / Analytics / Custom Forms / Minor Waiver / Retreat Booking / Studio Pass / Enhanced PWA / UTM Tracking / SOAP Notes / Online Classes / Appointments / Class Reviews / Achievements & Badges / Community Board / Favorites / Email Campaigns / Video Content / Member Levels |
| Payout Phase 3（既定 OFF） | Class Fee Override / Fee Schedules / Instructor Invite Link / Tax Report |

#### 主要拡張機能の概要
- **Rooms**: 部屋ごとカラムカレンダー、Room-Only 予約（インストラクター単独利用）、料金、キャンセル時メール通知
- **Studio Passes**: 月額サブスクパス（Monthly Unlimited / 10-pack / 5-pack / Drop-in）、回数券消費追跡、月初の自動配布 + 自動払い出し cron
- **Events / Retreats**: 多日程イベント、分割払い・分割払いリマインダー、ウェイトリスト、オプション物販
- **Appointments**: 1on1 予約タイプ（時間/価格/受付枠）、メンバー自己予約、インストラクター承認
- **Custom Forms**: フォームビルダー、回答収集、メンバー入会用カスタム項目
- **Online Library / Videos**: 月額 Basic/Premium 会員、動画 free/members/premium タグ、購入記録
- **Class Reviews**: メンバーによるクラス評価、平均レーティング表示
- **Achievements & Member Levels**: Bronze/Silver/Gold/Platinum/Diamond ランク、出席ストリーク、バッジ
- **SOAP Notes**: ボディワーカー向け施術記録（部位・所見・プラン）
- **Analytics**: UTM リンクビルダー、クリック追跡、保存レポート（売上/出席/インストラクター払い出し/会員成長/ドロップイン/部屋稼働）
- **Referral Program**: 紹介コード、紹介報酬の自動付与
- **Embed Widget**: WordPress 用 iframe（公開スケジュール / イベント登録）
- **Calendar Sync**: iCal フィード公開（Google Calendar 等の購読）
- **Closures**: スタジオ休業日 → 該当日のセッション一括キャンセル + クレジット/パス返金

### System Admin Dashboard (`/admin`)
- KPI（MRR / ARR / Churn / アラート）
- スタジオ一覧・詳細管理（トライアル延長・プラン変更・キャンセル・削除）
- 課金ステータス管理（Trialing / Past Due / Grace / Canceled）
- クーポン管理（Stripe Coupon / Promotion Code 連携）
- ビジネス指標、サポートチケット、ログビューア（Webhook / Cron / Email）
- テストアカウントなりすまし（`test_account_impersonation_logs` で監査）

---

## ルート一覧

### `(dashboard)/` — Owner / Manager
`dashboard` / `members` / `instructors`（earnings, import, rental, tax-report）/ `managers` / `classes` / `calendar`（import, print, `[id]/sessions/[sessionId]`）/ `bookings`（`[sessionId]`）/ `appointments`（types CRUD）/ `events`（`[id]/manage`, bookings, edit）/ `rooms`（manage, bookings, `[id]`）/ `passes`（distributions, new）/ `payments` / `analytics`（reports）/ `campaigns` / `reviews` / `studio-announcements` / `contracts/envelopes/[id]` / `my-classes` / `my-earnings` / `settings/*`

### `(dashboard)/settings/`
`billing` / `pricing` / `connect` (Stripe Connect) / `payout` / `collective-setup` / `tiers`（+ `tiers/overage`）/ `closures` / `notifications` / `waiver` / `contracts` / `forms` / `library` / `widget` / `integrations` / `referral` / `invoices` / `features` / `support`

### `(instructor)/` — Instructor
`instructor`（Today・My Schedule・My Classes・Room Bookings・Membership・My Earnings・My Profile・Overage・Appointments）

### `(member)/` — Member
`schedule` / `my-bookings` / `my-payments` / `my-passes` / `my-appointments` / `my-stats` / `purchase` / `videos` / `community` / `notification-settings` / `waiver` / `wrapped`

### `(admin)/` — System Admin
`admin`（KPI / studios / billing / coupons / metrics / support / logs）

### `(public)/`
`s/[slug]`（スタジオ公開ブッキングページ）/ `events/[slug]` / `privacy` / `terms` / `cookies`

### Root-level
`account` / `announcements` / `messages` / `instructor-join` / `forms` / `widget` / `waiver/sign/[token]` / `ref` / `onboarding` / `help` / `contracts/[envelopeId]` / `dev-login`（dev のみ）/ `offline`

---

## API ルート

`src/app/api/` 配下。主要グループ:

| グループ | 概要 |
|---|---|
| `account/*` | プロフィール・メール・パスワード変更 |
| `admin/*` | システム管理（service role） |
| `analytics/*` | リンククリック集計 |
| `announcements/*` | スタジオお知らせ |
| `appointments/*` | 1on1 予約 |
| `attendance/*` | 出席記録・ドロップイン |
| `auth/*` | OAuth コールバック |
| `bookings/*` | クラス予約・キャンセル（パス連動） |
| `calendar/*` / `ical/*` | iCal フィード |
| `campaigns/*` | メール一括送信 |
| `class-templates/*` | クラステンプレート CRUD・セッション再生成 |
| `community/*` | 掲示板 |
| `contracts/*` | 契約エンベロープ・署名 Webhook |
| `cron/*` | Vercel Cron 入口（後述） |
| `dashboard/*` | KPI 集計 |
| `events/*` | イベント・分割払い・ウェイトリスト |
| `export/*` | CSV エクスポート |
| `favorites/*` | お気に入り |
| `forms/*` | カスタムフォーム |
| `import/*` | CSV インポート |
| `instructor/*` | Instructor ポータル各種 |
| `instructor-earnings/*` / `instructor-overage/*` / `instructor-membership-tiers/*` / `instructor-memberships/*` / `instructors/*` | 収益・超過・契約 |
| `instructor-join/*` | 自己招待 |
| `integrations/*` | Google / Mailchimp / Zoom 連携 |
| `invoices/*` | インストラクター月次インボイス |
| `library/*` / `videos/*` | 動画ライブラリ |
| `managers/*` | マネージャ CRUD |
| `members/*` | 会員 CRUD・レベル |
| `messages/*` | アプリ内メッセージ |
| `notifications/*` / `push/*` | Web Push |
| `og/*` | OG 画像 |
| `onboarding/*` | セットアップウィザード |
| `passes/*` | スタジオパス |
| `products/*` | Stripe Product / Price 同期 |
| `public/*` | 公開スケジュール |
| `referral/*` | 紹介プログラム |
| `reports/*` | 保存レポート |
| `reviews/*` | クラスレビュー |
| `rooms/*` | 部屋予約 |
| `sessions/*` | セッション CRUD・差し替え |
| `soap-notes/*` | SOAP 記録 |
| `stripe/*` | Webhook・Payment Intent・Connect |
| `studio/*` | スタジオ設定・ブランド・タイムゾーン・通貨 |
| `support/*` | サポートチケット |
| `waiver/*` | Waiver テンプレ・署名 |
| `widget/*` | 埋め込みウィジェット |

---

## データベース（主要テーブル）

### コア
`studios` / `profiles` / `members` / `instructors` / `managers` / `class_templates` / `class_sessions` / `bookings` / `payments` / `rooms` / `instructor_room_bookings`

### 拡張
- 出席: `drop_in_attendances`, `session_attendance_summary`(view), `member_achievements`, `recurring_bookings`
- メッセージ: `messages`, `community_posts`, `community_comments`, `announcements`, `announcement_reads`
- パス: `studio_passes`, `pass_subscriptions`, `pass_class_usage`, `pass_distributions`
- イベント: `events`, `event_bookings`, `event_options`, `event_payment_schedule`, `event_schedule_items`
- アポイント: `appointment_types`, `appointments`, `instructor_availability`
- Waiver / 契約: `waiver_templates`, `waiver_signatures`, `custom_forms`, `custom_form_submissions`
- 動画: `video_content`, `video_purchases`, `library_memberships`
- インストラクター契約: `instructor_membership_tiers`, `instructor_memberships`, `instructor_overage_charges`, `instructor_earnings`, `instructor_invoices`, `instructor_fee_overrides`, `class_fee_overrides`, `fee_schedules`, `instructor_invite_tokens`
- 通知 / Push: `notification_preferences`, `push_subscriptions`, `push_logs`
- お気に入り / レビュー: `member_favorites`, `class_reviews`
- 分析: `link_clicks`, `saved_reports`
- フォーム / Widget: `widget_settings`, `integration_connections`
- リフェラル: `referral_codes`, `referral_rewards`
- フィーチャーフラグ: `studio_features`
- 閉店日: `studio_closures`
- SOAP: `soap_notes`
- メールキャンペーン: `email_campaigns`
- Admin / クーポン: `admin_notes`, `support_tickets`, `support_ticket_comments`, `coupons`, `promotion_codes`, `coupon_redemptions`, `test_account_impersonation_logs`
- ログ: `webhook_logs`, `cron_logs`, `email_logs`

> マイグレーションは `supabase/migrations/`。**新規ファイルは `YYYYMMDDHHMMSS_<snake_case_name>.sql` 形式**（CLAUDE.md 参照）。

---

## Cron ジョブ（`vercel.json`）

| Cron | 頻度 (UTC) | 処理 |
|---|---|---|
| `/api/cron/trial-reminder` | 09:00 daily | トライアル残 3 日のスタジオに通知 |
| `/api/cron/past-due-check` | 10:00 daily | past_due → 7 日超で grace 移行 |
| `/api/cron/grace-check` | 11:00 daily | grace → 7 日超で canceled |
| `/api/cron/generate-sessions` | 00:00 daily | 4 週間先までセッション延伸 |
| `/api/cron/event-installments` | 08:00 daily | イベント分割払いの自動課金 |
| `/api/cron/event-installment-reminder` | 09:00 daily | 分割払いリマインダー送信 |
| `/api/cron/pass-distribution` | 月初 00:00 | スタジオパスの月次配布 |
| `/api/cron/pass-payout` | 月初 02:00 | パス売上のインストラクター按分 |
| `/api/cron/tier-overage-billing` | 月初 01:00 | Tier 超過分の月次請求 |
| `/api/cron/class-reminder` | 15 分ごと | 1 時間前リマインダー Push/Email |
| `/api/cron/streak-decay` | 毎週月 00:05 | 出席ストリーク減衰計算 |
| `/api/cron/comeback-nudge` | 17:00 daily | 休眠メンバーへの再エンゲージ通知 |

---

## メールテンプレート（40 種以上、`src/lib/email/templates.ts`）

予約系 / イベント系 / パス系 / 契約系 / 支払い系 / 通知系で構成。

- **予約**: bookingConfirmation, bookingCancelled, waitlistPromoted, sessionRescheduled, sessionCancelledNotice, sessionInstructorChanged, ownerNewBookingNotification
- **アポイント**: appointmentConfirmation, appointmentCancelled
- **イベント**: eventBookingConfirmation, eventBookingConfirmedFull, eventBookingConfirmedInstallment, eventBookingCancelled, eventWaitlistConfirmation, eventWaitlistPromoted, eventPaymentCompleted, installmentReminder, installmentPaymentFailed, ownerInstallmentFailedNotification
- **パス**: passDistributionPaid, passDistributionFailed, passDistributionReview
- **Stripe**: paymentReceipt, paymentFailed
- **Tier 超過**: tierOverageWarning, tierOverageCharged, tierOverageChargeFailed
- **インストラクター**: instructorInvite, instructorBookingStaffNotice, instructorRoomBooking, instructorRoomBookingConfirmation, instructorRoomBookingCancelledByOwner, instructorPaymentNotification
- **会員**: welcomeMember, passwordReset, messageNotification
- **Waiver**: waiverInvite, guardianWaiverInvite
- **契約**: contractSignRequest, contractSignComplete
- **リフェラル**: referralSignup, referralRewardReferrer, referralRewardReferred
- **管理**: newStudioSignupAdmin

---

## 環境変数

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECT_WEBHOOK_SECRET=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_PRO_YEARLY_PRICE_ID=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Resend
RESEND_API_KEY=

# Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=

# App
NEXT_PUBLIC_APP_URL=https://app.klasly.app
NEXT_PUBLIC_LANDING_URL=https://klasly.app

# Admin
ADMIN_EMAILS=your-email@example.com

# Dev login（dev のみ）
DEV_LOGIN_EMAIL=
DEV_LOGIN_PASSWORD=
```

---

## セットアップ

```bash
npm install
npm run dev
```
http://localhost:3000 で起動。

### dev-login
`NODE_ENV=development` のとき `/dev-login` から `DEV_LOGIN_EMAIL` / `DEV_LOGIN_PASSWORD` でワンクリックサインイン可能。本番では 404。

### マイグレーション適用
- 新規: `YYYYMMDDHHMMSS_<name>.sql` を `supabase/migrations/` に追加
- 適用: `mcp__supabase__apply_migration` または `supabase db push`
- 確認: `mcp__supabase__list_migrations` でリモート履歴を確認

### Stripe 設定
1. Product「Klasly Pro」を作成、$19/month と $190/year の Price を作る
2. 2 種の Webhook Endpoint を設定（プラットフォーム / Connect）
3. `lib/stripe/connect-countries.ts` の対応国を確認

### Resend
- `klasly.app` ドメインを検証
- `notifications@klasly.app` を送信元に設定

---

## 予約クレジット判定

```
studios.booking_requires_credits
 ├── null（Auto・既定）
 │ stripe_connect_onboarding_complete = true → 必須
 │ stripe_connect_onboarding_complete = false → 不要（現金スタジオ）
 ├── true → 常に必須
 └── false → 常に不要（手動出席管理）
```

ヘルパー: `src/lib/booking-utils.ts#getRequiresCredits()`
設定箇所: Settings → **Booking Credit Requirement**

---

## Customer-Driven Features

Klasly の差別化機能の多くは、軸足顧客 **The Elizabeth Mind and Movement Collective** (Sarah Haroldsen / Jamie Bischoff) の運用フィードバック (2026-03〜05) を直接の起源として実装したもの。詳細マッピングはメモリ `project_elizabeth_email_features.md` 参照。

| 機能 | 起源メール | 実装ポイント |
|---|---|---|
| **Collective Mode + Stripe Connect direct payouts** | Sarah 2026-03-12 | Settings → Connect / Collective setup, `instructors.stripe_connect_*` |
| **Instructor Contracts (Hourly / Flat / Overage)** | Jamie 2026-04-15 | Settings → Contracts (3タブ), `tier-overage-billing` cron |
| **Test Accounts Switcher** (impersonation w/ audit log) | Jamie 2026-04-15 | 右下人型アイコン、`test_account_impersonation_logs` |
| **Class duplicate / Never-end recurrence / Rich-text description** | Jamie 2026-04-15 | Classes ページ Duplicate ボタン |
| **Calendar 色凡例 (Open/Full/Private/Room/Cancelled) + Capacity badge** | Jamie 2026-04-21 + 2026-04-28 | calendar 凡例 + タイル "5/10" "FULL" |
| **iCal calendar feed (per-user, per-role)** | Jamie 2026-04-28 | Settings → Calendar feed, `/api/ical/[token]` |
| **Substitute instructor + auto-notify confirmed bookings** | Jamie 2026-04-28 | Edit Session dialog、`sessionInstructorChanged` |
| **Edit scope: this only / this+future / all in series** + member-notify opt-out | Jamie 2026-04-28 | Bulk-affected count をライブ表示 |
| **Studio Closures (一括 cancel + クレジット返還)** | Jamie 2026-04-28 | Settings → Studio Closures |
| **Print weekly schedule** | Jamie 2026-04-28 | `/calendar/print` |
| **Class Change History (200件 audit trail)** | Jamie 2026-04-30 | クラステンプレート詳細の折りたたみ |
| **Cancellation policy: hours-returned vs forfeited toggle** | Jamie 2026-04-30 | cancelled タイル上で admin が切替、attribution badge |
| **Multi-signature ordered contracts (Jotform-like)** | Jamie 2026-04-30 | Settings → Forms → Send for signing、外部 signer はログイン不要 |
| **Bulk edit / Bulk cancel on Upcoming Sessions** | Jamie 2026-04-30 | Select multiple → time/instructor 一括 |
| **Member form 再構成 (Phone/DoB/Gender required)** | Jamie 2026-04-30 | `members/new/new-member-form.tsx` |
| **Welcome email toggle on CSV import** (運用ガイダンス) | Jamie 2026-05-01 | デフォルト OFF、launch 時にバッチ送信 |
| **Room booking + Client link + Pass auto-deduction** | Sarah 2026-05-01 | `admin-room-booking-modal`、cancel で自動返還、no-show は保留 |
| **Room dropdown filter on schedule + click-to-add drop-in / no-show / late-cancel** | Sarah 2026-05-01 | Schedule ヘッダー + session attendance ページ |
| **Room booking 1h reminder** | Sarah 2026-05-01 | `class-reminder` cron に統合 |
| **Stripe Connect 国別オンボーディング + Disconnect & start over** | Sarah 2026-04-22 | postal/phone format を国に合わせて切替 |

## CLAUDE.md ルール（運用上の重要事項）

- **ユーザー向け機能の追加・変更・削除時は `src/components/help/help-data.tsx` を必ず更新**
- マイグレーションは `YYYYMMDDHHMMSS_<snake_case>.sql` 形式（旧連番形式は新規追加禁止）
- プレビュー検証は `/dev-login` から開始（`.env.local` に `DEV_LOGIN_EMAIL` / `DEV_LOGIN_PASSWORD` を設定）
