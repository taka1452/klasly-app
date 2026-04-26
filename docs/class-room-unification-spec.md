# Klasly — クラス＋部屋予約 統合リファクタリング 要件定義書

## 概要

現在のクラス管理と部屋予約が完全に分離している構造を統合し、
「クラステンプレート + 統合セッション」方式に移行する。

## 現状の問題点

| # | 問題 | 影響 |
|---|------|------|
| 1 | クラスと部屋予約が別テーブル・別フロー | 同じ時間に2つの予約が存在する |
| 2 | クラスは曜日ベース（recurring only だった→one_time追加済み） | 柔軟性が低い |
| 3 | 部屋予約は日付ベース（single/recurring） | クラスとの紐づけが弱い |
| 4 | インストラクターが空き状況を見れない（改善済みだが構造的に別） | UX が悪い |
| 5 | オーナーのカレンダーで同じ枠に2つのイベントが並ぶ | 混乱する |

---

## 新しいデータモデル

### 1. class_templates テーブル（新規）

クラスの「型」。日時を持たない再利用可能なテンプレート。

```sql
CREATE TABLE IF NOT EXISTS class_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
 instructor_id uuid REFERENCES instructors(id) ON DELETE SET NULL,
 name text NOT NULL,
 description text,
 duration_minutes integer NOT NULL DEFAULT 60,
 capacity integer NOT NULL DEFAULT 15,
 price_cents integer, -- Collective Mode: per-class price
 location text, -- 外部会場名（部屋を使わない場合）
 class_type text NOT NULL DEFAULT 'in_person', -- 'in_person' | 'online' | 'hybrid'
 online_link text, -- オンラインクラスのデフォルトリンク
 is_active boolean NOT NULL DEFAULT true,
 is_public boolean NOT NULL DEFAULT true,
 created_at timestamptz DEFAULT now(),

 CONSTRAINT valid_class_type CHECK (class_type IN ('in_person', 'online', 'hybrid'))
);
```

**旧classesテーブルからの変更点:**
- `day_of_week` → 削除（テンプレートは日時を持たない）
- `start_time` → 削除（セッションで指定）
- `schedule_type` → 削除
- `one_time_date` → 削除
- `room_id` → 削除（セッションで指定）
- `is_online` → `class_type` に統合
- 新規追加: `class_type` (in_person/online/hybrid)

### 2. sessions テーブル（大幅変更）

クラスセッションと部屋予約を統合した「実際の予約」テーブル。

```sql
-- 既存の class_sessions テーブルを拡張・改名
ALTER TABLE class_sessions RENAME TO sessions;

-- 新しいカラム追加
ALTER TABLE sessions
 ADD COLUMN template_id uuid REFERENCES class_templates(id) ON DELETE SET NULL,
 ADD COLUMN room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
 ADD COLUMN instructor_id uuid REFERENCES instructors(id) ON DELETE SET NULL,
 ADD COLUMN end_time time,
 ADD COLUMN duration_minutes integer,
 ADD COLUMN title text, -- template_id=NULL時の表示名
 ADD COLUMN session_type text NOT NULL DEFAULT 'class',
 ADD COLUMN price_cents integer, -- セッション単位の価格override
 ADD COLUMN location text,
 ADD COLUMN recurrence_group_id uuid, -- 繰り返しグループ
 ADD COLUMN recurrence_rule text, -- 'weekly' | null
 -- class_id は移行期間中残す（後で削除）
 ;

ALTER TABLE sessions
 ADD CONSTRAINT valid_session_type
 CHECK (session_type IN ('class', 'room_only'));
```

**session_type の意味:**
- `class` — テンプレート紐づけあり。メンバーが予約可能
- `room_only` — 部屋のみ予約（練習・リハーサル等）。メンバー予約なし

**キーの関係:**
- `template_id` → class_templates (NULL可: room_onlyの場合)
- `room_id` → rooms (NULL可: オンライン/外部会場の場合)
- `instructor_id` → instructors (NULL可: オーナー直営の場合)

### 3. instructor_room_bookings テーブル → 廃止

sessionsテーブルに統合。`session_type = 'room_only'` で表現。

### 4. classes テーブル → 段階的廃止

移行期間中は残す。新規作成はclass_templatesで行い、
既存データをclass_templatesに移行後に削除。

---

## 移行マッピング

### classes → class_templates

| classes カラム | class_templates カラム | 変換ルール |
|---|---|---|
| id | (新しいID生成) | — |
| studio_id | studio_id | そのまま |
| instructor_id | instructor_id | そのまま |
| name | name | そのまま |
| description | description | そのまま |
| duration_minutes | duration_minutes | そのまま |
| capacity | capacity | そのまま |
| price_cents | price_cents | そのまま |
| location | location | そのまま |
| is_online + online_link | class_type + online_link | is_online=true → 'online' |
| is_active | is_active | そのまま |
| is_public | is_public | そのまま |
| day_of_week | — | セッションに移動 |
| start_time | — | セッションに移動 |
| room_id | — | セッションに移動 |
| schedule_type | — | セッションに移動 |
| one_time_date | — | セッションに移動 |

