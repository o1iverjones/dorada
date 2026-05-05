# Pulpito — Technical Architecture
*Interpreter Appointment Scheduling System*

---

## 0. Guiding Principles

- **TypeScript end-to-end** — shared types across backend, web app, and (where possible) mobile app reduce errors and speed up development
- **Multi-tenant SaaS** — all data is tenant-scoped; a single deployment serves multiple organizations with strict data isolation
- **GCP-native** — leverage managed GCP services wherever possible to reduce operational overhead
- **Localization-first** — i18n and RTL support are architectural requirements, not afterthoughts
- **REST API** — clean, versioned HTTP API consumed by both the web app and mobile app
- **Security by default** — HIPAA-adjacent data (patient MRNs, medical appointments); encryption at rest and in transit, role-based access enforced at the API layer

---

## 1. High-Level System Overview

```
┌─────────────────────┐     ┌─────────────────────┐
│   Web App (Admin)   │     │   Mobile App        │
│   React + Vite      │     │   React Native      │
│   (Browser)         │     │   (iOS + Android)   │
└────────┬────────────┘     └──────────┬──────────┘
         │  HTTPS / REST API           │  HTTPS / REST API
         └──────────────┬──────────────┘
                        │
               ┌────────▼────────┐
               │   API Server    │
               │   Node.js +     │
               │   TypeScript    │
               │   (Express /    │
               │    Fastify)     │
               └────────┬────────┘
          ┌─────────────┼─────────────┐
          │             │             │
   ┌──────▼──────┐ ┌────▼────┐ ┌─────▼──────┐
   │  PostgreSQL  │ │  Redis  │ │  GCP       │
   │  (Primary   │ │ (Cache  │ │  Services  │
   │  Database)  │ │  + Jobs)│ │            │
   └─────────────┘ └─────────┘ └────────────┘
```

---

## 2. Technology Stack

### 2.1 Backend
| Concern | Choice | Rationale |
|---|---|---|
| Runtime | Node.js (LTS) | Matches TypeScript preference; large ecosystem |
| Language | TypeScript | Type safety; shared types with frontend |
| Framework | Fastify | High performance; excellent TypeScript support; schema validation built-in |
| ORM | Prisma | First-class TypeScript support; clean migrations; works well with PostgreSQL |
| Database | PostgreSQL (Cloud SQL on GCP) | Relational model suits appointment/billing data; strong JSON support; GCP-managed |
| Cache / Queue | Redis (Memorystore on GCP) | Session caching, job queues for notifications and report generation |
| Background Jobs | BullMQ (on Redis) | Notification scheduling, report generation, appointment reminders |
| File Storage | Google Cloud Storage | Profile pictures, generated PDF reports, CSV exports |
| Authentication | Custom JWT + refresh tokens | SMS OTP for interpreters (via Twilio); email/password + TOTP 2FA for admins |
| SMS | Twilio | OTP delivery and push SMS fallback |
| Push Notifications | Firebase Cloud Messaging (FCM) | Cross-platform push for iOS and Android |
| Email | SendGrid | Admin password reset, system alerts |
| PDF Generation | Puppeteer or pdfmake | Server-side localized report rendering |

### 2.2 Web App (Admin Portal)
| Concern | Choice | Rationale |
|---|---|---|
| Framework | React + Vite | Fast builds; huge ecosystem; strong TypeScript support |
| Language | TypeScript | Consistent with backend |
| UI Components | shadcn/ui + Tailwind CSS | Accessible, unstyled primitives; easy to theme and localize |
| Calendar | FullCalendar | Feature-rich; supports custom events, filtering, and RTL |
| State Management | Zustand or TanStack Query | TanStack Query for server state; Zustand for local UI state |
| i18n | react-i18next | Industry standard; supports RTL, pluralization, interpolation |
| Forms | React Hook Form + Zod | Type-safe validation; matches backend Zod schemas |
| Routing | React Router v6 | Standard; nested route support for admin portal structure |
| Hosting | GCP Cloud Run or Firebase Hosting | Serverless; scales to zero; GCP-native |

