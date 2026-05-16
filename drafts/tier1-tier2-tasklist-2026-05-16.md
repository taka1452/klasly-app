# Tier 1 + Tier 2 (selected) Task List — 2026-05-16

## Tier 1 (実装決定)

### T1-1: CSV import で tags 列を読む (S)  ✅ DONE (A-10)
- **できること**: 既存システムから "veteran" "first_responder" などの tag付きで一括 import
- **シーン**: 6/1ローンチで 200人を tag付きで投入 → discount auto-apply が初日から効く
- **これがないと**: 200人を Member 詳細画面で手動 tagging する手間

### T1-2: 一括 "waiver 再署名お願い" メール (S)
- **できること**: 設定画面で waiver を選び「未署名者 N人に署名催促メールを送る」ボタン1発
- **シーン**: Aerial Yoga waiver を新設 → 既存 member 100人に署名要求が必要
- **これがないと**: 1人ずつ手動メール、未署名のまま予約ブロック継続

### T1-3: クラス前リマインダーメール (24h前 / 1h前) (M)
- **できること**: クラス前日と1時間前に自動メール送信
- **業界効果**: no-show 率が 20〜30% 下がる
- **これがないと**: 「リマインダー来なかった」苦情 + no-show 損失

### T1-4: テストメール送信 (admin宛 preview) (S)
- **できること**: confirmation email カスタム文面を保存前に自分宛にテスト送信
- **シーン**: Jamie が `{memberName}` 込み文面を inbox で確認
- **これがないと**: 本物のテスト account を作らないと文面確認できない

### T1-5: Pass renewal reminder (期限 7日前 / 当日) (S)
- **できること**: pass 期限 7日前に member に「残り 7日です」自動メール
- **シーン**: 4ヶ月 class pack 切れる前に push → 再購入率UP
- **これがないと**: 静かに pass 切れ → 「いつの間にか予約できなくなった」離脱

### T1-6: Same-email role-switcher (M)
- **できること**: Jamie 1つの email で Admin / Instructor を画面右上で切替
- **今**: A-7 で別 email 強制ガード入り済み、workaround として運用可
- **これがあると**: dev account 2つ要らない、運用ラク

---

## Tier 2 (実装決定)

### T2-1: Checkout中の sign-waiver モーダル (M)
- **できること**: 予約時 waiver 未署名 → エラー戻りでなく、その場で署名モーダル → サイン → 予約完了
- **シーン**: 新規 Aerial 受講者が初回予約で離脱せず完了
- **これがないと**: エラー出る → 戻る → waiver ページ → サイン → 戻る → 予約 (離脱要因)

### T2-2: Tag別 filter + bulk email (M)
- **できること**: `/members` で「`veteran` だけ表示」「`first_responder` 全員にメール」
- **シーン**: 退役軍人デー限定メッセージ、初心者向けクラスの案内
- **これがないと**: segment marketing は手動でメールリスト作成

### T2-3: 80% 到達アラート (instructor) (M)
- **できること**: instructor の月時間が tier の 80% を超えたら本人にメール
- **シーン**: 月末 overage 予想金額を事前に伝えて計画立てさせる
- **これがないと**: dashboard を自分で見に行かないと残り時間が分からない

### T2-4: Pass gifting (L)
- **できること**: member 間で残り回数を贈与（誕生日プレゼント等）
- **シーン**: friend に "10回分のパスをあげる" UX
- **これがないと**: studio 経由で手動移管しかない

### T2-5: Pass freeze (vacation hold) (L)
- **できること**: 「旅行中の 2週間は止めて」を member 側操作 (admin承認制も可)
- **シーン**: 長期不在で pass を無駄にしない
- **これがないと**: 期限延長を studio に毎回依頼

---

## 進行順 (推奨)

小さい→大きい順で着手し、各完了ごとに小区切り:

1. T1-4 (S) test email send
2. T1-2 (S) waiver bulk re-sign
3. T1-5 (S) pass renewal reminder
4. T1-3 (M) class reminder emails
5. T1-6 (M) role-switcher
6. T2-3 (M) 80% alert
7. T2-1 (M) sign-waiver modal
8. T2-2 (M) tag filter + bulk email
9. T2-5 (L) pass freeze
10. T2-4 (L) pass gifting
11. Debug pass — 全体動作確認 + 型チェック + コンソールエラー確認
