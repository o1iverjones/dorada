# Dorada — Production Deployment Guide

> **Purpose:** This document outlines everything required to move Dorada from a local development environment to a hosted, production-ready environment for QA and beyond. It covers hosting options, required third-party services, and a step-by-step technical migration checklist.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Branching & Release Strategy](#2-branching--release-strategy)
3. [Hosting — Railway](#3-hosting--railway)
4. [Required Third-Party Services](#4-required-third-party-services)
5. [Technical Migration Checklist](#5-technical-migration-checklist)
6. [Environment Variables Reference](#6-environment-variables-reference)
7. [Mobile App Publishing](#7-mobile-app-publishing)
8. [Security Hardening Checklist](#8-security-hardening-checklist)
9. [Estimated Monthly Costs](#9-estimated-monthly-costs)
10. [Alternative Hosting Options](#10-alternative-hosting-options)

---

## 1. Platform Overview

Dorada is a multi-tenant medical interpretation management platform. The production environment must run the following components:

| Component | Technology | Notes |
|---|---|---|
| **API server** | Fastify (Node.js 20, TypeScript) | Compiled to `dist/`, served with `node dist/main.js`. Dockerfile exists at `apps/api/Dockerfile`. |
| **Web admin** | React + Vite, served via Nginx | Static build proxied through Nginx. Dockerfile exists at `apps/web/Dockerfile`. |
| **Mobile app** | Expo SDK 54 (React Native 0.81) | Built locally via `eas build --local`. API URL set per environment via `app.config.js`. |
| **Database** | PostgreSQL 16 | Managed by Prisma. Schema migrations must run on every deploy. |
| **Cache / queue** | Redis 7 | Used for session management and Socket.io adapter. |
| **File storage** | Cloudflare R2 | S3-compatible object storage. Local `uploads/` folder is a dev-only fallback; R2 is the production target. |
| **Real-time** | Socket.io | Admin web messaging. Requires sticky sessions or Redis adapter if horizontally scaled. |
| **Report worker** | Node.js / BullMQ | Separate long-running process (`workers/reports-worker.ts`). Must be deployed as its own service — API and worker are independent processes. |

---

## 2. Branching & Release Strategy

Dorada uses a two-branch model:

| Branch | Environment | Purpose |
|---|---|---|
| `dev` | Development (Railway) | Active development — push freely and often |
| `main` | Production (Railway) | Stable releases only — never push directly |

All three Railway services (API, worker, web) must point to the same branch. Verify this in Railway's service settings whenever a new service is created.

### Day-to-day development
- Work on `dev` (or feature branches merged into `dev`)
- Push to `dev` as frequently as needed — this is the live dev environment
- Break things here, not in `main`

### Releasing to production
1. Test thoroughly on `dev`
2. Open a **pull request** from `dev` → `main` on GitHub
3. Review the diff — use this as a final sanity check of everything going to prod
4. Merge the PR
5. Railway auto-deploys `main` to all production services

### Before going live with real clients
- [ ] Enable **branch protection on `main`** in GitHub (Settings → Branches) — require PRs, block direct pushes
- [ ] Confirm all Railway production services are pointing to `main`
- [ ] Consider adding a basic CI check (e.g. typecheck) to run on PRs before merge

---

## 2. Hosting — Railway

> **Decision:** Dorada will be hosted on [Railway](https://railway.app). Railway is a modern PaaS that deploys directly from a GitHub repository with managed PostgreSQL and Redis add-ons — no infrastructure configuration required. See [§9](#9-alternative-hosting-options) for GCP and self-hosted VPS alternatives if requirements change.

#### Architecture on Railway

```
GitHub repo (auto-deploy on push to main)
    │
    ├── API service        (apps/api/Dockerfile)
    ├── Web service        (apps/web/Dockerfile)
    ├── Report Worker      (apps/api/Dockerfile — different start command)
    ├── PostgreSQL plugin  (managed by Railway, DATABASE_URL injected automatically)
    └── Redis plugin       (managed by Railway, REDIS_URL injected automatically)
```

#### Setup Steps

1. Create a Railway account at [railway.app](https://railway.app).
2. Create a new project and connect your GitHub repository.
3. Add a **PostgreSQL** plugin — Railway injects `DATABASE_URL` automatically.
4. Add a **Redis** plugin — Railway injects `REDIS_URL` automatically.
5. Create an **API service**, set root directory to `/`, Dockerfile path to `apps/api/Dockerfile`, start command:
   ```
   npx prisma migrate deploy && node dist/main.js
   ```
6. Create a **Web service**, set root directory to `/`, Dockerfile path to `apps/web/Dockerfile`.
7. Create a **Report Worker service**, set root directory to `/`, Dockerfile path to `apps/api/Dockerfile`, start command:
   ```
   node dist/workers/reports-worker.js
   ```
   > ⚠️ The report worker does **not** need a public port. It connects outbound to Redis and the database only. If this service is not running, report generation will silently hang.
8. Set all environment variables (see §5) in each service's settings panel. The worker needs the same vars as the API.
9. Add custom domains (e.g. `api.dorada.com`, `app.dorada.com`) in Railway's domain settings.
10. The mobile app API URL is managed in `apps/mobile/app.config.js` — set `APP_ENV=production` in the `production` build profile (already configured in `eas.json`).

#### Why Railway
- Deploys in under an hour from a fresh account
- Automatic TLS certificates on all services
- GitHub push-to-deploy with built-in deploy previews
- Logs, metrics, and resource usage visible per-service in the dashboard
- Managed PostgreSQL with automatic daily backups and point-in-time restore
- Scales vertically with one click; horizontal scaling available on higher plans

---

## 3. Required Third-Party Services

The following services need accounts created and API keys configured before going live. Items marked **Already integrated** have existing code — they only need keys.

### Communications

| Service | Purpose | Status | Link |
|---|---|---|---|
| **Twilio** | SMS OTP for interpreter login, SMS follow-up prompts | Already integrated — needs keys | [twilio.com](https://www.twilio.com) |
| **Resend** | Transactional email (admin password resets, notifications) | Needs integration + API key | [resend.com](https://resend.com) |

### Push Notifications

| Service | Purpose | Status | Link |
|---|---|---|---|
| **Expo Push Notifications** | Interpreter mobile push notifications — Expo's proxy routes to FCM/APNs automatically. No Firebase project required. | Already integrated via `expo-notifications` SDK — free, no setup needed | [docs.expo.dev/push-notifications](https://docs.expo.dev/push-notifications/overview/) |
| **Expo EAS** | Mobile app local builds (APK/IPA/AAB) | EAS CLI installed, `eas.json` configured | [expo.dev](https://expo.dev) |

### File Storage

| Service | Purpose | Status | Link |
|---|---|---|---|
| **Cloudflare R2** | Appointment media, generated reports, email intake screenshots | Needs integration — replaces GCS | [cloudflare.com/r2](https://www.cloudflare.com/developer-platform/r2/) |

### AI / Automation

| Service | Purpose | Status | Link |
|---|---|---|---|
| **Anthropic (Claude API)** | Email intake parsing and appointment data extraction | Already integrated — needs API key | [anthropic.com](https://www.anthropic.com) |

### Infrastructure

| Service | Purpose | Link |
|---|---|---|
| **Railway** | PaaS hosting — selected platform | [railway.app](https://railway.app) |

### Domain & DNS

| Service | Purpose | Link |
|---|---|---|
| **Porkbun** | Domain registrar and DNS management for `dorada.app` | [porkbun.com](https://porkbun.com) |
| **Cloudflare** | CDN, DDoS protection, free TLS proxy (production) | [cloudflare.com](https://cloudflare.com) |
| **Let's Encrypt / Certbot** | Free TLS certificates (self-hosted only) | [letsencrypt.org](https://letsencrypt.org) |

### Monitoring & Error Tracking

| Service | Purpose | Link |
|---|---|---|
| **Sentry** | Server-side error tracking and performance monitoring | [sentry.io](https://sentry.io) |
| **UptimeRobot** | Uptime monitoring and alerting (free tier available) | [uptimerobot.com](https://uptimerobot.com) |

### App Stores (Mobile)

| Service | Purpose | Annual Cost | Link |
|---|---|---|---|
| **Apple Developer Program** | iOS App Store distribution | $99/yr | [developer.apple.com](https://developer.apple.com) |
| **Google Play Console** | Android Play Store distribution | $25 one-time | [play.google.com/console](https://play.google.com/console) |

---

## 4. Technical Migration Checklist

Work through this list in order. Each section builds on the previous.

### Phase 1 — Secrets & Configuration

- [ ] Generate a strong `JWT_SECRET` (minimum 32 chars): `openssl rand -hex 32`
- [ ] Create production `.env` file — **never commit to git**
- [ ] Add `.env.production` to `.gitignore`
- [ ] Rotate all secrets that currently use the dev placeholder values (`change-me-*`)
- [ ] Create a Twilio account, verify a sender number, fill `TWILIO_*` vars
- [ ] Create a Resend account at [resend.com](https://resend.com), add `dorada.app` as a sending domain, then add the SPF/DKIM/DMARC `TXT` records Resend provides into **Porkbun DNS** (porkbun.com → your domain → DNS records). Once verified, generate an API key and fill `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `APP_URL`
- [ ] Create a Cloudflare R2 bucket, generate an API token with read/write access, fill `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`
- [ ] Add Anthropic API key for email intake

### Phase 2 — Database

- [ ] Add the PostgreSQL plugin in Railway — `DATABASE_URL` is injected automatically
- [ ] Set `DATABASE_URL` in production environment
- [ ] Run `npx prisma migrate deploy` (applies all existing migrations — do **not** use `migrate dev` in production)
- [ ] Seed a first Super Admin user:
  ```bash
  # Run inside the API container or server
  node dist/scripts/seed-admin.js  # or via Prisma Studio / psql manually
  ```
- [ ] Enable automated daily backups with at least 7-day retention
- [ ] Confirm the database is **not** publicly accessible (firewall / VPC rules)

### Phase 3 — File Storage

- [ ] Create a Cloudflare R2 bucket in the Cloudflare dashboard (free tier: 10 GB storage, 1M reads/mo)
- [ ] Generate an R2 API token with `Object Read & Write` permissions
- [ ] Set all `R2_*` environment variables in Railway (see §5)
- [ ] Test a photo upload from the mobile app and confirm the file appears in R2
- [ ] Remove or restrict access to the local `uploads/` directory in production (dev fallback only)
- [ ] Optionally enable a custom domain on the R2 bucket (e.g. `media.dorada.app`) via Cloudflare DNS

### Phase 4 — API Deployment

- [ ] Build the Docker image from `apps/api/Dockerfile`
- [ ] Confirm the start command runs migrations before boot:
  ```
  npx prisma migrate deploy && node dist/main.js
  ```
- [ ] Set `NODE_ENV=production`
- [ ] Set `PORT` to the expected value for your hosting environment
- [ ] Confirm the `/api/v1/health` endpoint (or equivalent) returns 200
- [ ] Confirm Socket.io connects from the web client over WSS (WebSocket Secure)
- [ ] Point the Nginx `/uploads/` proxy to GCS if needed, or ensure the GCS `public_url` is absolute

### Phase 4b — Report Worker Deployment

> ⚠️ **Critical:** The report worker is a separate long-running process from the API. If it is not deployed, report generation will silently hang — jobs will be queued but never processed.

The report worker (`apps/api/src/workers/reports-worker.ts`) consumes the BullMQ `report-generation` queue and handles all PDF/CSV report generation. It must run as its own Railway service alongside the API.

#### On Railway
- Create a third Railway service in the same project, pointing to the same repository
- Use the same Dockerfile as the API (`apps/api/Dockerfile`) with start command:
  ```
  node dist/workers/reports-worker.js
  ```
- Share the same environment variables as the API service — it needs `DATABASE_URL`, `REDIS_URL`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` at minimum
- Disable the public networking port for this service — it only connects outbound to Redis and the database

#### Verification
- [ ] Worker service is running and connected to Redis
- [ ] Generate a test report from the admin portal and confirm it transitions from `pending` → `processing` → `completed`
- [ ] Confirm the download URL resolves and the file is present in GCS (or local temp dir in dev)

### Phase 5 — Web App Deployment

- [ ] Build the Docker image from `apps/web/Dockerfile`
- [ ] Confirm Nginx proxy config (`nginx.conf`) points `/api/` to the production API URL
- [ ] Confirm the web app loads and can log in
- [ ] Set `Content-Security-Policy`, `Strict-Transport-Security`, and other security headers in Nginx
- [ ] Verify gzip compression is enabled (already in `nginx.conf`)

### Phase 6 — Mobile App

#### Prerequisites (already configured on dev machine)
- EAS CLI v18+ installed globally (`npm install -g eas-cli` if setting up a new machine)
- Java 21 (Temurin) with `JAVA_HOME` set in `~/.zshrc`
- Android SDK at `~/Library/Android/sdk` with `ANDROID_HOME` set in `~/.zshrc`
- `app.config.js` dynamically sets `apiUrl` from `APP_ENV` — no manual URL editing needed
- `eas.json` has four profiles: `development`, `preview` (dev API), `preview:prod` (prod API), `production`

#### Building locally

Always open a new terminal tab first (so `.zshrc` is sourced), then:

```bash
cd apps/mobile

# Android APK for testing against dev API
eas build --platform android --profile preview --local

# Android APK for testing against prod API
eas build --platform android --profile preview:prod --local

# iOS build (requires Xcode on Mac)
eas build --platform ios --profile preview --local
```

#### Installing on a test device

**Android via USB:**
```bash
adb devices          # confirm device is listed
adb install build-*.apk
```
**Android via file transfer:** AirDrop / email / Google Drive the `.apk`. Device will prompt to allow unknown sources on first install.

**iOS:** Use TestFlight (internal) — build produces an IPA, submit via `eas submit --platform ios`, testers install via TestFlight app.

#### Production store submissions

**Android (Play Store)**
- [ ] Create Google Play Console account ($25 one-time) at play.google.com/console
- [ ] Create app listing with package name `com.dorada.app`
- [ ] Build: `eas build --platform android --profile production --local` (produces signed AAB)
- [ ] Submit via Play Console or `eas submit --platform android` to Internal Testing track
- [ ] Promote: Internal Testing → Closed Testing → Production

**iOS (App Store)**
- [ ] Enroll in Apple Developer Program ($99/yr) — start early, verification takes 1–5 days
- [ ] Register App ID `com.dorada.app` in the developer portal
- [ ] Create app listing in App Store Connect; fill in real Apple ID and ASC App ID in `eas.json` submit section
- [ ] Build: `eas build --platform ios --profile production --local`
- [ ] Submit via `eas submit --platform ios` → TestFlight review (fast) → App Store review (1–3 days)

#### Push notifications
Push notifications use **Expo's push proxy** (`expo-notifications` SDK). The app sends its Expo push token to the API on login. The API calls `https://exp.host/--/api/v2/push/send`. Expo handles routing to FCM (Android) and APNs (iOS) — no Firebase project or `google-services.json` is needed.

- [ ] Test push notifications end-to-end: offer creation → interpreter receives push → confirms → admin sees update

### Phase 7 — DNS & TLS

- [ ] **DNS is managed in Porkbun** (porkbun.com). Optionally delegate to Cloudflare for CDN/proxy: log in to Porkbun → update nameservers to Cloudflare's assigned nameservers → manage all DNS records in Cloudflare thereafter. If staying on Porkbun DNS, add CNAME records directly there.
- [ ] In Cloudflare DNS, add CNAME records for the Railway services:
  - `api.dorada.app` → Railway API service URL
  - `app.dorada.app` → Railway web service URL
  - `media.dorada.app` → R2 bucket public URL (optional custom domain for file storage)
- [ ] Add the custom domains in Railway's service settings — Railway will provision TLS automatically
- [ ] Verify `https://app.dorada.app` loads and `https://api.dorada.app/api/v1/health` returns 200

### Phase 8 — Monitoring

- [ ] Sign up for Sentry, create a project, add the Sentry DSN to the API environment
- [ ] Add Sentry to the web app (`@sentry/react`)
- [ ] Set up UptimeRobot (free) to ping the API health endpoint every 5 minutes and alert by email if it goes down
- [ ] Enable database query logging (short-lived, for QA only) to catch slow queries early

### Phase 9 — QA Handoff

- [ ] Create at least one Super Admin account manually in the production database
- [ ] Invite QA users via the Admin Users panel in the web app
- [ ] Distribute the mobile TestFlight / Play Store internal track link to interpreter QA testers
- [ ] Confirm the full workflow: appointment creation → offer → mobile confirm → clock in → clock out → follow-up → invoice

---

## 5. Environment Variables Reference

All of the following must be set in production. Dev placeholder values must be replaced.

```env
# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/dorada_prod

# Redis
REDIS_URL=redis://HOST:6379
REDIS_HOST=...
REDIS_PORT=6379

# JWT — generate with: openssl rand -hex 32
JWT_SECRET=<minimum 32 random characters>
JWT_ACCESS_TTL=2h
JWT_REFRESH_TTL_DAYS=30
ADMIN_REFRESH_TTL_HOURS=24
MFA_TOKEN_TTL=5m

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1xxxxxxxxxx

# Resend (transactional email — domain managed in Porkbun)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@dorada.app
RESEND_FROM_NAME=Dorada
APP_URL=https://app.dorada.app

# Push notifications are handled by Expo's push proxy (expo-notifications SDK).
# No Firebase / FCM service account required.

# Cloudflare R2
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET=dorada-media
R2_PUBLIC_URL=https://media.dorada.app

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6

# App
PORT=3000
NODE_ENV=production
LOG_LEVEL=warn
```

---

## 6. Mobile App — Build Profiles Reference

| Profile | Command | Output | API | Use for |
|---|---|---|---|---|
| `preview` | `eas build --platform android --profile preview --local` | APK | Dev Railway | Day-to-day Android testing |
| `preview` | `eas build --platform ios --profile preview --local` | IPA | Dev Railway | Day-to-day iOS testing |
| `preview:prod` | `eas build --platform android --profile preview:prod --local` | APK | Production | Smoke test against real data |
| `production` | `eas build --platform android --profile production --local` | AAB | Production | Play Store submission |
| `production` | `eas build --platform ios --profile production --local` | IPA | Production | App Store submission |

All builds run **locally** — no EAS cloud build minutes consumed. See Phase 6 in the checklist above for the full setup and store submission process.

---

## 7. Security Hardening Checklist

Before any real users access the system:

- [ ] **Rotate all secrets** — never use development keys in production
- [ ] **Database not publicly exposed** — only accessible from the API container/service
- [ ] **Redis not publicly exposed** — same as above
- [ ] **HTTPS enforced everywhere** — no HTTP allowed in production
- [ ] **JWT secrets are strong** — at minimum 256-bit entropy (`openssl rand -hex 32`)
- [ ] **GCS bucket is private** — files accessed via signed URLs or the API, not publicly readable
- [ ] **Rate limiting enabled** — confirm the API's rate limiter is active (`fastify-rate-limit`)
- [ ] **Nginx security headers** — `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` (already in `nginx.conf`)
- [ ] **`NODE_ENV=production`** — disables verbose error stack traces in API responses
- [ ] **No dev seeds in production** — do not run `prisma db seed` in production unless it creates only the required system records
- [ ] **MFA enforced for all admin users** — admin login already requires TOTP; confirm this cannot be bypassed
- [ ] **Uploads directory removed or restricted** — the local `uploads/` fallback should not be publicly accessible in production

---

## 8. Estimated Monthly Costs

Approximate costs at QA / early production scale (~10 concurrent admin users, ~50 interpreters).

### Railway (Infrastructure)

| Resource | Est. Cost/mo |
|---|---|
| API service (512 MB RAM) | $5–$10 |
| Web service (256 MB RAM) | $5 |
| Report Worker service (256 MB RAM) | $5 |
| PostgreSQL (1 GB storage) | $5 |
| Redis (512 MB) | $3 |
| **Total** | **~$23–$28/mo** |

### Third-Party Services

| Service | Free Tier | Paid Starts At |
|---|---|---|
| Twilio | $15 credit | Pay-as-you-go (~$0.0079/SMS) |
| Resend | 3,000 emails/mo free | $20/mo (50K emails) |
| Expo Push Notifications | Free | Free (no volume limits) |
| Cloudflare R2 | 10 GB free, 1M reads/mo free | ~$0.015/GB/mo (no egress fees) |
| Anthropic API | — | Pay-as-you-go (~$3/M tokens) |
| Sentry | 5K errors/mo free | $26/mo |
| UptimeRobot | 50 monitors free | Free for basic use |
| Apple Developer | — | $99/yr |
| Google Play Console | — | $25 one-time |

---

## 9. Alternative Hosting Options

These options are documented for reference if requirements change (e.g. compliance mandates on-premises data, or scale requires GCP).

### Google Cloud Platform

**Best for:** Production at scale, compliance-sensitive deployments, organizations already in the Google ecosystem.

```
Cloud DNS / Load Balancer
    │
    ├── Cloud Run (API) ─────────────────────── Cloud SQL (PostgreSQL 16)
    ├── Cloud Run (Web / Nginx)                 Memorystore (Redis)
    ├── Cloud Run (Report Worker)               Secret Manager (env vars)
    ├── Cloud Storage (GCS) ← file uploads
    └── Expo Push Proxy (push notifications — routes to FCM/APNs)
```

Key steps: Enable Cloud Run, Cloud SQL, Memorystore, GCS, Secret Manager, Artifact Registry, Cloud Build. Deploy API and worker as separate Cloud Run services with `MIN_INSTANCES=1` on the worker. Use Cloud Build to run `prisma migrate deploy` before each API deploy.

Est. cost: ~$65–$90/mo at QA scale.

---

### Self-Hosted VPS (Docker Compose)

**Best for:** Full data sovereignty, on-premises installations, HIPAA BAA scenarios, white-label clients.

```
VPS (Ubuntu 22.04) — Docker Compose
    ├── dorada-api      (port 3000, internal)
    ├── dorada-web      (port 80/443, Nginx + Certbot)
    ├── dorada-worker   (no port, internal only)
    ├── postgres         (port 5432, internal only)
    └── redis            (port 6379, internal only)
```

Suitable providers: Hetzner (most cost-effective), DigitalOcean, Vultr, Linode, or client hardware. Est. cost: ~$11–$16/mo on Hetzner.

---

*Last updated: May 2026*
