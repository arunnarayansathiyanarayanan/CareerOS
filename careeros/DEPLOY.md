# Deploy CareerOS to Vercel

## One-time setup

1. **Log in to Vercel CLI** (or use the dashboard):

   ```bash
   cd careeros
   npx vercel login
   ```

2. **Import from GitHub** (recommended): [vercel.com/new](https://vercel.com/new) → repo `CareerOS` → set **Root Directory** to `careeros`.

3. **Environment variables** — Vercel → Project → Settings → Environment Variables → Production. Copy names from [`.env.example`](.env.example). Required:

   - Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (use **production** keys for public users)
   - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
   - `OPENAI_API_KEY`, `NEXT_PUBLIC_APP_URL` (`https://aihired.in` once DNS is pointed at Vercel)
   - R2: `R2_*`, `INTERVIEW_AUDIO_STORAGE=r2`
   - `CRON_SECRET` — generate: `openssl rand -hex 32` (Vercel Cron sends this as `Authorization: Bearer …`)
   - Upstash (community/streaks): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
   - Email (optional): `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

4. **Clerk** — add your Vercel URL under **Domains** so sign-in works.

5. **Supabase** — apply migrations from repo root:

   ```bash
   supabase link
   supabase db push
   ```

## Deploy

**Git push** (if project is linked to GitHub): push `main` → Vercel auto-deploys.

**CLI**:

```bash
cd careeros
npx vercel --prod
```

After DNS for `aihired.in` is live, set `NEXT_PUBLIC_APP_URL=https://aihired.in` and redeploy.

## Sync env from local (optional)

```bash
cd careeros
npx vercel login
npx vercel link
node scripts/sync-vercel-env.mjs
npx vercel --prod
```

Do not commit `.env.local`. Rotate any keys that were ever exposed.
