# Dorada — Project Memory for Claude

This file records decisions, conventions, and infrastructure facts that Claude should keep in mind across sessions.

---

## Infrastructure & Services

| Role | Service | Notes |
|---|---|---|
| **Hosting** | Railway | Two environments: `dev` branch → dev env, `main` branch → production |
| **Database** | PostgreSQL 16 (Railway plugin) | Managed by Prisma v5 |
| **Cache / Queue** | Redis 7 (Railway plugin) | BullMQ + Socket.io adapter |
| **File storage** | **Cloudflare R2** | S3-compatible; integration at `apps/api/src/integrations/r2.ts`. Env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` |
| **Transactional email** | **Resend** | `lib/email.ts` is the central helper — do NOT use SendGrid (removed) |
| **SMS** | Twilio | Interpreter login OTP + follow-up prompts |
| **Push notifications** | **Expo Push Notifications** | Uses `expo-notifications` SDK + Expo's push proxy. No Firebase project needed — Expo manages FCM/APNs routing. Do NOT use Firebase FCM directly. |
| **AI / extraction** | Anthropic Claude API | Email intake parsing |
| **Domain registrar** | **Porkbun** | Domain: `dorada.app` |
| **DNS management** | **Porkbun** | Nameservers currently managed in Porkbun (may be delegated to Cloudflare in production — see DEPLOYMENT.md §Phase 7) |
| **CDN / proxy** | Cloudflare | Planned for production; not yet active |

---

## Email

- **Provider:** Resend (resend.com)
- **Central helper:** `apps/api/src/lib/email.ts` — all email sending goes through `sendEmail()` here
- **From address:** `noreply@dorada.app`
- **Domain verification:** Done via Porkbun DNS — add Resend's SPF, DKIM, and DMARC `TXT` records in the Porkbun DNS management panel for `dorada.app`
- **SendGrid was removed** — do not re-introduce it

---

## Tech Stack

- **Monorepo tool:** pnpm workspaces (`pnpm-workspace.yaml`)
- **API:** Fastify + Prisma v5 (always use `npx prisma@5` commands)
- **Web:** React 19 + Vite + TailwindCSS + shadcn/ui + React Query v5 + React Router v6
- **Mobile:** Expo SDK 54 (React Native 0.81) — Expo Router, file-based tabs, interpreter-only app
- **i18n:** `packages/i18n` — keys in `en.json` and `es.json` must always be kept in sync
- **Types:** `packages/types` — must run `pnpm build --filter @dorada/types` after schema changes

---

## Key Conventions

- Zod schemas use `.nullish()` (not `.optional()`) for fields that can be `null` or `undefined`
- `toTzDateTimeInput()` / `fromTzDateTimeInput()` in `apps/web/src/lib/timezone.ts` for datetime-local input ↔ ISO conversion
- `pagination.total` (not `data.length`) for accurate counts when using `limit` query params
- Vite: font/asset paths in CSS must be relative (`./assets/font.ttf`), not absolute (`/font.ttf`)
- Git: two-branch model — `dev` for active work, `main` for production releases via PR

---

## Branching

| Branch | Environment |
|---|---|
| `dev` | Development (Railway dev services) |
| `main` | Production (Railway prod services) |

Never push directly to `main` — always open a PR from `dev`.

---

## Mobile App

### Overview

- **Location:** `apps/mobile`
- **Framework:** Expo SDK 54 / React Native 0.81
- **Router:** Expo Router (file-based, tab navigation)
- **Bundle ID / Package:** `com.dorada.app` (both iOS and Android)
- **EAS project:** `prana2026` / project ID `58b4f722-7db0-42da-a52c-539b63dd5184`
- **API URL config:** Managed in `apps/mobile/app.config.js` — reads `process.env.APP_ENV` to select the correct Railway URL. Never hardcode an IP or URL in `app.json`.

### API URLs per environment

| `APP_ENV` | API URL |
|---|---|
| `dev` | `https://api-dev-7dbe.up.railway.app/api/v1` |
| `production` | `https://api.dorada.app/api/v1` |

### Local build setup (Mac)

Prerequisites already installed on dev machine:
- **EAS CLI** v18.11.0 at `/usr/local/bin/eas`
- **Java 21** (Temurin) — `.zshrc` sets `JAVA_HOME` to Java 21 and adds it first to `PATH`
- **Android SDK** at `~/Library/Android/sdk` — `ANDROID_HOME` and `ANDROID_SDK_ROOT` set in `.zshrc`
- **adb** at `~/Library/Android/sdk/platform-tools/adb`

Always open a **new terminal tab** before building (so `.zshrc` is sourced and Java 21 / ANDROID_HOME are active).

### Build commands

```bash
cd apps/mobile

# Android APK → dev API (day-to-day testing)
eas build --platform android --profile preview --local

# Android APK → prod API (smoke test against real data)
eas build --platform android --profile preview:prod --local

# iOS → dev API (requires Xcode)
eas build --platform ios --profile preview --local

# Production AAB for Play Store
eas build --platform android --profile production --local

# Production IPA for App Store
eas build --platform ios --profile production --local
```

### Build profiles (`eas.json`)

| Profile | Platform output | API target | Use for |
|---|---|---|---|
| `preview` | APK (Android) / IPA (iOS) | Dev Railway | Day-to-day testing |
| `preview:prod` | APK (Android) / IPA (iOS) | Production | Smoke testing against real data |
| `production` | AAB (Android) / IPA (iOS) | Production | Store submissions |

### Installing a local APK on an Android device

**Option A — USB (fastest)**
```bash
adb devices                    # confirm device is listed
adb install build-*.apk
```
Requires: Settings → Developer Options → USB Debugging ON on the device.

**Option B — File transfer**
AirDrop, email, or upload to Google Drive. On the device: open the file, allow "Install from unknown sources" when prompted.

### Push notifications

Uses **Expo Push Notifications** (`expo-notifications` SDK). The app registers for a push token on login and sends it to the API. The API sends notifications via Expo's push proxy (`https://exp.host/--/api/v2/push/send`), which routes to FCM (Android) or APNs (iOS) without requiring a Firebase project to be managed directly.

- Do NOT set up Firebase FCM directly
- Do NOT add `google-services.json` to the repo
- Expo's push service is free with no volume limits

### Store deployment (when ready)

**Android (Play Store)**
1. Create Google Play Console account ($25 one-time) at play.google.com/console
2. Create app listing with package `com.dorada.app`
3. Build: `eas build --platform android --profile production --local`
4. Submit AAB manually via Play Console or `eas submit --platform android`
5. Release to Internal Testing → Closed Testing → Production

**iOS (App Store)**
1. Enroll in Apple Developer Program ($99/yr) at developer.apple.com — start early, verification takes 1–5 days
2. Register App ID `com.dorada.app` in the developer portal
3. Create app listing in App Store Connect
4. Build: `eas build --platform ios --profile production --local`
5. Submit via `eas submit --platform ios` → TestFlight first, then App Store review
6. Fill in real Apple ID and ASC App ID in `eas.json` submit section (currently has placeholders)