### 2.3 Mobile App (Interpreter App)
| Concern | Choice | Rationale |
|---|---|---|
| Framework | React Native (Expo) | Single codebase for iOS + Android; TypeScript; large community; Expo simplifies builds and OTA updates |
| Language | TypeScript | Consistent across the stack |
| Navigation | React Navigation | Standard for React Native |
| State / Data | TanStack Query | Consistent with web app; handles caching and background sync |
| i18n | react-i18next | Same library as web app; shared locale files possible |
| Push Notifications | Expo Notifications (FCM + APNs) | Handles both platforms via single API |
| Maps / Distance | Haversine formula (no external API) | Straight-line distance calculation; no Google Maps API needed |
| Offline support | TanStack Query cache + AsyncStorage | Basic offline read for upcoming appointments |
| OTA Updates | Expo EAS Update | Push JS updates without app store review |

### 2.4 Infrastructure & DevOps
| Concern | Choice |
|---|---|
| Cloud Provider | Google Cloud Platform (GCP) |
| Container Runtime | Cloud Run (serverless containers) |
| Database | Cloud SQL (PostgreSQL) |
| Cache / Queue | Memorystore (Redis) |
| File Storage | Google Cloud Storage |
| CI/CD | GitHub Actions |
| Container Registry | Google Artifact Registry |
| Secrets Management | GCP Secret Manager |
| Monitoring & Logging | Google Cloud Logging + Cloud Monitoring |
| Error Tracking | Sentry |
| Domain & SSL | GCP Load Balancer + managed SSL certificates |

---

## 3. Multi-Tenancy Design

Each organization (tenant) using Pulpito gets full data isolation. The recommended approach is **row-level tenancy** — all database tables include an `organization_id` column and all queries are scoped to it at the API layer.

- Every API request is authenticated and the resolved `organization_id` is injected into all database queries via a middleware layer
- No cross-tenant data leakage is possible without bypassing the middleware
- A separate `organizations` table holds tenant configuration (name, locale, active languages, billing plan, etc.)
- Future: schema-per-tenant can be adopted if stricter isolation is required

### Tenant Onboarding
- New organizations are provisioned via an internal super-admin tool (not exposed to regular customers)
- Provisioning creates: organization record, default Super Admin user, default system settings (pay rates, languages, appointment types)

---

## 4. Authentication & Authorization

### 4.1 Interpreter Authentication (Mobile App)
1. Interpreter enters phone number
2. API sends OTP via Twilio SMS
3. Interpreter submits OTP → API issues short-lived JWT + refresh token
4. Refresh token rotated on each use; stored securely in device keychain

### 4.2 Admin Authentication (Web App)
1. Admin enters email + password (bcrypt hashed)
2. On success, prompted for TOTP code (Google Authenticator / Authy)
3. API issues short-lived JWT + refresh token on valid TOTP
4. Sessions expire after inactivity; refresh tokens are rotated

### 4.3 Role-Based Access Control (RBAC)
- Each admin user has an assigned role
- Roles contain a set of permission flags (one per permission category)
- Permissions are checked at the API route level via middleware — not just in the UI
- Super Admin role is hardcoded; cannot be modified or deleted
- Permission categories:
  - `manage_interpreters`
  - `manage_clinics`
  - `manage_admin_users`
  - `view_reports`
  - `manage_appointments`
  - `manage_system_settings`

---

## 5. API Design

- **Style:** REST, versioned under `/api/v1/`
- **Format:** JSON request and response bodies
- **Auth:** Bearer token (JWT) in `Authorization` header on all protected routes
- **Tenant scoping:** Resolved from JWT; never passed as a query parameter
- **Validation:** Zod schemas on all request bodies; errors returned as structured JSON
- **Pagination:** Cursor-based pagination for list endpoints
- **Filtering:** Query parameters on list endpoints (e.g. `?status=confirmed&interpreter_id=...`)

### Key Resource Groups
```
/api/v1/auth/...              → OTP, login, refresh, logout
/api/v1/appointments/...      → CRUD, offers, confirmations, clock-in/out, follow-up flow
/api/v1/interpreters/...      → CRUD, availability, notes
/api/v1/clinics/...           → CRUD, billing config
/api/v1/insurance-agencies/...→ CRUD
/api/v1/patients/...          → CRUD
/api/v1/admin-users/...       → CRUD, roles, notification preferences
/api/v1/roles/...             → CRUD, permissions
/api/v1/reports/...           → Generate R1–R4, download PDF/CSV
/api/v1/messages/...          → Interpreter ↔ admin messaging
/api/v1/settings/...          → System settings, pay rates, languages, appointment types, follow-up config
/api/v1/localization/...      → Locale string management
```

