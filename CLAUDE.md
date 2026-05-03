## Rules

- When any user-facing feature is added, changed, or removed, the help page content in `src/data/help-articles.ts` (and `src/data/help-categories.ts` if a new category is needed) MUST be updated to reflect the change. This is what `https://app.klasly.app/help` and every dashboard `?` icon (`ContextHelpLink` → `/help/<category>/<article>`) actually render.

## Supabase migrations naming

新しいマイグレーションファイルは **`YYYYMMDDHHMMSS_<snake_case_name>.sql`** 形式（リモートDBの登録形式に合わせたタイムスタンプベース）で `supabase/migrations/` に追加する。

- 旧来の連番形式 (`20240101000NNN_*.sql`) は既存ファイルのみで使用しており、新規追加では使わない。リモートDBの `supabase_migrations.schema_migrations` には連番ファイルの履歴が登録されていないため、連番で追加すると履歴の整合が取れなくなる。
- 例: `20260426143000_add_member_tags.sql`
- 適用は `mcp__supabase__apply_migration`（または `supabase db push`）経由で行い、適用後リモートDBの履歴に登録されることを `mcp__supabase__list_migrations` で確認する。

## Preview verification

When verifying UI changes in the preview browser, always start from the dev-login page to authenticate:

```
http://localhost:<port>/dev-login
```

- Set `DEV_LOGIN_EMAIL` and `DEV_LOGIN_PASSWORD` in `.env.local` for one-click login.
- After sign-in, the browser redirects to `/dashboard`.
- `/dev-login` returns 404 in production (`NODE_ENV !== "development"`).