### class_sessions → sessions（拡張）

| 旧カラム | 新カラム | 変換ルール |
|---|---|---|
| class_id | template_id | classesからclass_templatesへのマッピングで変換 |
| — | room_id | 親classのroom_idから引き継ぎ |
| — | instructor_id | 親classのinstructor_idから引き継ぎ |
| — | end_time | start_time + duration_minutesから算出 |
| — | duration_minutes | 親classから引き継ぎ |
| — | session_type | 'class' |
| is_cancelled | is_cancelled | そのまま |
| is_public | is_public | そのまま |
| is_online | — | template.class_typeで判定 |
| online_link | — | template.online_linkで判定 |

### instructor_room_bookings → sessions

| 旧カラム | 新カラム | 変換ルール |
|---|---|---|
| room_id | room_id | そのまま |
| instructor_id | instructor_id | そのまま |
| booking_date | session_date | そのまま |
| start_time | start_time | そのまま |
| end_time | end_time | そのまま |
| title | title | そのまま |
| — | template_id | NULL |
| — | session_type | 'room_only' |
| status='cancelled' | is_cancelled=true | ステータス変換 |
| is_public | is_public | そのまま |
| recurrence_group_id | recurrence_group_id | そのまま |

---

## API変更一覧

### 廃止するAPI

| Route | 理由 |
|---|---|
| `POST /api/instructor/room-bookings` | sessionsに統合 |
| `DELETE /api/instructor/room-bookings/[id]` | sessionsに統合 |
| `GET /api/instructor/room-bookings` | sessionsに統合 |

### 新規API

| Route | Method | 目的 |
|---|---|---|
| `/api/class-templates` | GET | テンプレート一覧取得 |
| `/api/class-templates` | POST | テンプレート作成 |
| `/api/class-templates/[id]` | PUT | テンプレート更新 |
| `/api/class-templates/[id]` | DELETE | テンプレート削除（論理削除） |
| `/api/sessions` | POST | セッション作成（class/room_only両対応） |
| `/api/sessions/[id]` | PUT | セッション更新 |
| `/api/sessions/[id]` | DELETE | セッションキャンセル |

### 変更するAPI

| Route | 変更内容 |
|---|---|
| `/api/cron/generate-sessions` | class_templatesベースで生成。繰り返しセッション対応 |
| `/api/dashboard/sessions` | sessionsテーブルから統合取得（room_only含む） |
| `/api/instructor/room-availability` | sessionsテーブルから取得に変更 |
| `/api/bookings` | session_type='class' のみ予約可能チェック追加 |
| `/api/stripe/class-checkout` | template.price_centsを参照に変更 |
| `/api/export/classes` | class_templatesベースに変更 |
| `/api/import/classes/execute` | class_templatesベースに変更 |

### 維持するAPI（変更なし）

| Route | 理由 |
|---|---|
| `/api/bookings/[bookingId]/cancel` | sessionsテーブル名変更の参照更新のみ |
| `/api/stripe/webhook` | session_id参照は変わらない |
| `/api/member/sessions` | sessionsテーブルから取得（既存のまま） |

---

## UI変更一覧

### 新規画面

| 画面 | 場所 | 内容 |
|---|---|---|
| テンプレート一覧 | オーナー + インストラクター | テンプレートカード一覧 + 新規作成ボタン |
| テンプレート作成/編集 | オーナー + インストラクター | 名前・料金・定員・タイプ等の設定フォーム |

### 変更する画面

| 画面 | 変更内容 |
|---|---|
| クラス作成 (`/classes/new`) | テンプレート作成UIに変更。日時・部屋は設定しない |
| クラス編集 (`/classes/[id]`) | テンプレート編集UIに変更 |
| オーナーカレンダー (`/classes`) | sessionsから統合取得。room_only含む。重複なし |
| オーナーRooms (`/rooms`) | 部屋ごとタイムライン（既存のroom-timeline改修） |
| インストラクター部屋予約 | カレンダーUIで空き時間タップ → テンプレート選択フォーム |
| CSV import/export | class_templatesベースに変更 |

### 削除する画面

| 画面 | 理由 |
|---|---|
| クラス作成の「Day of week」選択 | セッション作成時に日時指定に変更 |
| クラス作成の「Online」トグル | テンプレートのclass_typeに移動 |
| 旧部屋予約フォーム（日付+時間だけ） | 統合フォームに置換 |

---

## セッション作成フロー（詳細）

