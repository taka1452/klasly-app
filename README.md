# Klasly - Studio Management App

小規模ヨガ・フィットネス・ダンススタジオ向けのシンプルな管理ツール。

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Hosting**: Vercel

## セットアップ手順

### 1. Supabase プロジェクト作成

1. https://supabase.com/dashboard で新規プロジェクト作成
2. `supabase_setup.sql` の内容を SQL Editor で実行
3. Settings → API から URL と anon key をメモ

### 2. 環境変数の設定

`.env.local` ファイルを編集:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. 開発サーバー起動

```bash
npm install
npm run dev
```

http://localhost:3000 で確認。

### 4. Vercel デプロイ

```bash
# GitHub にプッシュ後、Vercel で Import
# 環境変数を Vercel の設定画面で追加
```

## フォルダ構成

```
src/
├── app/
│   ├── (auth)/        認証系ページ
│   ├── (dashboard)/   オーナー・インストラクター用
│   ├── (member)/      会員用
│   ├── layout.tsx     ルートレイアウト
│   └── page.tsx       リダイレクト処理
├── components/        共通コンポーネント
├── lib/
│   ├── supabase/      Supabase クライアント
│   └── utils.ts       ユーティリティ関数
└── types/             型定義
```
