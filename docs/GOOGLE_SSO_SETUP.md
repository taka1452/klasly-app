# Google SSO Setup Guide

This document explains how to configure Google SSO with Supabase Auth for the Klasly app.

---

## PART 1 — CODE IMPLEMENTATION (Already Done)

- **Login page**: "Continue with Google" button added below email/password form
- **Signup page**: "Continue with Google" button at top, with "or sign up with email" divider
- **Auth callback**: `/auth/callback` exchanges OAuth code for session and redirects by role
- **Error handling**: Callback failures and OAuth errors redirect to login with error message
- **Profile creation**: `handle_new_user` trigger supports both `full_name` and `name` (Google) in metadata

---

## PART 2 — SUPABASE CONFIGURATION GUIDE

### Step 1: Enable Google Provider

1. Open your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Authentication** → **Providers**
4. Find **Google** and click to expand
5. Toggle **Enable Sign in with Google** to ON

### Step 2: Copy Values for Google Cloud Console

Before configuring Google, you will need to add the **Callback URL** (Authorized redirect URI) in Google Cloud Console. Supabase provides this URL:

```
https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback
```

- Replace `<YOUR_PROJECT_REF>` with your Supabase project reference (e.g. `xjfyzyibhlyadowcplev`)
- Find it in: Supabase Dashboard → **Settings** → **API** → **Project URL** (the UUID-like part before `.supabase.co`)

### Step 3: Configure Site URL in Supabase

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your production URL:
 - Production: `https://yourdomain.com`
 - Local dev: `http://localhost:3000`

### Step 4: Configure Redirect URLs in Supabase

1. In **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add:
 - `http://localhost:3000/auth/callback` (local dev)
 - `https://yourdomain.com/auth/callback` (production)
 - `https://*.vercel.app/auth/callback` (if using Vercel preview deploys)

3. The `redirectTo` in your app must match one of these URLs exactly.

### Step 5: Paste Google Credentials into Supabase

After creating the OAuth client in Google Cloud Console (see Part 3):

1. Copy **Client ID** and **Client Secret** from Google
2. In Supabase: **Authentication** → **Providers** → **Google**
3. Paste **Client ID** and **Client Secret**
4. Click **Save**

---

## PART 3 — GOOGLE CLOUD CONSOLE GUIDE

### Step 1: Create or Select Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Ensure you are in the correct project (top bar)

### Step 2: Enable Required APIs

1. Go to **APIs & Services** → **Library**
2. Search for **Google Identity**
3. Ensure **Google Identity Services** / **Google+ API** (if applicable) are enabled
4. For OAuth 2.0, you typically need the **Google Identity** configuration (OAuth consent + credentials)

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (or Internal for workspace-only)
3. Fill in:
 - **App name**: e.g. "Klasly"
 - **User support email**: your email
 - **Developer contact**: your email
4. Add scopes if needed (Supabase uses `email`, `profile`, `openid` by default)
5. Save and continue

### Step 4: Create OAuth 2.0 Client ID

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. **Name**: e.g. "Klasly Web"

### Step 5: Set Authorized JavaScript Origins

Add your app origins:

- Local: `http://localhost:3000`
- Production: `https://yourdomain.com`
- Vercel: `https://your-app.vercel.app` (add each environment as needed)

### Step 6: Set Authorized Redirect URIs

Add **exactly** the Supabase callback URL:

```
https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback
```

- Do **not** use your app's `/auth/callback` here
- Google redirects to Supabase first; Supabase then redirects to your app

### Step 7: Copy Client ID and Client Secret

1. After creating, you’ll see **Client ID** and **Client Secret**
2. Copy both
3. Paste into Supabase (Authentication → Providers → Google)

---

## PART 4 — ENVIRONMENT VARIABLES

### Required Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (e.g. `https://xxx.supabase.co`) | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `NEXT_PUBLIC_APP_URL` | App base URL for redirects (e.g. `https://yourdomain.com` or `http://localhost:3000`) | Yes (or rely on Vercel) |

### Where to Configure

**Local (`.env.local`):**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Vercel Production:**

1. Project → **Settings** → **Environment Variables**
2. Add:
 - `NEXT_PUBLIC_SUPABASE_URL`
 - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
 - `NEXT_PUBLIC_APP_URL` = `https://yourdomain.com`

If `NEXT_PUBLIC_APP_URL` is not set, the app uses `VERCEL_URL` automatically (`https://${VERCEL_URL}`).

---

## PART 5 — VERIFICATION CHECKLIST

### Local Testing

- [ ] Run `npm run dev`
- [ ] Open `http://localhost:3000/login`
- [ ] Click **Continue with Google**
- [ ] Sign in with Google
- [ ] Confirm redirect to dashboard/onboarding
- [ ] Check that session persists after refresh

### Production Testing

- [ ] Deploy to production
- [ ] Add production redirect URL in Supabase
- [ ] Add production origin in Google Cloud Console
- [ ] Test full flow from login to dashboard

### Verify User Identity in Database

**Check that Google identity is linked:**

```sql
-- List users with Google provider
SELECT
 id,
 email,
 raw_user_meta_data->>'full_name' AS full_name,
 raw_user_meta_data->>'name' AS name,
 raw_app_meta_data->'provider' AS provider,
 created_at
FROM auth.users
WHERE raw_app_meta_data->>'provider' = 'google';
```

**Check profile was created:**

```sql
SELECT p.id, p.email, p.full_name, p.role, p.studio_id
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.raw_app_meta_data->>'provider' = 'google';
```

---

## PART 6 — COMMON FAILURES & DEBUGGING

### 1. `redirect_uri_mismatch`

**Cause:** The redirect URI in Google Cloud Console does not match Supabase’s callback URL.

**Fix:**

- Google: Use only `https://<project>.supabase.co/auth/v1/callback`
- Do not use your app’s `/auth/callback` in Google
- Ensure no trailing slash and exact casing

### 2. Provider Not Enabled

**Cause:** Google provider is disabled in Supabase, or credentials are missing.

**Fix:**

- Supabase → Authentication → Providers → Google
- Enable and add Client ID + Client Secret

### 3. Cookies Not Persisting

**Cause:** `SameSite`, domain, or secure cookie issues.

**Fix:**

- Use `createServerClient` from `@supabase/ssr` (already in use)
- Ensure Site URL and Redirect URLs in Supabase match your app origin
- Test in normal browsing (not incognito) first

### 4. Session Not Created / `auth_callback_failed`

**Cause:** Code exchange fails; often redirect URL not in Supabase allowlist.

**Fix:**

- Supabase → Authentication → URL Configuration → Redirect URLs
- Add `http://localhost:3000/auth/callback` (local) and production callback
- Ensure `redirectTo` in code matches an allowed URL exactly

### 5. "Invalid OAuth Request" or "state mismatch"

**Cause:** PKCE/state mismatch, often due to cookie issues or multiple tabs.

**Fix:**

- Clear cookies and try again
- Avoid opening multiple OAuth tabs

### 6. Profile Not Created for Google User

**Cause:** `handle_new_user` expects `full_name`; Google sends `name`.

**Fix:** Apply migration `handle_new_user_google_name.sql` (uses `COALESCE(full_name, name)`).

---

## Quick Reference

| Item | Value |
|------|-------|
| App callback path | `/auth/callback` |
| Google redirect URI | `https://<project>.supabase.co/auth/v1/callback` |
| Supabase Redirect URLs | `https://yourdomain.com/auth/callback`, `http://localhost:3000/auth/callback` |