### 方法A: カレンダーからセッション作成（部屋あり）

```
1. インストラクター/オーナーがカレンダーで空き時間をタップ
2. フォームが開く:
 - Room: [自動選択済み]（タップした部屋）
 - Date: [自動選択済み]（タップした日付）
 - Time: [開始時間] – [終了時間]
 - Class Template: [ドロップダウン]
 - Morning Yoga (60 min · $20)
 - Power Flow (75 min · $25)
 - — Room only (no class) —
 - Repeat: ○ Single ○ Weekly (4 weeks)
3. テンプレート選択時: duration_minutesを自動反映してend_timeを計算
4. 「Room only」選択時: title入力欄が表示
5. 「Create Session」ボタンで作成
```

### 方法B: テンプレートからセッション作成（部屋なし可）

```
1. テンプレート一覧で「Schedule」ボタンをクリック
2. フォームが開く:
 - Template: [自動選択済み]
 - Date: [日付ピッカー]
 - Time: [開始時間]（end_timeはdurationから自動計算）
 - Room: [ドロップダウン, optional]
 - None — Online / External
 - main room
 - sub room
 - Online Link: [URL入力]（class_type=online/hybridの場合のみ表示）
 - Repeat: ○ Single ○ Weekly (N weeks)
3. 「Schedule N Sessions」ボタンで作成
```

### 繰り返しセッション作成ロジック

```
1. 開始日から N 週分の日付リストを生成
2. 各日付に対して:
 a. 部屋ありの場合: check_room_availability で衝突チェック
 b. 衝突する日はスキップ（ユーザーに通知）
 c. 全セッションに同じ recurrence_group_id を付与
3. Collective Mode の場合:
 a. インストラクターの月間利用時間をチェック
 b. 超過の場合: allow_overage の設定に従う
4. 結果: 作成成功/スキップされた日のサマリーを返す
```

---

## Cron: セッション自動生成の変更

### 現在の動作
- `classes` テーブルの `schedule_type='recurring'` を取得
- `day_of_week` に基づいて `session_generation_weeks` 分のセッションを生成

### 新しい動作
- `sessions` テーブルの `recurrence_rule='weekly'` のセッションを取得
- 各繰り返しセッションの最新日付から先のセッションを `session_generation_weeks` 分生成
- `template_id`, `room_id`, `instructor_id` を引き継ぎ
- 部屋ありの場合: 衝突チェック（衝突する日はスキップ）

---

## RLSポリシー

### class_templates
- **Owner/Manager**: Full CRUD (studio_id match)
- **Instructor**:
 - SELECT: 自分のstudioの全テンプレート
 - INSERT/UPDATE/DELETE: 自分が作成したテンプレートのみ
- **Member**: SELECT (is_public=true, is_active=true のみ)

### sessions（変更）
- 既存のclass_sessionsポリシーを維持
- `session_type='room_only'` に対する追加ポリシー:
 - **Instructor**: 自分のroom_onlyセッションのINSERT/DELETE
 - **Owner/Manager**: 全room_onlyセッションのCRUD

---

## Stripe連携の変更

### 価格解決の優先順位（変更後）
```
1. session.price_cents (セッション単位override)
2. template.price_cents (テンプレートの価格)
3. studio.drop_in_product.price (スタジオのデフォルト)
```

### Stripe Checkout metadata
```
変更前: class_id, session_id
変更後: template_id, session_id
```

### Webhook
- `session_id` ベースで処理 → 変更なし
- `class_id` 参照があれば `template_id` に変更

---

## 時間クォータ管理（Collective Mode）

### 変更点
- 現在: `instructor_room_bookings` から利用時間を集計
- 変更後: `sessions` テーブルから `instructor_id` + `room_id IS NOT NULL` で集計
- `get_instructor_used_minutes` RPCを更新

### 超過課金 Cron
- `instructor_room_bookings` → `sessions WHERE session_type IN ('class','room_only') AND room_id IS NOT NULL` に変更

---

## マイグレーション手順

### Phase 1: テーブル作成 + データ移行
```
1. class_templates テーブル作成
2. classes → class_templates にデータコピー
 - 各classに対応するtemplateを作成
 - class_id → template_id のマッピングテーブルを一時作成
3. sessions テーブルにカラム追加
 - template_id, room_id, instructor_id, end_time, etc.
4. 既存 class_sessions にデータ埋め込み
 - class_id → template_id (マッピング経由)
 - 親classの room_id, instructor_id を各セッションにコピー
 - end_time = start_time + duration_minutes
5. instructor_room_bookings → sessions にデータ移行
 - session_type = 'room_only'
 - template_id = NULL
```

### Phase 2: API + UI切り替え
```
6. 新APIを作成（class-templates, sessions）
7. 既存APIを新テーブルに向ける
8. UIコンポーネントを更新
9. Cron jobを更新
```

