# Demo Video 作成手順

マーケティング用 30–60 秒ショート動画（字幕付き mp4）を自動生成するパイプライン。

## 構成

- **録画**: Playwright の `video` オプション（`playwright.config.demo.ts`）
- **シーン定義**: `e2e/demo/demo-marketing.spec.ts`（1 `test()` = 1 シーン）
- **連結・字幕**: `scripts/build-demo-video.sh`（ffmpeg）
- **字幕**: `scripts/demo-subtitles.srt`
- **シード SQL**: `scripts/demo-seed.sql`（必要に応じ調整して実行）

## 前提

1. **ffmpeg** を事前にインストール
   - macOS: `brew install ffmpeg`
   - Debian/Ubuntu: `sudo apt install ffmpeg fonts-noto-cjk`
2. **デモ用 Supabase プロジェクト**を用意（本番 DB を使わない）
3. `.env.local` に以下を設定
   ```
   DEV_LOGIN_EMAIL=owner@demo.klasly.app
   DEV_LOGIN_PASSWORD=<password>
   NEXT_PUBLIC_SUPABASE_URL=<demo project url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<demo anon key>
   ```
4. Supabase Auth でオーナーユーザーを作成し、`scripts/demo-seed.sql` を
   Supabase SQL Editor で実行（`:studio_id` / `:owner_id` を差し替え）

## 実行

```bash
# 1. 録画（Playwright が dev サーバを起動 → 各シーンを録画）
npm run demo:record

# 2. mp4 生成（webm 連結 + 字幕焼き込み）
npm run demo:build

# もしくは一括
npm run demo:all
```

出力: `demo-marketing.mp4`

## シーン調整

- 尺を変える → `e2e/demo/demo-marketing.spec.ts` 内の `hold(page, ms)` を調整
- シーン追加 → `test("06-xxx", ...)` を追加（番号順に連結される）
- 字幕を変える → `scripts/demo-subtitles.srt` を編集（SRT タイムコードは連結後の総尺に合わせる）
- 解像度を変える → `playwright.config.demo.ts` の `viewport` と `build-demo-video.sh` の `scale=1280:720`

## トラブルシューティング

- **字幕が□で表示される**: CJK フォントが不足。`fonts-noto-cjk` をインストール後、
  `build-demo-video.sh` の `Fontname=Noto Sans CJK JP` が合致しているか確認
- **ログイン画面で止まる**: `DEV_LOGIN_EMAIL` / `DEV_LOGIN_PASSWORD` が設定されているか確認
- **空の画面が録画される**: `demo-seed.sql` を実行してデモデータを投入
