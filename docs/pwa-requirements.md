# PWA（Progressive Web App）要件定義書

## 1. 概要

Klasly をPWA対応し、モバイルユーザー（インストラクター・メンバー）がネイティブアプリに近い体験でアクセスできるようにする。

---

## 2. 現状分析

| 項目 | 現状 |
|------|------|
| manifest.json | ❌ なし |
| Service Worker | ❌ なし |
| アイコン | ⚠️ SVG favicon 1つのみ（32x32） |
| PWAメタタグ | ❌ なし（theme-color, apple-touch-icon 等） |
| オフライン対応 | ❌ なし |
| インストールプロンプト | ❌ なし |
| プッシュ通知 | ❌ なし |
| 機能フラグ | ❌ なし（DevRoleSwitcher のみ） |

---

## 3. ターゲットユーザーとユースケース

### 3.1 インストラクター（最優先）
- **デバイス**: スマホ中心
- **ユースケース**:
  - 当日のクラススケジュール確認
  - 出席管理（チェックイン）
  - 自分の収益確認
  - Stripe接続状態の確認
- **PWAの価値**: ホーム画面から即アクセス、プッシュ通知で新しい予約通知

### 3.2 メンバー（高優先）
- **デバイス**: スマホ中心
- **ユースケース**:
  - クラス検索・予約
  - 予約済みスケジュール確認
  - クレジット残高確認
  - チェックイン
- **PWAの価値**: ブックマーク不要、通知でリマインダー

### 3.3 スタジオオーナー（中優先）
- **デバイス**: PC中心、たまにスマホ
- **ユースケース**:
  - ダッシュボード確認
  - インストラクター管理
  - 支払い設定
- **PWAの価値**: PC上でもPWAインストールでブラウザのUIなしにアクセス

---

## 4. 機能要件

### 4.1 基本PWA対応（Phase PWA-1）

#### 4.1.1 Web App Manifest
```json
{
  "name": "Klasly - Studio Management",
  "short_name": "Klasly",
  "description": "Simple management tool for yoga, fitness, and dance studios",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0074c5",
  "orientation": "portrait-primary",
  "scope": "/",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "My Schedule", "url": "/instructor", "icon": "/icons/schedule.png" },
    { "name": "Book a Class", "url": "/classes", "icon": "/icons/book.png" }
  ]
}
```

#### 4.1.2 メタタグ追加（root layout.tsx）
- `<meta name="theme-color" content="#0074c5">`
- `<link rel="apple-touch-icon" href="/icons/icon-192.png">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="default">`
- `<link rel="manifest" href="/manifest.json">`

#### 4.1.3 アイコンアセット生成
- 既存の `icon.svg`（青地に白K）から以下を生成:
  - `/public/icons/icon-192.png`（192x192）
  - `/public/icons/icon-512.png`（512x512）
  - `/public/icons/icon-maskable-192.png`（192x192、safe zone考慮）
  - `/public/icons/icon-maskable-512.png`（512x512、safe zone考慮）
  - `/public/icons/apple-touch-icon.png`（180x180）

### 4.2 Service Worker（Phase PWA-1）

#### 4.2.1 キャッシュ戦略
| リソース種別 | 戦略 | 理由 |
|-------------|------|------|
| 静的アセット（JS/CSS/fonts） | Cache First | 変更頻度低、即時表示 |
| API レスポンス | Network First | 常に最新データ優先 |
| 画像 | Stale While Revalidate | UX優先、バックグラウンド更新 |
| HTML (Navigation) | Network First + Offline Fallback | オフライン時はフォールバックページ表示 |

#### 4.2.2 オフラインフォールバック
- `/offline` ページを作成
- ネットワーク不通時にフォールバックページを表示
- 「接続が回復したら自動リロード」機能付き

### 4.3 インストールプロンプト（Phase PWA-2）

#### 4.3.1 カスタムインストールバナー
- `beforeinstallprompt` イベントをキャプチャ
- 初回訪問から3回目以降にバナー表示
- 「ホーム画面に追加」ボタン
- 「後で」ボタンで7日間非表示
- localStorage で表示制御

#### 4.3.2 iOS Safari対応
- iOS は `beforeinstallprompt` 非対応のため独自UI
- 「共有 → ホーム画面に追加」の手順をモーダルで案内
- `navigator.standalone` でインストール済み判定

### 4.4 プッシュ通知（Phase PWA-3 — 将来）

#### 4.4.1 通知シナリオ
| 対象 | 通知内容 | トリガー |
|------|---------|---------|
| インストラクター | 新しい予約が入った | 予約作成時 |
| インストラクター | クラス開始30分前リマインダー | スケジュールジョブ |
| メンバー | クラス開始1時間前リマインダー | スケジュールジョブ |
| メンバー | クラスがキャンセルされた | クラスキャンセル時 |
| オーナー | 月次レポート準備完了 | 月初バッチ |

#### 4.4.2 技術要件
- Web Push API + VAPID キー
- Supabase Edge Functions or Vercel Cron でスケジュール送信
- `push_subscriptions` テーブルで購読管理
- ユーザー単位の通知設定（オプトイン/オプトアウト）

---

## 5. 非機能要件

### 5.1 パフォーマンス
- Lighthouse PWA スコア: 90以上
- First Contentful Paint: < 2秒
- Service Worker 登録: ページロード後に遅延実行（メインスレッドブロックしない）

### 5.2 互換性
| ブラウザ | PWA機能 | 対応 |
|---------|---------|------|
| Chrome (Android) | フル対応 | ✅ 必須 |
| Safari (iOS 16.4+) | Push API対応 | ✅ 必須 |
| Safari (iOS < 16.4) | インストールのみ | ✅ 必須 |
| Chrome (Desktop) | フル対応 | ⚠️ あると良い |
| Firefox | 限定的PWA | ⚠️ あると良い |

### 5.3 セキュリティ
- Service Worker は HTTPS 必須（本番環境は既にHTTPS）
- プッシュ通知のVAPIDキーはサーバーサイドで管理
- キャッシュには認証トークンを含めない

---

## 6. 機能フラグ設計

```env
# PWA 全体の有効/無効
NEXT_PUBLIC_FF_PWA_ENABLED=true

# 個別機能
NEXT_PUBLIC_FF_PWA_INSTALL_PROMPT=true
NEXT_PUBLIC_FF_PWA_OFFLINE=true
NEXT_PUBLIC_FF_PWA_PUSH_NOTIFICATIONS=false
```

機能フラグはサーバーサイド（`src/lib/feature-flags.ts`）で一元管理し、クライアントコンポーネントでも参照可能にする。

---

## 7. 実装フェーズ

| Phase | 内容 | 優先度 | 見積もり |
|-------|------|--------|---------|
| PWA-1 | Manifest + Icons + Service Worker + Offline | 高 | — |
| PWA-2 | Install Prompt（iOS/Android対応） | 高 | — |
| PWA-3 | Push Notifications | 中 | — |

---

## 8. 成功基準

- [ ] Lighthouse PWA 監査: 全項目合格
- [ ] Android Chrome: ホーム画面追加 → スタンドアロンモードで起動
- [ ] iOS Safari: ホーム画面追加 → フルスクリーンで起動
- [ ] オフライン時: フォールバックページが表示される
- [ ] Service Worker: 静的アセットがキャッシュされ、2回目以降の読み込みが高速化
- [ ] 機能フラグ OFF: PWA関連機能が完全に無効化される