---

## 6. Real-Time & Notifications

### 6.1 Appointment Offer Flow
- When admin offers an appointment to multiple interpreters, the API creates an `offer` record per interpreter
- A BullMQ job is enqueued to send push notifications to all offered interpreters simultaneously via FCM
- When an interpreter confirms, the API atomically assigns the appointment and marks all other offers as expired
- A notification is sent to the other interpreters that the appointment is no longer available

### 6.2 Appointment Reminders
- BullMQ scheduled jobs fire at: T-24 hours and T-30 minutes before each appointment
- Jobs query confirmed appointments in the window and send FCM push notifications
- Notification text is localized to the interpreter's device locale

### 6.3 Admin Alerts
- Unconfirmed offers: a BullMQ delayed job is created when an offer is sent; if no confirmation arrives within a configurable window, the job fires and sends an in-app alert + email to the admin
- Delivered via server-sent events (SSE) or polling for in-app alerts on the web dashboard

### 6.4 Automated Follow-Up Confirmation Flow
- On clock-out, the API enqueues a BullMQ job immediately
- The job sends a follow-up prompt to the interpreter via FCM push (default) or Twilio SMS (if set in interpreter preferences)
- If the interpreter does not respond within the configured window (system setting), a reminder job is enqueued; the number of reminders before marking "no response" is also a system setting
- When the interpreter submits a positive response, the API:
  1. Creates a `follow_up_responses` record with the interpreter's free-text datetime, same-physician/clinic flags, notes, and any media attachments (stored in GCS)
  2. Creates a draft appointment record pre-filled with all available data (patient, clinic if same, physician if same, language, interpreter type), status `pending_review`
  3. Notifies admin according to their personal notification preference: immediate FCM push, immediate email via SendGrid, digest email (BullMQ scheduled job per configured digest times), or no notification (queue only)
- Media files attached to follow-up responses are stored in a dedicated GCS path (`pulpito/follow-ups/:appointment_id/`) and served via signed URLs

### 6.5 Automated Email Intake Agent
This is the most architecturally complex background workflow in Pulpito. It combines email polling, LLM-based extraction, database matching, draft creation, and external confirmation actions into a single agentic pipeline.

**Email polling:**
- A BullMQ repeatable job polls each tenant's dedicated inbox at a configurable interval (default: 5 minutes; set in super-admin panel)
- Inbox is hosted on a custom domain (e.g. `acme@appointments.pulpito.com`) via a transactional email provider with IMAP access (e.g. Postmark Inbound, SendGrid Inbound Parse, or self-hosted via Dovecot)
- Each new unprocessed email is retrieved, stored in GCS (`pulpito/email-intake/:tenant_id/:email_id/`), and enqueued as an individual extraction job

**AI extraction (Claude API):**
- Each email is passed to Claude (claude-sonnet) with a structured extraction prompt
- Claude returns a JSON object with extracted fields: patient name, PO number, date/time, doctor name, clinic name, language(s), and detected confirmation method (`reply_email` or `confirmation_link`)
- Confidence scores are returned per field; fields below threshold are flagged as unresolved
- The prompt version and model used are logged per email for auditability and rollback

**Matching and record creation:**
- Extracted names are fuzzy-matched against existing tenant records using pg_trgm (PostgreSQL trigram matching)
- Confident matches are linked; no-match cases trigger automatic record creation flagged as `ai_generated`
- PO number uniqueness is checked before draft creation; duplicates are flagged and skipped

**Draft creation:**
- A draft appointment is created with status `pending_email_review`
- The original email (full content + headers) and the Claude extraction JSON are both stored and linked to the draft
- Unresolved fields are stored separately so the admin review UI can highlight them

