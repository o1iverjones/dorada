# Dorada — Production Deployment Guide

> **Purpose:** This document outlines everything required to move Dorada from a local development environment to a hosted, production-ready environment for QA and beyond. It covers hosting options, required third-party services, and a step-by-step technical migration checklist.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Hosting — Railway](#2-hosting--railway)
3. [Required Third-Party Services](#3-required-third-party-services)
4. [Technical Migration Checklist](#4-technical-migration-checklist)
5. [Environment Variables Reference](#5-environment-variables-reference)
6. [Mobile App Publishing](#6-mobile-app-publishing)
7. [Security Hardening Checklist](#7-security-hardening-checklist)
8. [Estimated Monthly Costs](#8-estimated-monthly-costs)
9. [Alternative Hosting Options](#9-alternative-hosting-options)

---

## 1. Platform Overview

Dorada is a multi-tenant medical interpretation management platform. The production environment must run the following components:

| Component | Technology | Notes |
|---|---|---|
| **API server** | Fastify (Node.js 20, TypeScript) | Compiled to `dist/`, served with `node dist/main.js`. Dockerfile exists at `apps/api/Dockerfile`. |
| **Web admin** | React + Vite, served via Nginx | Static build proxied through Nginx. Dockerfile exists at `apps/web/Dockerfile`. |
| **Mobile app** | Expo (React Native) | Published separately via Expo EAS. Connects to the API over HTTPS. |
| **Database** | PostgreSQL 16 | Managed by Prisma. Schema migrations must run on every deploy. |
| **Cache / queue** | Redis 7 | Used for session management and Socket.io adapter. |
| **File storage** | Cloudflare R2 | S3-compatible object storage. Local `uploads/` folder is a dev-only fallback; R2 is the production target. |
| **Real-time** | Socket.io | Admin web messaging. Requires sticky sessions or Redis adapter if horizontally scaled. |
| **Report worker** | Node.js / BullMQ | Separate long-running process (`workers/reports-worker.ts`). Must be deployed as its own service — API and worker are independent processes. |

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
10. Point the mobile app's `EXPO_PUBLIC_API_URL` in `eas.json` to the production HTTPS API URL.

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
| **Firebase (FCM)** | Interpreter mobile push notifications | Already integrated — needs service account JSON | [console.firebase.google.com](https://console.firebase.google.com) |
| **Expo EAS** | Mobile app build and OTA update delivery | Needed for mobile publish | [expo.dev](https://expo.dev) |

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

### Domain & Security

| Service | Purpose | Link |
|---|---|---|
| **Cloudflare** | DNS, CDN, DDoS protection, free TLS proxy | [cloudflare.com](https://cloudflare.com) |
| **Let's Encrypt / Certbot** | Free TLS certificates (self-hosted) | [letsencrypt.org](https://letsencrypt.org) |

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
- [ ] Create a Resend account at [resend.com](https://resend.com), verify your sending domain, generate an API key, fill `RESEND_API_KEY` and `RESEND_FROM_EMAIL`
- [ ] Create a Firebase project, download service account JSON, fill `FIREBASE_SERVICE_ACCOUNT_JSON`
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

- [ ] Update `apiUrl` in `apps/mobile/app.json` to the production API URL (HTTPS)
- [ ] Install Expo EAS CLI: `npm install -g eas-cli`
- [ ] Log in: `eas login`
- [ ] Configure `eas.json` with build profiles for `preview` (QA) and `production`
- [ ] Build for both platforms:
  ```bash
  eas build --platform all --profile preview
  ```
- [ ] Distribute the QA build via **TestFlight** (iOS) and **Google Play internal track** (Android)
- [ ] Enroll in the Apple Developer Program (`$99/yr`) and create a Google Play Console account (`$25 one-time`) if not already done
- [ ] Test push notifications end-to-end: offer creation → interpreter receives push → confirms → admin sees update

### Phase 7 — DNS & TLS

- [ ] Point `dorada.app` nameservers to Cloudflare (log in to Porkbun → update nameservers to Cloudflare's)
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

# Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=no-reply@yourdomain.com
RESEND_FROM_NAME=Dorada

# Firebase FCM
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

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

## 6. Mobile App Publishing

The mobile app (`apps/mobile`) is built with **Expo SDK** and distributed via **Expo EAS Build**.

### Setup

```bash
# Install EAS CLI
npm install -g eas-cli

# Authenticate
eas login

# Initialize EAS in the mobile app directory
cd apps/mobile
eas init
```

### `eas.json` configuration

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.yourdomain.com/api/v1"
      }
    },
    "production": {
      "distribution": "store",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.yourdomain.com/api/v1"
      }
    }
  }
}
```

### QA Distribution

| Platform | Method | Notes |
|---|---|---|
| iOS | TestFlight | Requires Apple Developer account. Up to 10,000 external testers. |
| Android | Play Store Internal Track | Requires Google Play Console. Up to 100 internal testers. |
| Both | Expo Go / EAS Update | OTA updates for JS-only changes without a new App Store submission. |

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
| Firebase FCM | Free | Free (up to very high volume) |
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
    └── Firebase (FCM push notifications)
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
