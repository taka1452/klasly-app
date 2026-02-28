# Klasly - Studio Management App

**Built for small studios. Not enterprise gyms.**

小規模ヨガ・フィットネス・ダンススタジオ向け（会員30〜50名）のオールインワン管理ツール。

## Tech Stack

| 項目 | 技術 |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend / DB / Auth | Supabase (PostgreSQL + Auth + RLS) |
| Hosting | Vercel |
| Payment | Stripe |
| Email | Resend (notifications@klasly.app) |
| Domain | klasly.app (Porkbun) |

## URL構成

| URL | 用途 |
|---|---|
| klasly.app | LP（静的HTML） |
| app.klasly.app | Webアプリ（Next.js） |

## 料金プラン

- **Pro $19/月** または **$190/年**（約17%割引）
- 30日間無料トライアル（カード登録必須）
- 無料プランなし

## 機能一覧

### Phase 1: MVP ✅
- 認証（サインアップ・ログイン・ログアウト・パスワードリセット）
- オンボーディング（スタジオ作成）
- 会員管理（CRUD・ステータス・プラン・残回数）
- インストラクター管理
- クラス管理（登録・編集・削除）
- セッション自動生成（4週間分）
- 予約機能（予約・キャンセル・定員管理・キャンセル待ち）
- ダッシュボード（今日のクラス・会員数・売上・未払いアラート）
- ロール別アクセス制御（Owner / Instructor / Member）

### Phase 2: Stripe決済連携 ✅
- Stripeサンドボックス接続
- Webhook処理
- サブスクリプション管理
- 支払い履歴・未払いアラート

### Phase 3: メール・CSV・ウェイトリスト ✅
- Resendメール送信（7テンプレート）
- CSVエクスポート（会員・予約・支払い）
- キャンセル待ち自動繰り上げ

### Phase 4: 拡張機能 ✅
- Waiver（電子同意書・署名管理）
- 出席管理（Attendance・ドロップイン対応・回数券手動消費）
- Instructorポータル（スケジュール・予約者一覧・プロフィール編集）

### System Admin Dashboard ✅
- KPIダッシュボード（MRR・ARR・Churn Rate・アラート）
- スタジオ一覧・詳細管理（トライアル延長・プラン変更・キャンセル・削除）
- 課金ステータス管理（Trialing / Past Due / Grace / Canceled）
- クーポン管理（Stripe連携・プロモーションコード発行・利用追跡）
- ビジネス指標（成長グラフ・コンバージョン・Churn予兆）
- サポートチケット管理
- ログビューア（Webhook・Cron・メール）

## ユーザーロール

| ロール | 説明 | デフォルトページ |
|---|---|---|
| Admin | Klaslyシステム管理者（ADMIN_EMAILS環境変数で制御） | /admin |
| Owner | スタジオオーナー。全機能にアクセス可能 | / |
| Instructor | 自分のクラス・予約者一覧のみ（閲覧中心） | /instructor |
| Member | 自分の予約・残回数・支払い履歴のみ | /schedule |

## フォルダ構成

```
src/
├── app/
│   ├── (admin)/         ← System Admin管理画面
│   │   ├── page.tsx         ダッシュボード（KPI）
│   │   ├── studios/         スタジオ一覧・詳細
│   │   ├── billing/         課金ステータス管理
│   │   ├── coupons/         クーポン管理
│   │   ├── metrics/         ビジネス指標
│   │   ├── support/         サポートチケット
│   │   ├── logs/            ログビューア
│   │   └── layout.tsx       Adminレイアウト（ダークテーマ）
│   ├── (auth)/              ← 認証系
│   │   ├── login/
│   │   ├── signup/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   └── auth/callback/
│   ├── (dashboard)/         ← Owner用
│   │   ├── page.tsx         ダッシュボード
│   │   ├── members/         会員管理
│   │   ├── classes/         クラス管理
│   │   │   └── [classId]/sessions/[sessionId]/  出席管理
│   │   ├── bookings/        予約管理
│   │   ├── settings/        設定
│   │   │   └── waiver/      Waiver設定
│   │   ├── billing/         料金管理
│   │   └── layout.tsx
│   ├── (instructor)/        ← Instructor用
│   │   ├── page.tsx         Instructorダッシュボード
│   │   ├── schedule/        スケジュール
│   │   ├── sessions/[sessionId]/  セッション詳細（閲覧のみ）
│   │   ├── profile/         プロフィール編集
│   │   └── layout.tsx
│   ├── (member)/            ← 会員用
│   │   ├── schedule/        スケジュール・予約
│   │   ├── my-bookings/     予約履歴
│   │   └── layout.tsx
│   ├── waiver/sign/[token]/ ← Waiver署名（公開ページ）
│   ├── privacy/             ← Privacy Policy
│   ├── terms/               ← Terms of Service
│   └── api/
│       ├── admin/           Admin系API（service role key使用）
│       │   ├── studios/
│       │   ├── coupons/
│       │   ├── support/
│       │   └── logs/
│       ├── stripe/webhook/
│       ├── attendance/
│       ├── bookings/
│       ├── waiver/
│       ├── coupons/         ユーザー向けクーポンAPI
│       ├── cron/            Cronジョブ
│       │   ├── trial-reminder/
│       │   ├── past-due-check/
│       │   └── grace-check/
│       └── export/          CSVエクスポート
├── components/
├── lib/
│   ├── admin/
│   │   ├── auth.ts          Admin認証（ADMIN_EMAILS判定）
│   │   └── supabase.ts      Admin用Supabaseクライアント（service role）
│   ├── supabase/
│   │   ├── client.ts        ブラウザ用
│   │   └── server.ts        サーバー用
│   ├── stripe/
│   │   └── config.ts        Stripe設定
│   └── email/
│       ├── client.ts
│       ├── templates.ts
│       └── send.ts
└── types/
    └── database.ts
```

