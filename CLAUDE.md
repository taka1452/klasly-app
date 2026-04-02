## Rules

- When any user-facing feature is added, changed, or removed, the help page content in `src/components/help/help-data.tsx` MUST be updated to reflect the change.

## Preview verification

When verifying UI changes in the preview browser, always start from the dev-login page to authenticate:

```
http://localhost:<port>/dev-login
```

- Set `DEV_LOGIN_EMAIL` and `DEV_LOGIN_PASSWORD` in `.env.local` for one-click login.
- After sign-in, the browser redirects to `/dashboard`.
- `/dev-login` returns 404 in production (`NODE_ENV !== "development"`).
