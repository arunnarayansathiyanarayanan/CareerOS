# Deploy Aihired (CareerOS) to Vercel + aihired.in

Production app lives in **`careeros/`**. The public domain is **`https://aihired.in`** (apex). `www.aihired.in` redirects to apex via `vercel.json`.

## Prerequisites

- GitHub repo pushed: `arunnarayansathiyanarayanan/CareerOS`
- Supabase project with migrations applied (`supabase db push` from repo root)
- Clerk **production** instance (not only development keys)
- Cloudflare R2 bucket for interview audio (or set `INTERVIEW_AUDIO_STORAGE=supabase`)
- Optional: Upstash Redis, Resend email

---

## 1. Create the Vercel project

### Option A — Dashboard (recommended)

1. Open [vercel.com/new](https://vercel.com/new) and import **CareerOS** from GitHub.
2. **Root Directory**: `careeros` (required).
3. Framework: **Next.js** (auto-detected).
4. Build command: `npm run build` (default).
5. Install command: `npm install` (default).
6. Deploy once (it may fail until env vars are set — that is expected).

### Option B — CLI

```bash
cd careeros
npx vercel login
npx vercel link
npx vercel --prod
```

---

## 2. Environment variables (Production)

Vercel → Project → **Settings** → **Environment Variables** → scope **Production**.

Copy names from [`.env.example`](.env.example). Minimum required:

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk **production** publishable key |
| `CLERK_SECRET_KEY` | Clerk **production** secret |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; never expose to client |
| `DATABASE_URL` | Supabase pooler URI (Session mode, port 5432) |
| `OPENAI_API_KEY` | OpenAI API key |
| `NEXT_PUBLIC_APP_URL` | **`https://aihired.in`** (no trailing slash) |
| `CRON_SECRET` | Random secret; `openssl rand -hex 32` |
| `INTERVIEW_AUDIO_STORAGE` | `r2` or `supabase` |
| `R2_*` | Required if using R2 (see `.env.example`) |

Recommended for full features:

- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (e.g. `Aihired <onboarding@aihired.in>`)
- `POSTHOG_API_KEY`, `NEXT_PUBLIC_POSTHOG_KEY` (optional analytics)

**Sync from local** (after `vercel link`):

```bash
cd careeros
# Set NEXT_PUBLIC_APP_URL=https://aihired.in in .env.local first
node scripts/sync-vercel-env.mjs
npx vercel --prod
```

The build runs `scripts/validate-production-env.mjs` on Vercel and fails if required Production vars are missing or if `NEXT_PUBLIC_APP_URL` is not `aihired.in`.

---

## 3. Connect domain aihired.in

### In Vercel

1. Project → **Settings** → **Domains**.
2. Add **`aihired.in`** (apex).
3. Add **`www.aihired.in`** (optional; redirects to apex in `vercel.json`).
4. Vercel shows DNS records to add at your registrar.

### At your domain registrar (where you bought aihired.in)

Typical setup (use the exact values Vercel shows for your project):

| Type | Name | Value |
|------|------|--------|
| **A** | `@` | `76.76.21.21` |
| **CNAME** | `www` | `cname.vercel-dns.com` |

Some registrars use **ALIAS/ANAME** for apex instead of A — follow Vercel’s instructions for your DNS host.

Wait for DNS propagation (minutes to 48 hours). Vercel issues SSL automatically when DNS is valid.

### After DNS is live

1. Confirm `NEXT_PUBLIC_APP_URL=https://aihired.in` in Vercel Production env.
2. **Redeploy** (Deployments → … → Redeploy).

---

## 4. Clerk (auth)

Clerk Dashboard → your **production** application:

1. **Domains** → add `aihired.in` (and `www.aihired.in` if used).
2. **Paths** — sign-in `/sign-in`, sign-up `/sign-up` (already used in app).
3. **Allowed redirect URLs** — include:
   - `https://aihired.in/*`
   - `https://www.aihired.in/*`
4. Use **production** API keys in Vercel (not test keys).

---

## 5. Supabase

From repo root:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

In Supabase → **Authentication** → **URL configuration** (if using Supabase Auth elsewhere): add `https://aihired.in` to site URL / redirect allow list.

Ensure RLS policies from `supabase/migrations/` are applied.

---

## 6. Cloudflare R2 (interview audio)

If `INTERVIEW_AUDIO_STORAGE=r2`:

1. Bucket **public access** enabled for `R2_PUBLIC_URL`.
2. CORS (if uploads from browser): allow origin `https://aihired.in`.
3. API token with Object Read & Write on the bucket.

---

## 7. Cron jobs

`vercel.json` defines crons (roadmap regen, streaks, leaderboard, skill intelligence, etc.). They require:

- **Vercel Pro** (or eligible plan) for cron execution
- `CRON_SECRET` set in Production — Vercel sends `Authorization: Bearer <CRON_SECRET>`

---

## 8. Email (optional)

Resend:

1. Verify domain **aihired.in** in Resend.
2. Set `RESEND_FROM_EMAIL=Aihired <onboarding@aihired.in>`.

---

## 9. Deploy / updates

**Automatic**: push to `main` → Vercel rebuilds.

**Manual**:

```bash
cd careeros
npx vercel --prod
```

---

## 10. Production smoke test

After deploy:

- [ ] `https://aihired.in` loads with valid SSL
- [ ] `https://www.aihired.in` redirects to apex
- [ ] Sign up / sign in (Clerk)
- [ ] Onboarding completes
- [ ] Public profile `https://aihired.in/u/<username>`
- [ ] `/robots.txt` and `/sitemap.xml` respond
- [ ] Interview upload (R2) if enabled

---

## Security notes

- Never commit `.env.local` or production secrets.
- Rotate keys if they were ever exposed in chat or logs.
- `CRON_SECRET` must be long and random; do not reuse dev values in production.