## データベース（テーブル一覧）

### コア
| テーブル | 説明 |
|---|---|
| studios | スタジオ情報・課金状態 |
| profiles | ユーザープロフィール（auth.usersと1:1） |
| members | 会員詳細（プラン・回数券・ステータス） |
| instructors | インストラクター詳細 |
| classes | クラス定義（曜日・時間・定員） |
| class_sessions | クラスの各回（日付ごと） |
| bookings | 予約 |
| payments | 支払い履歴 |

### 出席管理
| テーブル | 説明 |
|---|---|
| drop_in_attendances | ドロップイン出席記録 |
| session_attendance_summary | 出席サマリー（ビュー） |

### Waiver
| テーブル | 説明 |
|---|---|
| waiver_templates | 同意書テンプレート（スタジオに1つ） |
| waiver_signatures | 署名記録 |

### クーポン
| テーブル | 説明 |
|---|---|
| coupons | 割引ルール（Stripe Coupon連携） |
| promotion_codes | プロモーションコード（Stripe Promotion Code連携） |
| coupon_redemptions | 利用履歴 |

### Admin管理
| テーブル | 説明 |
|---|---|
| admin_notes | スタジオ管理メモ |
| support_tickets | サポートチケット |
| support_ticket_comments | チケットコメント |

### ログ
| テーブル | 説明 |
|---|---|
| webhook_logs | Stripe Webhookログ |
| cron_logs | Cronジョブ実行ログ |
| email_logs | メール送信ログ |

## 環境変数

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_PRO_YEARLY_PRICE_ID=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Resend
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://app.klasly.app

# Admin
ADMIN_EMAILS=your-email@example.com
```

## セットアップ手順

### 1. Supabase プロジェクト作成
1. https://supabase.com/dashboard で新規プロジェクト作成
2. SQLエディタでマイグレーションSQLを実行
3. Settings → API から URL, anon key, service role key をメモ

### 2. Stripe設定
1. Stripe Dashboardで Product「Klasly Pro」を作成
2. Price を2つ作成: $19/month, $190/year
3. Webhook Endpointを設定

### 3. Resend設定
1. klasly.app ドメインを検証
2. APIキーを取得

### 4. 環境変数の設定
`.env.local` ファイルに環境変数を設定

### 5. 開発サーバー起動
```bash
npm install
npm run dev
```
http://localhost:3000 で確認。

### 6. Vercel デプロイ
GitHub にプッシュ後、Vercel で Import。
環境変数を Vercel Settings → Environment Variables で設定。

## Cron Jobs（vercel.json）

| Cron | 頻度 | 処理 |
|---|---|---|
| /api/cron/trial-reminder | 毎日 9AM UTC | トライアル残り3日のスタジオにメール |
| /api/cron/past-due-check | 6時間ごと | past_due → 7日超過でgrace移行 |
| /api/cron/grace-check | 毎日 0AM UTC | grace → 7日超過でcanceled移行 |

## メールテンプレート

| テンプレート | トリガー |
|---|---|
| bookingConfirmation | 予約確定時 |
| bookingCancelled | 予約キャンセル時 |
| waitlistPromoted | キャンセル待ち繰り上げ時 |
| paymentReceipt | Stripe invoice.paid |
| paymentFailed | Stripe invoice.payment_failed |
| welcomeMember | 会員作成時 |
| waiverInvite | Waiver署名依頼 |
| instructorInvite | Instructor招待 |
