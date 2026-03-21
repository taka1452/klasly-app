# Entity Lifecycle & Data Integrity Guide

各エンティティの「作成→変更→削除」時の影響範囲を記録する。
新機能追加・削除ロジック変更時はこのドキュメントを必ず更新すること。

---

## 1. Studio（ルートエンティティ）

### 削除時の影響（CASCADE）
全ての子テーブルが CASCADE で削除される。削除順序は `/api/account/delete` で管理。

| 削除対象 | FK動作 | 備考 |
|----------|--------|------|
| profiles | 明示削除 | auth.users も削除 |
| members | 明示削除 | 予約・パス・ウェイバー全て消失 |
| instructors | 明示削除 | 収益記録も消失 |
| managers | CASCADE | |
| classes / class_templates | 明示削除 | |
| class_sessions | 明示削除 | |
| bookings | 明示削除 | |
| events / event_bookings | CASCADE | |
| studio_passes / pass_subscriptions | CASCADE | Stripe サブスクは事前キャンセル |
| instructor_earnings | 明示削除 | 監査証跡が失われる |
| messages | CASCADE | 会話全体が消失 |
| waiver_templates / waiver_signatures | CASCADE | |
| soap_notes | CASCADE | |
| rooms | 明示削除 | |
| studio_features / widget_settings | CASCADE | |
| support_tickets | SET NULL | チケットは孤立するが残る |
| email_logs / webhook_logs | SET NULL | ログは孤立するが残る |
| referral_rewards | **制約なし** | ⚠ 孤立レコードが残る |

### ステータス管理
- `plan_status`: trialing → active → past_due → grace → canceled
- `cancel_at_period_end`: 期間終了時にキャンセル予約

---

## 2. Profile（ユーザーアカウント）

### 作成
- auth.users 作成時に trigger で自動作成、または招待時に手動作成

### 削除時の影響
| 削除対象 | FK動作 | 備考 |
|----------|--------|------|
| members | 別途チェック | profile_id 経由 |
| instructors | 別途チェック | profile_id 経由 |
| managers | CASCADE | |
| messages | CASCADE | ⚠ 送受信両方の会話が全削除 |
| announcement_reads | CASCADE | |
| studio_announcements | SET NULL (created_by) | |

### 注意点
- Profile は studio_id なしで存在可能（退会後）
- auth.users 削除時に profile が孤立する可能性あり

---

## 3. Member（メンバー）

### 作成
- オーナーが手動作成 / 招待リンク / セルフ登録

### ステータス管理（ソフトデリート）
- `status`: active → paused → cancelled
- ハードデリートはしない（履歴保持）

### 削除時の影響（cancelled 時は論理削除のみ）
| 影響対象 | FK動作 | 備考 |
|----------|--------|------|
| bookings | 残る | member_id で紐づき保持 |
| pass_subscriptions | CASCADE | ⚠ サブスク記録が消失 |
| pass_class_usage | CASCADE | |
| waiver_signatures | CASCADE | ⚠ 署名記録が消失 |
| drop_in_attendances | CASCADE | |
| event_bookings | SET NULL | 予約は残るが member 不明に |
| soap_notes | CASCADE | ⚠ 施術記録が消失 |
| payments | 残る (NULLABLE FK) | |

### ⚠ 問題点
- メンバーの物理削除（スタジオ削除時）で SOAP ノート・ウェイバー署名が完全消失
- 法的にウェイバー署名は保持義務がある場合がある

---

## 4. Instructor（インストラクター）

### 作成
- オーナーが `/api/instructors/create` で作成
- 招待リンク経由で自己登録
- オーナー/マネージャーが `instructor-toggle` で自身を登録

### 削除フロー（`/api/instructors/[id]` DELETE）
1. `classes.instructor_id = NULL` に更新
2. `class_sessions.instructor_id = NULL` に更新
3. `soap_notes.instructor_id = NULL` に更新
4. `instructors` レコードを物理削除
5. 他にロールがなければ auth.users と profile も削除

### 削除時の影響
| 影響対象 | FK動作 | 明示処理 | 備考 |
|----------|--------|----------|------|
| classes | SET NULL | ✅ 明示 | クラスは残るが担当者不明 |
| class_sessions | SET NULL | ✅ 明示 | セッションは残る |
| soap_notes | SET NULL | ✅ 明示 | ノートは残るが作成者不明 |
| instructor_earnings | CASCADE | ❌ 暗黙 | ⚠ 収益記録が消失 |
| instructor_fee_overrides | CASCADE | ❌ 暗黙 | |
| instructor_memberships | CASCADE | ❌ 暗黙 | Stripe サブスク未キャンセル？ |
| instructor_room_bookings | CASCADE | ❌ 暗黙 | 確定済み予約も消失 |
| instructor_overage_charges | CASCADE | ❌ 暗黙 | 未精算の超過料金も消失 |
| pass_distributions | CASCADE | ❌ 暗黙 | 配分記録が消失 |
| pass_class_usage | CASCADE | ❌ 暗黙 | |

