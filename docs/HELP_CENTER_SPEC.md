# Klasly ヘルプセンター 仕様書

> この仕様書はヘルプセンターの設計・実装指針です。新機能や仕様変更があった場合は、必ずここを確認し更新してください。

## 概要

ヘルプセンターは3層構造で構成されています：

1. **トップページ** (`/help`) — 検索バー + Quick Actions + カテゴリカード一覧
2. **カテゴリページ** (`/help/[category]`) — カテゴリ内の記事一覧
3. **記事ページ** (`/help/[category]/[article]`) — 個別のヘルプ記事（ステップ形式）

## ファイル構成

| ファイル | 説明 |
|---------|------|
| `src/types/help.ts` | ヘルプ記事・カテゴリの型定義 |
| `src/data/help-categories.ts` | カテゴリ定義（ID、タイトル、アイコン、対象ロール） |
| `src/data/help-articles.ts` | 全ヘルプ記事データ（ハードコード） |
| `src/app/help/page.tsx` | ヘルプトップページ |
| `src/app/help/layout.tsx` | ヘルプレイアウト |
| `src/app/help/[category]/page.tsx` | カテゴリページ |
| `src/app/help/[category]/[article]/page.tsx` | 記事ページ |
| `src/components/help/help-search.tsx` | 検索コンポーネント |
| `src/components/help/context-help-link.tsx` | コンテキストヘルプ（?アイコン） |

## データ構造

### HelpArticle

```typescript
type HelpArticle = {
 id: string; // URL用スラッグ
 title: string; // 記事タイトル
 summary: string; // 1〜2文の概要
 category: HelpCategory; // 所属カテゴリ
 audience: HelpAudience[]; // 対象ロール（複数可）
 keywords: string[]; // 検索用キーワード
 prerequisites?: string[]; // 前提条件
 steps: HelpStep[]; // 手順
 tips?: string[]; // ヒント
 relatedArticles?: string[]; // 関連記事のID
 featureFlag?: string; // Feature Flag依存キー
};
```

### カテゴリ一覧

| ID | タイトル | 対象 | 順序 |
|----|---------|------|------|
| `getting-started` | Getting Started | owner | 1 |
| `classes-scheduling` | Classes & Scheduling | owner, manager, instructor | 2 |
| `members` | Members | owner, manager | 3 |
| `payments` | Payments | owner, manager | 4 |
| `waivers` | Waivers | owner, manager | 5 |
| `messaging` | Messaging | owner, manager, member | 6 |
| `collective-mode` | Collective Mode | owner, manager, instructor | 7 |
| `events-retreats` | Events & Retreats | owner, manager | 8 |
| `analytics` | Analytics & Marketing | owner | 9 |
| `settings` | Settings & Features | owner | 10 |
| `member-guide` | Member Guide | member | 11 |

## コンテキストヘルプ（?アイコン）配置

| 画面 | リンク先 |
|------|---------|
| Classes | `/help/classes-scheduling/create-recurring-class` |
| Schedule | `/help/classes-scheduling/edit-cancel-session` |
| Members | `/help/members/add-member` |
| Payments | `/help/payments/view-payment-history` |
| Waivers | `/help/waivers/setup-waiver-template` |
| Messages | `/help/messaging/send-message-member` |
| Instructors | `/help/collective-mode/invite-instructor` |
| Events | `/help/events-retreats/create-retreat` |
| Analytics | `/help/analytics/view-analytics` |
| Settings | `/help/settings/manage-feature-flags` |
| SOAP Notes | `/help/classes-scheduling/soap-notes` |

## 記事の追加方法

1. `src/data/help-articles.ts` に新しい記事オブジェクトを追加
2. 適切な `category` を設定（新カテゴリが必要なら `src/data/help-categories.ts` にも追加）
3. `keywords` に検索用キーワードを設定
4. `relatedArticles` に関連記事のIDを設定
5. Feature Flag依存の場合は `featureFlag` を設定

## 今後の拡張予定

- [ ] Feature Flagによるヘルプ記事フィルタ（有効でない機能の記事を非表示）
- [ ] スクリーンショットの追加（HelpStepにimageUrlフィールド追加）
- [ ] ヘルプ記事のSupabase移行（100記事超でCMS化検討）
- [ ] フィードバック機能（記事下部に「Was this helpful? 」追加）
- [ ] AI検索（Supabase pgvector活用）

## 注意事項

- DB変更なし。すべてフロントエンドのみの変更
- ヘルプ記事はハードコード（JSONデータ）
- 検索はクライアントサイド（タイトル + キーワード + サマリーをマッチ）
- ブランドカラー: `#0074D4`
- 全記事データは100記事以下を想定（パフォーマンス問題なし）
