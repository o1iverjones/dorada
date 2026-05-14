# Pulpito — Production Deployment Guide

> **Purpose:** This document outlines everything required to move Pulpito from a local development environment to a hosted, production-ready environment for QA and beyond. It covers hosting options, required third-party services, and a step-by-step technical migration checklist.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Hosting Options](#2-hosting-options)
   - [Option A — Railway (Cloud, Recommended for QA)](#option-a--railway-cloud-recommended-for-qa)
   - [Option B — Google Cloud Platform (Cloud, Recommended for Scale)](#option-b--google-cloud-platform-cloud-recommended-for-scale)
   - [Option C — Self-Hosted VPS with Docker Compose](#option-c--self-hosted-vps-with-docker-compose)
3. [Required Third-Party Services](#3-required-third-party-services)
4. [Technical Migration Checklist](#4-technical-migration-checklist)
5. [Environment Variables Reference](#5-environment-variables-reference)
6. [Mobile App Publishing](#6-mobile-app-publishing)
7. [Security Hardening Checklist](#7-security-hardening-checklist)
8. [Estimated Monthly Costs](#8-estimated-monthly-costs)

---

## 1. Platform Overview

Pulpito is a multi-tenant medical interpretation management platform. The production environment must run the following components:

| Component | Technology | Notes |
|---|---|---|
| **API server** | Fastify (Node.js 20, TypeScript) | Compiled to `dist/`, served with `node dist/main.js`. Dockerfile exists at `apps/api/Dockerfile`. |
| **Web admin** | React + Vite, served via Nginx | Static build proxied through Nginx. Dockerfile exists at `apps/web/Dockerfile`. |
| **Mobile app** | Expo (React Native) | Published separately via Expo EAS. Connects to the API over HTTPS. |
| **Database** | PostgreSQL 16 | Managed by Prisma. Schema migrations must run on every deploy. |
| **Cache / queue** | Redis 7 | Used for session management and Socket.io adapter. |
| **File storage** | Google Cloud Storage | Local `uploads/` folder is a dev-only fallback; GCS is the production target. |
| **Real-time** | Socket.io | Admin web messaging. Requires sticky sessions or Redis adapter if horizontally scaled. |

---

## 2. Hosting Options

### Option A — Railway (Cloud, Recommended for QA)

**Best for:** Fast QA setup, small teams, early users. Minimal DevOps overhead.

**What it is:** Railway is a modern PaaS (Platform-as-a-Service) that deploys directly from a GitHub repository. It natively supports Node.js services, PostgreSQL, and Redis as managed add-ons — no infrastructure configuration required.

#### Architecture on Railway

```
GitHub repo
    │
    ├── API service (Dockerfile → apps/api/Dockerfile)
    ├── Web service (Dockerfile → apps/web/Dockerfile)
    ├── PostgreSQL plugin (managed by Railway)
    └── Redis plugin (managed by Railway)
```

#### Steps

1. Create a Railway account at [railway.app](https://railway.app).
2. Create a new project and connect your GitHub repository.
3. Add a **PostgreSQL** plugin — Railway injects `DATABASE_URL` automatically.
4. Add a **Redis** plugin — Railway injects `REDIS_URL` automatically.
5. Create an **API service**, set root directory to `/`, and set the Dockerfile path to `apps/api/Dockerfile`.
6. Create a **Web service**, set root directory to `/`, and set the Dockerfile path to `apps/web/Dockerfile`.
7. Set all environment variables (see §5) in each service's settings panel.
8. Add a custom domain (e.g. `api.pulpito.com`, `app.pulpito.com`) in Railway's domain settings.
9. Run Prisma migrations on first deploy via a Railway start command override:
   ```
   npx prisma migrate deploy && node dist/main.js
   ```
10. Point the mobile app's `apiUrl` in `app.json` to the new HTTPS API URL.

#### Pros
- Deploys in under an hour
- Automatic TLS certificates
- Built-in deploy previews
- Logs and metrics included
- Scales vertically with one click

#### Cons
- More expensive than VPS at scale
- Less control than GCP
- Not suitable for clients requiring on-premises data

---

### Option B — Google Cloud Platform (Cloud, Recommended for Scale)

**Best for:** Production at scale, compliance-sensitive deployments, organizations already in the Google ecosystem.

#### Architecture on GCP

```
Cloud DNS / Load Balancer
    │
    ├── Cloud Run (API) ─────────────────────── Cloud SQL (PostgreSQL 16)
    ├── Cloud Run (Web / Nginx)                 Memorystore (Redis)
    ├── Cloud Storage (GCS) ← file uploads      Secret Manager (env vars)
    └── Firebase (FCM push notifications)
```

#### Steps

1. Create a GCP project at [console.cloud.google.com](https://console.cloud.google.com).
2. Enable the following APIs: Cloud Run, Cloud SQL, Memorystore, Cloud Storage, Secret Manager, Artifact Registry, Cloud Build.
3. **Database:** Create a Cloud SQL instance (PostgreSQL 16). Note the connection string and store it in Secret Manager.
4. **Redis:** Create a Memorystore for Redis (Basic tier is sufficient for QA).
5. **File storage:** Create a GCS bucket named `pulpito-media`. Set the bucket to private; generate a service account key with `Storage Object Admin` role.
6. **Container registry:** Push Docker images to Artifact Registry:
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT/pulpito-api ./apps/api
   gcloud builds submit --tag gcr.io/YOUR_PROJECT/pulpito-web ./apps/web
   ```
7. **Cloud Run — API:** Deploy the API image, attach the Cloud SQL connector, and inject secrets from Secret Manager.
8. **Cloud Run — Web:** Deploy the Nginx web image. Set the `VITE_API_URL` build arg or configure the Nginx proxy to forward `/api/` to the API Cloud Run URL.
9. **Migrations:** Add a Cloud Build step or Cloud Run Job that runs `npx prisma migrate deploy` before the API starts.
10. **DNS:** Map `api.pulpito.com` and `app.pulpito.com` via Cloud DNS or your existing DNS registrar.
11. **Load balancer:** Set up a GCP HTTPS Load Balancer with managed SSL certificates for both services.

#### Pros
- GCS is already wired into the codebase — zero additional integration work for file storage
- Firebase (FCM) is already used for push notifications
- Scales horizontally and globally
- Strong compliance tooling (VPC, IAM, audit logs, CMEK)
- Cloud SQL point-in-time recovery for the database

#### Cons
- Higher setup complexity
- GCP has a steeper learning curve
- More expensive than Railway for low-traffic QA

---

### Option C — Self-Hosted VPS with Docker Compose

**Best for:** Clients requiring full data sovereignty, on-premises installations, HIPAA BAA scenarios, or air-gapped environments.

**What it is:** A single Linux VPS (or on-premises server) running all services via Docker Compose. This is also how you would package Pulpito for a white-label client who wants to run their own instance.

#### Minimum Server Specs (QA / Small Production)

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Storage | 40 GB SSD | 100 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

**Suitable VPS providers:** DigitalOcean, Hetzner (most cost-effective), Vultr, Linode, or a client's own hardware.

#### Architecture on a VPS

```
VPS (Ubuntu 22.04)
└── Docker Compose
    ├── pulpito-api    (port 3000, internal)
    ├── pulpito-web    (port 80/443, public via Nginx + Certbot)
    ├── postgres       (port 5432, internal only)
    └── redis          (port 6379, internal only)
```

#### Steps

1. **Provision the server.** Create a VPS with your chosen provider, assign a static IP.
2. **Point DNS.** Create `A` records for `api.yourdomain.com` and `app.yourdomain.com` pointing to the server IP.
3. **Install Docker and Docker Compose:**
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   ```
4. **Clone the repository** onto the server (or use a deployment pipeline such as GitHub Actions with SSH).
5. **Create a production `docker-compose.prod.yml`** that adds the web and API services to the existing `docker-compose.yml`:
   ```yaml
   services:
     pulpito-api:
       build:
         context: .
         dockerfile: apps/api/Dockerfile
       env_file: .env.production
       depends_on: [postgres, redis]
       restart: unless-stopped

     pulpito-web:
       build:
         context: .
         dockerfile: apps/web/Dockerfile
       ports:
         - "80:80"
         - "443:443"
       depends_on: [pulpito-api]
       restart: unless-stopped
   ```
6. **Install Certbot** for free TLS certificates via Let's Encrypt:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d app.yourdomain.com -d api.yourdomain.com
   ```
7. **Create `.env.production`** with all production secrets (see §5). Never commit this file.
8. **Run migrations and start services:**
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   docker exec pulpito-api npx prisma migrate deploy
   ```
9. **Set up automated backups** for the PostgreSQL volume:
   ```bash
   # Example: daily pg_dump to S3-compatible storage
   docker exec postgres pg_dump -U pulpito pulpito_prod | gzip > backup_$(date +%F).sql.gz
   ```
10. **For file storage:** Either mount a local volume (simplest, data stays on server) or configure GCS credentials. For full data sovereignty, use [MinIO](https://min.io/) — an S3-compatible object store that runs locally in Docker.

#### Pros
- Full data sovereignty — all data stays on client infrastructure
- No ongoing cloud provider costs beyond the VPS fee
- Suitable for HIPAA, SOC 2, or other compliance frameworks requiring on-premises data
- Portable — can be packaged as a white-label installer
- Hetzner VPS from ~$5–$20/month

#### Cons
- Requires manual SSL renewal (mitigated by Certbot auto-renewal)
- No automatic horizontal scaling
- Client or implementation partner responsible for uptime and patching
- File storage is local by default (no built-in geo-redundancy without MinIO + replication)

---

## 3. Required Third-Party Services

The following services need accounts created and API keys configured before going live. Items marked **Already integrated** have existing code — they only need keys.

### Communications

| Service | Purpose | Status | Link |
|---|---|---|---|
| **Twilio** | SMS OTP for interpreter login, SMS follow-up prompts | Already integrated — needs keys | [twilio.com](https://www.twilio.com) |
| **SendGrid** | Transactional email (admin password resets, notifications) | Already integrated — needs keys | [sendgrid.com](https://sendgrid.com) |

### Push Notifications

| Service | Purpose | Status | Link |
|---|---|---|---|
| **Firebase (FCM)** | Interpreter mobile push notifications | Already integrated — needs service account JSON | [console.firebase.google.com](https://console.firebase.google.com) |
| **Expo EAS** | Mobile app build and OTA update delivery | Needed for mobile publish | [expo.dev](https://expo.dev) |

### File Storage

| Service | Purpose | Status | Link |
|---|---|---|---|
| **Google Cloud Storage** | Appointment media photos uploaded by interpreters | Already integrated — needs bucket + credentials | [cloud.google.com/storage](https://cloud.google.com/storage) |
| **MinIO** *(self-hosted only)* | S3-compatible local object store for on-premises deployments | Not yet integrated — drop-in replacement for GCS | [min.io](https://min.io) |

### AI / Automation

| Service | Purpose | Status | Link |
|---|---|---|---|
| **Anthropic (Claude API)** | Email intake parsing and appointment data extraction | Already integrated — needs API key | [anthropic.com](https://www.anthropic.com) |

### Infrastructure (Cloud options)

| Service | Purpose | Link |
|---|---|---|
| **Railway** | PaaS hosting (Option A) | [railway.app](https://railway.app) |
| **Google Cloud Platform** | Managed cloud hosting (Option B) | [cloud.google.com](https://cloud.google.com) |
| **Hetzner / DigitalOcean / Linode** | VPS for self-hosted option (Option C) | [hetzner.com](https://hetzner.com) |

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
- [ ] Create a SendGrid account, verify sender domain, fill `SENDGRID_*` vars
- [ ] Create a Firebase project, download service account JSON, fill `FIREBASE_SERVICE_ACCOUNT_JSON`
- [ ] Create a GCS bucket (`pulpito-media`), create a service account with `Storage Object Admin`, fill `GCS_BUCKET` / `GCP_PROJECT_ID` / `GOOGLE_APPLICATION_CREDENTIALS`
- [ ] Add Anthropic API key for email intake

### Phase 2 — Database

- [ ] Provision a managed PostgreSQL 16 instance (Railway plugin, Cloud SQL, or Docker on VPS)
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

- [ ] Verify GCS bucket exists and the service account key has write access
- [ ] Test a photo upload from the mobile app and confirm the file appears in GCS
- [ ] Remove or restrict access to the local `uploads/` directory in production (it is the dev fallback only)
- [ ] Set GCS bucket lifecycle rules to control storage costs (e.g. delete files older than 1 year, or move to Coldline storage)

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

- [ ] Register or transfer your domain to Cloudflare (recommended) or your existing registrar
- [ ] Create DNS `A` records:
  - `api.yourdomain.com` → API server IP / Railway URL
  - `app.yourdomain.com` → Web server IP / Railway URL
- [ ] Enable HTTPS / TLS (automatic on Railway and GCP; use Certbot on VPS)
- [ ] Verify that `http://` redirects to `https://` for both subdomains

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
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/pulpito_prod

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

# SendGrid
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=no-reply@yourdomain.com
SENDGRID_FROM_NAME=Pulpito

# Firebase FCM
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# Google Cloud Storage
GCS_BUCKET=pulpito-media
GCP_PROJECT_ID=your-gcp-project
GOOGLE_APPLICATION_CREDENTIALS=/app/gcs-key.json

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

### Option A — Railway

| Resource | Est. Cost/mo |
|---|---|
| API service (512 MB RAM) | $5–$10 |
| Web service (256 MB RAM) | $5 |
| PostgreSQL (1 GB storage) | $5 |
| Redis (512 MB) | $3 |
| **Total** | **~$18–$23/mo** |

### Option B — Google Cloud Platform

| Resource | Est. Cost/mo |
|---|---|
| Cloud Run — API (1 vCPU, 512 MB) | $10–$20 |
| Cloud Run — Web | $5–$10 |
| Cloud SQL (db-f1-micro, 10 GB) | $15–$25 |
| Memorystore Redis (1 GB) | $35 |
| Cloud Storage (10 GB) | ~$0.23 |
| **Total** | **~$65–$90/mo** |

> GCP costs reduce significantly with committed-use discounts or when moving to a custom instance size.

### Option C — Self-Hosted VPS (Hetzner)

| Resource | Est. Cost/mo |
|---|---|
| Hetzner CX31 (2 vCPU, 8 GB RAM, 80 GB SSD) | ~$8–$12 |
| Domain name | ~$1–$2 |
| Backups (Hetzner snapshot) | ~$2 |
| **Total** | **~$11–$16/mo** |

> Client-hosted deployments may use their existing server infrastructure at no additional cloud cost.

### Third-Party Services (All Options)

| Service | Free Tier | Paid Starts At |
|---|---|---|
| Twilio | $15 credit | Pay-as-you-go (~$0.0079/SMS) |
| SendGrid | 100 emails/day free | $19.95/mo (Essentials) |
| Firebase FCM | Free | Free (up to very high volume) |
| Anthropic API | — | Pay-as-you-go (~$3/M tokens) |
| Sentry | 5K errors/mo free | $26/mo |
| UptimeRobot | 50 monitors free | Free for basic use |
| Apple Developer | — | $99/yr |
| Google Play Console | — | $25 one-time |

---

*Last updated: May 2026*