**Automated confirmation:**
- *Reply email*: SendGrid sends a reply using the per-agency template with variable substitution
- *Confirmation link*: a headless browser job (Playwright) follows the link, locates and clicks the confirmation button, and captures a screenshot stored in GCS as an audit artifact
- All confirmation actions are logged with timestamps and outcome (success / failure)
- On failure: error detail is logged, admin alerted via their notification preference, draft remains for manual follow-up

**Technology additions for this feature:**
| Concern | Choice |
|---|---|
| Inbound email | Postmark Inbound or SendGrid Inbound Parse → GCS |
| LLM extraction | Claude API (claude-sonnet) via Anthropic SDK |
| Fuzzy matching | PostgreSQL `pg_trgm` extension |
| Web confirmation | Playwright (headless Chromium) running in a Cloud Run job |
| Screenshot storage | Google Cloud Storage (signed URLs for admin review) |

---

## 7. Database Schema (Key Tables)

> Full schema to be defined during implementation — key entities listed here

```
organizations             → tenant root; holds config, locale, plan, dedicated inbox address
users                     → admins (tenant-scoped)
user_preferences          → per-admin notification preferences (follow-up alerts, digest times)
roles                     → custom roles per tenant
role_permissions          → permission flags per role
interpreters              → interpreter profiles (tenant-scoped)
interpreter_availability  → unavailability blocks
interpreter_preferences   → per-interpreter preferences (notification channel: push vs SMS)
clinics                   → clinic profiles (tenant-scoped)
insurance_agencies        → agency profiles + email config (sender domains, reply template, confirmation method override)
patients                  → patient records (tenant-scoped)
appointment_types         → types with pay model + minimum hours (tenant-scoped)
appointments              → core appointment records (tenant-scoped)
appointment_offers        → offer records linking appointment ↔ interpreter
follow_up_responses       → interpreter follow-up responses linked to appointments
follow_up_media           → media files attached to follow-up responses (GCS URLs)
follow_up_drafts          → draft appointments created from follow-up responses, pending admin review
email_intake_logs         → raw inbound emails per tenant (GCS path, processed status, timestamps)
email_intake_extractions  → Claude extraction output per email (fields, confidence scores, model/prompt version)
email_intake_drafts       → draft appointments created from email intake, with unresolved field flags
email_confirmation_logs   → outcome of reply/link confirmation actions per email (success, failure, screenshot GCS path)
messages                  → interpreter ↔ admin messages (tenant-scoped)
languages                 → supported language list (tenant-scoped)
locale_strings            → i18n string overrides per tenant per locale
system_settings           → default pay rates, follow-up reminder config, and other global config (tenant-scoped)
super_admin_settings      → platform-wide config: email polling interval, LLM model version, etc.
```

---

## 8. Localization Architecture

- Base locale files (`en.json`, `es.json`) are bundled with both the web app and mobile app
- Tenants can override individual strings via the admin localization manager — overrides stored in `locale_strings` table and served via API at app load
- Date/time formatting uses the `Intl` browser/Node API — locale-aware with no extra library needed
- RTL support: React Native and React both support RTL layout direction; direction is set at the app root based on active locale (`i18next` language → RTL detection)
- All locale files follow the same key structure across web and mobile; shared keys can be maintained in a monorepo

---

## 9. Monorepo Structure (Recommended)

```
pulpito/
├── apps/
│   ├── api/          → Fastify REST API (Node.js + TypeScript)
│   ├── web/          → React admin portal (Vite + TypeScript)
│   └── mobile/       → React Native interpreter app (Expo + TypeScript)
├── packages/
│   ├── types/        → Shared TypeScript types and Zod schemas
│   ├── i18n/         → Shared locale files (en.json, es.json, etc.)
│   └── utils/        → Shared utility functions (haversine, date formatting, etc.)
├── infrastructure/   → GCP Terraform / deployment configs
└── .github/
    └── workflows/    → CI/CD pipelines (GitHub Actions)
```

---

## 10. Open Questions / To Be Defined

- Detailed database schema (column-level) — to be done during implementation
- Insurance Agency entity fields — carried over from feature outline
- Data retention and deletion policy (HIPAA considerations)
- Backup and disaster recovery strategy for Cloud SQL
- Rate limiting and abuse prevention strategy for the API
- Whether tenant locale string overrides are fetched at boot or on demand
- Staging / production environment separation strategy