### ⚠ 問題点
1. **instructor_earnings が CASCADE で消失** — 会計記録として保持すべき
2. **instructor_memberships の Stripe サブスクがキャンセルされない** — 課金が続く
3. **未精算の overage_charges が消失** — 未請求分が失われる
4. **確定済みの room_bookings が消失** — 他のインストラクターに影響

---

## 5. Manager（マネージャー）

### 作成
- オーナーが `/api/instructors/[id]/manager-role` POST で昇格
- 招待リンク経由で自己登録

### 削除フロー
1. managers レコードを物理削除
2. profile.role を "instructor" に戻す

### ⚠ 問題点
- マネージャーがインストラクター兼任の場合、instructors レコードのクリーンアップが不十分
- manager 削除後も instructor レコードが残る（意図的だが確認必要）

---

## 6. ClassSession（セッション）

### ステータス管理
- `is_cancelled`: boolean（ソフトデリート）

### キャンセル時の影響
| 影響対象 | 処理 | 備考 |
|----------|------|------|
| bookings | 個別キャンセル必要 | 自動キャンセルされない |
| drop_in_attendances | 残る | 整合性問題 |
| pass_class_usage | 残る | パス利用数が戻らない |

### ⚠ 問題点
- セッションキャンセル時に紐づく bookings が自動キャンセルされない
- パス利用のリバートが手動（API呼び出し必要）

---

## 7. Booking（予約）

### ステータス管理
- `status`: confirmed / cancelled / waitlist

### キャンセルフロー（`/api/bookings/[bookingId]/cancel`）
1. status = "cancelled" に更新
2. パス利用の場合: pass_class_usage 削除 + usage デクリメント
3. クレジット利用の場合: credits インクリメント
4. ウェイトリスト繰り上げ処理

### ⚠ 問題点
- ウェイトリスト繰り上げ時のクレジットチェックが不完全（前回のバグチェックで修正済み）

---

## 8. StudioPass & PassSubscription（パス）

### パス削除
- `is_active = false`（ソフトデリート）
- 既存サブスクリプションには影響しない

### サブスクリプションキャンセル
- `status = "cancelled"` に更新
- Stripe サブスクリプションもキャンセル

### ⚠ 問題点
- パスを非アクティブにしても既存サブスクが自動キャンセルされない（意図的だが要確認）

---

## 9. Event（イベント）

### ステータス管理
- `status`: draft → published → sold_out → completed → cancelled

### 削除時の影響
| 影響対象 | FK動作 | 備考 |
|----------|--------|------|
| event_options | CASCADE | |
| event_bookings | CASCADE | ⚠ 支払済み予約も消失 |
| event_payment_schedule | CASCADE (via booking) | ⚠ 支払記録消失 |

### ⚠ 問題点
- イベント削除で支払済み予約が CASCADE 削除される — 返金処理が必要

---

## 10. WaiverSignature（ウェイバー署名）

### 作成
- メンバーがウェイバーに署名時に作成
- `token_used = true` で署名完了

### 削除時の影響
- メンバー削除で CASCADE 削除
- テンプレート削除で CASCADE 削除

### ⚠ 問題点
- 法的に署名記録の保持義務がある場合、CASCADE 削除は問題
- テンプレート更新時に旧署名との紐づけが切れる

---

## 11. SOAPNote（施術記録）

### 閲覧権限
- 作成者（インストラクター）: 全件閲覧可
- オーナー/マネージャー: confidential=false のみ
- メンバー本人: 閲覧不可

### 削除の影響
- インストラクター削除: instructor_id = NULL（ノートは残る）
- メンバー削除: CASCADE 削除（⚠ 施術記録が完全消失）
- スタジオ削除: CASCADE 削除

---

## 12. Message（メッセージ）

### 削除の影響
- sender_id または recipient_id のプロフィール削除で CASCADE 全削除

### ⚠ 問題点
- 片方のユーザー削除で相手側の会話も全消失
- ソフトデリートなし — アーカイブ機能がない

---

## データ整合性リスクまとめ

### CRITICAL（データ消失リスク）
1. **instructor_earnings が CASCADE 削除** — 会計監査に必要な記録が消失
2. **メッセージが CASCADE 削除** — 片方の退会で全会話が消失
3. **referral_rewards に FK 制約なし** — 孤立レコードが蓄積

### HIGH（業務影響）
4. **インストラクター削除時に Stripe サブスクが残る** — 課金継続
5. **セッションキャンセル時に bookings が自動処理されない** — 手動対応必要
6. **イベント削除で支払済み予約が消失** — 返金漏れ

### MEDIUM（データ品質）
7. **ウェイバー署名が CASCADE 削除** — 法的保持義務の可能性
8. **SOAP ノートがメンバー削除で CASCADE** — 施術記録の消失
9. **overage_charges が未精算のまま消失** — 収益漏れ
10. **created_by が text 型で FK なし** — 作成者追跡不能

### LOW（運用改善）
11. **ログテーブルの保持ポリシーなし** — 無限に蓄積
12. **孤立レコードのクリーンアップジョブなし**
13. **Stripe レコードのクリーンアップなし**