### Phase 3: クリーンアップ
```
10. 旧 classes テーブルを論理削除（一定期間残す）
11. 旧 instructor_room_bookings テーブルを論理削除
12. class_id カラムを sessions から削除
13. マッピングテーブルを削除
```

---

## 影響を受けるファイル一覧

### DB/Types
- [ ] `supabase/migrations/class_room_unification.sql` (新規)
- [ ] `src/types/database.ts` — ClassTemplate型追加、Session型変更

### API Routes
- [ ] `src/app/api/class-templates/route.ts` (新規)
- [ ] `src/app/api/class-templates/[id]/route.ts` (新規)
- [ ] `src/app/api/sessions/route.ts` (新規 or 変更)
- [ ] `src/app/api/sessions/[id]/route.ts` (新規)
- [ ] `src/app/api/cron/generate-sessions/route.ts` (変更)
- [ ] `src/app/api/dashboard/sessions/route.ts` (変更)
- [ ] `src/app/api/instructor/room-availability/route.ts` (変更)
- [ ] `src/app/api/instructor/room-bookings/route.ts` (廃止→統合)
- [ ] `src/app/api/bookings/route.ts` (変更)
- [ ] `src/app/api/stripe/class-checkout/route.ts` (変更)
- [ ] `src/app/api/stripe/webhook/route.ts` (変更)
- [ ] `src/app/api/export/classes/route.ts` (変更)
- [ ] `src/app/api/import/classes/execute/route.ts` (変更)
- [ ] `src/app/api/cron/tier-overage-billing/route.ts` (変更)

### UI Components
- [ ] `src/components/classes/class-edit-form.tsx` (大幅変更→テンプレート編集)
- [ ] `src/components/instructor/room-calendar.tsx` (変更→統合フォーム)
- [ ] `src/components/dashboard/calendar/` (変更)
- [ ] `src/components/dashboard/room-timeline.tsx` (変更)
- [ ] `src/components/member/calendar/` (変更)
- [ ] `src/components/booking-button.tsx` (軽微な変更)
- [ ] `src/app/(dashboard)/classes/new/page.tsx` (変更)
- [ ] `src/app/(dashboard)/classes/[id]/page.tsx` (変更)

### Pages
- [ ] `src/app/(dashboard)/classes/page.tsx` (変更)
- [ ] `src/app/(dashboard)/rooms/page.tsx` (変更)
- [ ] `src/app/(instructor)/room-bookings/page.tsx` (変更)

### Lib
- [ ] `src/lib/booking/actions.ts` (変更)
- [ ] `src/lib/plan-guard.ts` (軽微)

### Help
- [ ] `src/components/help/help-data.tsx` (更新必須)

---

## テスト確認項目

### テンプレート
- [ ] テンプレートのCRUDが正常に動作すること
- [ ] オーナー・インストラクター両方がテンプレートを作成できること
- [ ] インストラクターは自分のテンプレートのみ編集・削除できること

### セッション作成
- [ ] カレンダーから空き時間タップ → テンプレート選択 → セッション作成
- [ ] テンプレートから「Schedule」→ 日時・部屋選択 → セッション作成
- [ ] 「Room only」で部屋のみ予約ができること
- [ ] オンラインクラスが部屋なしで作成できること
- [ ] 単発セッションが作成できること
- [ ] 繰り返しセッション（N週分）が作成できること
- [ ] 繰り返し時に部屋の衝突がある日はスキップされること

### 表示
- [ ] オーナーカレンダーで重複なく表示されること
- [ ] 部屋タグが表示されること
- [ ] オンラインはアイコン付きで表示されること
- [ ] room_onlyはteal色で表示されること
- [ ] Rooms画面で部屋ごとのタイムラインが正しいこと

### 予約
- [ ] メンバーがclass型セッションを予約できること
- [ ] room_only型セッションはメンバーに表示されないこと
- [ ] クレジット/パスの消費が正しいこと
- [ ] Stripe決済が正しいこと（テンプレート価格の反映）

### 時間クォータ
- [ ] Collective Modeの利用時間が正しく集計されること
- [ ] 超過検知・警告が動作すること
- [ ] 月末超過課金Cronが正しく動作すること

### CSV
- [ ] CSV exportがclass_templatesベースで動作すること
- [ ] CSV importがclass_templates + セッション作成で動作すること

### データ移行
- [ ] 既存classesがclass_templatesに正しく移行されること
- [ ] 既存class_sessionsのtemplate_idが正しく設定されること
- [ ] 既存instructor_room_bookingsがsessionsに正しく移行されること
- [ ] 既存の会員予約（bookings）が移行後も正しく紐づくこと
- [ ] Stripe決済履歴との紐づけが維持されること
