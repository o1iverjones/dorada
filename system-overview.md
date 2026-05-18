# Dorada — System Overview

Dorada is a medical interpretation management platform for scheduling and coordinating professional language interpreters at clinical appointments. It is a multi-tenant SaaS product with a web administration portal, a mobile app for interpreters, and a REST API backend.

---

## Table of Contents

1. [Monorepo Structure](#monorepo-structure)
2. [Technology Stack](#technology-stack)
3. [Database Models](#database-models)
4. [API Backend](#api-backend)
5. [Web Admin Portal — Pages](#web-admin-portal--pages)
6. [Web Admin Portal — Shared Components & Widgets](#web-admin-portal--shared-components--widgets)
7. [Web Admin Portal — Hooks & State](#web-admin-portal--hooks--state)
8. [Mobile App — Screens](#mobile-app--screens)
9. [Shared Packages](#shared-packages)
10. [Auth & Security](#auth--security)
11. [Real-time & Background Jobs](#real-time--background-jobs)

---

## Monorepo Structure

```
Dev/
├── apps/
│   ├── api/          # Fastify REST API + Prisma ORM
│   ├── web/          # React SPA (admin portal)
│   └── mobile/       # React Native / Expo (interpreter app)
├── packages/
│   ├── types/        # Shared Zod schemas and TypeScript types
│   └── i18n/         # Shared translation files (en, es)
```

---

## Technology Stack

### API (`apps/api`)
| Layer | Technology |
|---|---|
| Runtime | Node.js (ESM) |
| Framework | Fastify |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT (access + refresh tokens), TOTP 2FA |
| Background jobs | BullMQ + Redis |
| File uploads | Local filesystem (`/uploads`) via `@fastify/multipart` |
| Real-time | Socket.io |

### Web Admin Portal (`apps/web`)
| Layer | Technology |
|---|---|
| Framework | React 18 |
| Routing | React Router v6 |
| Data fetching | TanStack Query (React Query) v5 |
| Forms | React Hook Form + Zod |
| State | Zustand |
| Internationalization | react-i18next |
| Icons | lucide-react |
| UI primitives | shadcn/ui (Radix UI + Tailwind CSS) |
| Real-time | socket.io-client |

### Mobile App (`apps/mobile`)
| Layer | Technology |
|---|---|
| Framework | React Native + Expo |
| Router | Expo Router (file-based) |
| Auth | JWT stored in AsyncStorage |
| Styling | React Native StyleSheet (custom theme in `src/theme.ts`) |
| Notifications | Local badge on tab bar via polling |

---

## Database Models

The following Prisma models make up the data layer:

| Model | Purpose |
|---|---|
| `Organization` | Top-level tenant; all data is scoped to an org |
| `User` (Admin User) | Admin portal users with role-based permissions |
| `Role` / `RolePermission` | RBAC — named roles with permission flag arrays |
| `UserPreferences` | Per-user MFA secret, preferences |
| `RefreshToken` | Persisted refresh token store for rotation |
| `Interpreter` | Language interpreter profile including pay rate, languages, photo |
| `AvailabilityBlock` | Interpreter's declared available time windows |
| `Clinic` | Medical clinic entity with billing config and contact info |
| `ClinicInterpreterBlock` | Blocked interpreter-clinic pairings |
| `InsuranceAgency` | Insurance company entity with email/confirmation settings |
| `Patient` | Patient profile (name, DOB, MRN, preferred language) |
| `AppointmentType` | Configurable categories of appointment (e.g. "Medical Eval") |
| `Appointment` | Core scheduling record linking patient, clinic, agency, interpreter |
| `AppointmentActivity` | Immutable per-appointment event log |
| `ActivityLog` | Org-wide audit log across all entity types |
| `AppointmentNote` | Free-text admin notes on an appointment |
| `AppointmentOffer` | Offer records sent to interpreters for a given appointment |
| `FollowUpDraft` / `FollowUpResponse` / `FollowUpMedia` | Auto-generated post-appointment follow-up drafts |
| `EmailIntakeLog` | Raw inbound emails received for processing |
| `EmailIntakeExtraction` | AI-extracted fields from email body |
| `EmailIntakeDraft` | Draft appointment created from email, pending admin review |
| `ReportJob` | Async report generation job with status, file URL, filters |
| `Message` | Chat messages between admin and interpreter |
| `OrganizationLanguage` | Languages available within an org |
| `LocaleString` | Overridable UI string translations per org |
| `SystemSettings` | Org-level configuration (timezone, pay rates, reminders) |
| `InterpreterRate` | Custom rate tiers for billing/compensation |

---

## API Backend

All routes are mounted under `/api/v1`. Authentication is enforced per-route via Fastify `preHandler` hooks.

### Auth (`/api/v1/auth`)
| Method | Path | Description |
|---|---|---|
| POST | `/auth/admin/login` | Email + password login; returns MFA token or access/refresh tokens |
| POST | `/auth/admin/mfa` | Submit TOTP code; returns access/refresh tokens |
| POST | `/auth/admin/mfa-setup` | Generate TOTP secret and QR code URI |
| POST | `/auth/admin/mfa-confirm` | Confirm and activate 2FA |
| POST | `/auth/refresh` | Exchange refresh token for new access token |
| POST | `/auth/interpreter/login` | Phone + PIN login for mobile app |

### Appointments (`/api/v1/appointments`)
| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/appointments` | manage_appointments | List with filters (status, date range, interpreter, clinic, patient) |
| POST | `/appointments` | manage_appointments | Create appointment |
| GET | `/appointments/:id` | manage_appointments | Get single appointment with relations |
| PATCH | `/appointments/:id` | manage_appointments | Update appointment fields |
| POST | `/appointments/:id/cancel` | manage_appointments | Cancel appointment |
| POST | `/appointments/:id/offers` | manage_appointments | Send offer to one or more interpreters |
| GET | `/appointments/:id/activity` | manage_appointments | Per-appointment activity log |
| GET | `/appointments/:id/admin-notes` | manage_appointments | Admin notes list |
| POST | `/appointments/:id/admin-notes` | manage_appointments | Add admin note |
| GET | `/appointments/activity` | manage_appointments | Org-wide activity log (from `ActivityLog` table) |
| GET | `/appointments/follow-up-drafts` | manage_appointments | List follow-up drafts |
| PATCH | `/appointments/follow-up-drafts/:id` | manage_appointments | Approve or dismiss a follow-up draft |
| POST | `/appointments/:id/clock-in` | interpreter | Interpreter clock-in (mobile) |
| POST | `/appointments/:id/patient-arrived` | manage_appointments | Mark patient as arrived |
| GET | `/appointments/me/appointments` | interpreter | Interpreter's own appointment list (mobile) |

### Interpreters (`/api/v1/interpreters`)
| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/interpreters` | manage_interpreters | List all interpreters for org |
| POST | `/interpreters` | manage_interpreters | Create interpreter |
| GET | `/interpreters/:id` | manage_interpreters | Get interpreter profile |
| PATCH | `/interpreters/:id` | manage_interpreters | Update interpreter fields |
| DELETE | `/interpreters/:id` | manage_interpreters | Deactivate interpreter |
| POST | `/interpreters/:id/photo` | manage_interpreters | Upload profile photo (multipart) |
| GET | `/interpreters/availability-blocks` | manage_interpreters | All availability blocks (with date/interpreter filters) |
| GET | `/interpreters/me` | interpreter | Interpreter's own profile (mobile) |
| PATCH | `/interpreters/me` | interpreter | Update own profile (mobile) |
| GET | `/interpreters/me/availability` | interpreter | Own availability blocks |
| POST | `/interpreters/me/availability` | interpreter | Add availability block |
| DELETE | `/interpreters/me/availability/:block_id` | interpreter | Remove availability block |

### Clinics (`/api/v1/clinics`)
| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/clinics` | manage_clinics | List clinics |
| POST | `/clinics` | manage_clinics | Create clinic |
| GET | `/clinics/:id` | manage_clinics | Get clinic detail |
| PATCH | `/clinics/:id` | manage_clinics | Update clinic |
| DELETE | `/clinics/:id` | manage_clinics | Deactivate clinic |

### Insurance Agencies (`/api/v1/insurance-agencies`)
| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/insurance-agencies` | manage_clinics | List agencies |
| POST | `/insurance-agencies` | manage_clinics | Create agency |
| GET | `/insurance-agencies/:id` | manage_clinics | Get agency detail |
| PATCH | `/insurance-agencies/:id` | manage_clinics | Update agency |
| DELETE | `/insurance-agencies/:id` | manage_clinics | Deactivate agency |

### Patients (`/api/v1/patients`)
| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/patients` | manage_appointments | List patients (search, pagination) |
| POST | `/patients` | manage_appointments | Create patient |
| GET | `/patients/:id` | manage_appointments | Get patient detail |
| PATCH | `/patients/:id` | manage_appointments | Update patient |

### Admin Users & Roles (`/api/v1`)
| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/admin-users` | authenticated | List org's admin users |
| POST | `/admin-users` | manage_admin_users | Create admin user |
| PATCH | `/admin-users/:id` | manage_admin_users | Update admin user |
| GET | `/roles` | authenticated | List org's roles |
| POST | `/roles` | manage_admin_users | Create role with permissions |

### Reports (`/api/v1/reports`)
| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/reports` | view_reports | List generated reports |
| POST | `/reports` | view_reports | Queue report generation job |
| GET | `/reports/:job_id` | view_reports | Poll job status / get download URL |

### Messages (`/api/v1/messages`)
| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/messages/conversations` | authenticated | List all conversations |
| GET | `/messages/conversations/:interpreterId` | authenticated | Get message thread |
| POST | `/messages/conversations/:interpreterId` | authenticated | Send message |
| POST | `/messages/conversations/:interpreterId/read` | authenticated | Mark messages as read |

### Email Intake (`/api/v1/email-intake`)
| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/email-intake/logs` | manage_appointments | Inbound email log list |
| GET | `/email-intake/drafts` | manage_appointments | Draft appointments from emails |
| PATCH | `/email-intake/drafts/:id` | manage_appointments | Approve or dismiss draft |
| POST | `/email-intake/logs/:id/retry-confirmation` | manage_appointments | Retry sending confirmation |

### Settings (`/api/v1/settings`)
| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/settings` | manage_system_settings | Get org system settings |
| PATCH | `/settings` | manage_system_settings | Update org system settings |
| GET/PATCH | `/settings/languages` | manage_system_settings | Manage available languages |
| GET/POST | `/settings/appointment-types` | manage_system_settings | Appointment type config |
| GET/POST/DELETE | `/settings/interpreter-rates` | manage_system_settings | Custom rate tiers |
| GET | `/settings/locale-strings` | manage_system_settings | Overridable UI string translations |

### Import (`/api/v1/import`)
| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/import/interpreters` | manage_interpreters | Bulk import interpreters from CSV |
| POST | `/import/clinics` | manage_clinics | Bulk import clinics from CSV |
| POST | `/import/agencies` | manage_clinics | Bulk import insurance agencies from CSV |

---

## Web Admin Portal — Pages

All pages are located under `apps/web/src/pages/`. The app requires authentication (JWT stored in localStorage) and most routes additionally require specific permissions enforced by `PermissionGuard`.

---

### Login Page
**File:** `pages/auth/LoginPage.tsx`  
**Route:** `/login` (public)

Allows admins to log in with email and password. Redirects to `/mfa` if the account has 2FA enabled, otherwise issues tokens and redirects to `/dashboard`.

**Features:**
- Email + password form with validation
- Password visibility toggle
- "Remember Me" checkbox — persists email to `localStorage` (`dorada_remembered_email`) for pre-fill on next visit (password is never stored)
- Auto-fills remembered email on mount via `useEffect`

**API Calls:**
- `POST /auth/admin/login`

**Dependencies:** react-hook-form, zod, react-i18next, useAuthStore (Zustand)

---

### MFA Page
**File:** `pages/auth/MfaPage.tsx`  
**Route:** `/mfa`

Accepts a 6-digit TOTP code after initial login when 2FA is active.

**API Calls:**
- `POST /auth/admin/mfa`

**Dependencies:** react-hook-form, useAuthStore

---

### MFA Setup Page
**File:** `pages/auth/MfaSetupPage.tsx`  
**Route:** `/mfa-setup`

Walks an admin through enabling 2FA — shows a QR code and confirms a TOTP code to activate.

**API Calls:**
- `POST /auth/admin/mfa-setup`
- `POST /auth/admin/mfa-confirm`

---

### Dashboard Page
**File:** `pages/dashboard/DashboardPage.tsx`  
**Route:** `/dashboard`

The home screen shown after login. Gives a real-time overview of the day's activity.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| Live Clock | Displays current time and date in the org's configured timezone. Updates every 30 seconds. |
| Stat Cards (×4) | Today's appointments, Pending offers, Follow-up drafts, Email intake drafts. Each is a clickable link to the relevant list page. |
| Today's Schedule | Scrollable list of today's appointments showing patient name, time range, clinic, agency, interpreter, and status badges for clock-in and patient arrival. |
| Activity Log | Chronological org-wide feed of all admin actions (creates, updates, deactivations, report runs). Renders clickable entity links. Sourced from the `ActivityLog` table. |
| Email Intake Queue | Preview of pending email drafts awaiting review, showing extracted patient name and PO number. |

**API Calls:**
- `GET /appointments?date_from={today}&date_to={today}&limit=20`
- `GET /appointments?status=pending_offer&limit=5`
- `GET /appointments/follow-up-drafts?status=pending_review&limit=5`
- `GET /email-intake/drafts?status=pending_review&limit=5`
- `GET /appointments/activity?limit=50`

**Dependencies:** TanStack Query, react-i18next, lucide-react, useAuthStore, useOrgTimezone, formatInTz

---

### Calendar Page
**File:** `pages/appointments/CalendarPage.tsx`  
**Route:** `/calendar`  
**Permission:** `manage_appointments`

Month and week calendar view of all appointments. Appointments are displayed as colored blocks on the grid and can be clicked to navigate to the detail page.

**API Calls:**
- `GET /appointments` (filtered by visible date range)

**Dependencies:** TanStack Query, react-i18next, lucide-react

---

### Appointments List Page
**File:** `pages/appointments/AppointmentsPage.tsx`  
**Route:** `/appointments`  
**Permission:** `manage_appointments`

Filterable, paginated table of all appointments.

**Filters:** Status, date range, interpreter, clinic, patient

**Cards & Widgets:**

| Widget | Description |
|---|---|
| Filter Bar | Dropdowns and date pickers for narrowing the list |
| DataTable | Columns: date/time, patient, interpreter, clinic, agency, status, duration |
| StatusBadge | Colored badge per appointment status |

**API Calls:**
- `GET /appointments` (with status, date_from, date_to, interpreter_id, clinic_id, patient_id params)

**Dependencies:** TanStack Query, DataTable, StatusBadge, react-i18next

---

### New Appointment Page
**File:** `pages/appointments/NewAppointmentPage.tsx`  
**Route:** `/appointments/new`  
**Permission:** `manage_appointments`

Form for creating a new appointment. Supports autocomplete for patient, clinic, agency, and interpreter fields.

**API Calls:**
- `POST /appointments`
- `GET /clinics` (for dropdown)
- `GET /insurance-agencies` (for dropdown)
- `GET /interpreters` (for dropdown)
- `GET /patients` (for autocomplete)

**Dependencies:** react-hook-form, zod, AutocompleteInput, TanStack Query

---

### Appointment Detail Page
**File:** `pages/appointments/AppointmentDetailPage.tsx`  
**Route:** `/appointments/:id`  
**Permission:** `manage_appointments`

Full view of a single appointment with all related data, actions, and history.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| Appointment Info Card | Date/time, duration, type, language, status, patient, clinic, agency, interpreter |
| Status Action Buttons | Context-sensitive actions: Cancel, Mark Patient Arrived, Send Offer, etc. |
| Admin Notes | List of timestamped admin notes with an add-note form |
| Activity Timeline | Per-appointment event log from `AppointmentActivity` |
| Interpreter Offer Panel | Shows which interpreters were offered and their accept/decline status |
| Follow-up Draft Card | If a follow-up draft exists, shows extracted data and review controls |

**API Calls:**
- `GET /appointments/:id`
- `GET /appointments/:id/activity`
- `GET /appointments/:id/admin-notes`
- `POST /appointments/:id/admin-notes`
- `POST /appointments/:id/cancel`
- `POST /appointments/:id/offers`
- `POST /appointments/:id/patient-arrived`
- `PATCH /appointments/:id`

**Dependencies:** TanStack Query, react-hook-form, StatusBadge, lucide-react

---

### Edit Appointment Page
**File:** `pages/appointments/EditAppointmentPage.tsx`  
**Route:** `/appointments/:id/edit`  
**Permission:** `manage_appointments`

Full edit form for an existing appointment. Pre-fills all fields from the existing record.

**API Calls:**
- `GET /appointments/:id`
- `PATCH /appointments/:id`
- `GET /clinics`, `GET /insurance-agencies`, `GET /interpreters`, `GET /patients`

**Dependencies:** react-hook-form, zod, AutocompleteInput, TanStack Query

---

### Follow-Up Drafts Page
**File:** `pages/appointments/FollowUpDraftsPage.tsx`  
**Route:** `/appointments/follow-up-drafts`  
**Permission:** `manage_appointments`

Queue of auto-generated follow-up draft records awaiting admin review. Each draft is created after an interpreter submits a follow-up response.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| Draft Card | Shows patient, appointment, interpreter, extracted notes, and media attachments |
| Approve / Dismiss Controls | Inline action buttons to resolve each draft |

**API Calls:**
- `GET /appointments/follow-up-drafts?status=pending_review`
- `PATCH /appointments/follow-up-drafts/:id`

**Dependencies:** TanStack Query, StatusBadge, react-i18next

---

### Interpreters List Page
**File:** `pages/interpreters/InterpretersPage.tsx`  
**Route:** `/interpreters`  
**Permission:** `manage_interpreters`

Table of all interpreters in the organization with search and filter controls.

**Filters:** Name search, type (certified/qualified), language, active/inactive

**API Calls:**
- `GET /interpreters`

**Dependencies:** TanStack Query, DataTable, StatusBadge

---

### New Interpreter Page
**File:** `pages/interpreters/NewInterpreterPage.tsx`  
**Route:** `/interpreters/new`  
**Permission:** `manage_interpreters`

Form to create a new interpreter profile.

**Fields:** Name, email, phone, type, languages spoken, pay rate, emergency contact, notes

**API Calls:**
- `POST /interpreters`

**Dependencies:** react-hook-form, zod, TanStack Query

---

### Interpreter Detail Page
**File:** `pages/interpreters/InterpreterDetailPage.tsx`  
**Route:** `/interpreters/:id`  
**Permission:** `manage_interpreters`

Full interpreter profile with inline editing and associated data.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| Profile Card | Photo, name, type, languages, contact info, pay rate. Inline edit mode. |
| InterpreterAvatar | Profile photo with optional upload button |
| Availability Blocks | List of declared availability windows with add/remove controls |
| Appointment History | Recent appointments for this interpreter |
| Deactivate Button | Soft-deletes the interpreter after confirmation |

**API Calls:**
- `GET /interpreters/:id`
- `PATCH /interpreters/:id`
- `DELETE /interpreters/:id`
- `POST /interpreters/:id/photo`
- `GET /appointments?interpreter_id=:id`

**Dependencies:** TanStack Query, react-hook-form, InterpreterAvatar

---

### Clinics List Page
**File:** `pages/clinics/ClinicsPage.tsx`  
**Route:** `/clinics`  
**Permission:** `manage_clinics`

Table of all clinics with an inline create form accessible via a button.

**API Calls:**
- `GET /clinics`
- `POST /clinics`

**Dependencies:** TanStack Query, DataTable

---

### Clinic Detail Page
**File:** `pages/clinics/ClinicDetailPage.tsx`  
**Route:** `/clinics/:id`  
**Permission:** `manage_clinics`

Full clinic record with inline editing.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| Info Card | Name, address, phone, primary contact name and email. Inline edit mode. |
| Billing Config Card | Billing type (hourly/flat), rate value |
| Parking / Notes Card | Free-text parking instructions and admin notes |
| Deactivate Button | Soft-deletes the clinic after confirmation |

**API Calls:**
- `GET /clinics/:id`
- `PATCH /clinics/:id`
- `DELETE /clinics/:id`

**Dependencies:** TanStack Query, react-hook-form

---

### Insurance Agencies List Page
**File:** `pages/insurance-agencies/InsuranceAgenciesPage.tsx`  
**Route:** `/insurance-agencies`  
**Permission:** `manage_clinics`

Table of all insurance agencies.

**API Calls:**
- `GET /insurance-agencies`
- `POST /insurance-agencies`

**Dependencies:** TanStack Query, DataTable

---

### Insurance Agency Detail Page
**File:** `pages/insurance-agencies/InsuranceAgencyDetailPage.tsx`  
**Route:** `/insurance-agencies/:id`  
**Permission:** `manage_clinics`

Full insurance agency record with inline editing.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| Info Card | Name, phone, email, address. Inline edit mode. |
| Email Configuration Card | Reply-to address, sender domain, confirmation method override, custom reply template |
| Deactivate Button | Soft-deletes the agency |

**API Calls:**
- `GET /insurance-agencies/:id`
- `PATCH /insurance-agencies/:id`
- `DELETE /insurance-agencies/:id`

**Dependencies:** TanStack Query, react-hook-form

---

### Patients List Page
**File:** `pages/patients/PatientsPage.tsx`  
**Route:** `/patients`  
**Permission:** `manage_appointments`

Searchable, paginated table of all patient records. Includes an inline create form.

**API Calls:**
- `GET /patients?search={q}&page={n}&limit={n}`
- `POST /patients`

**Dependencies:** TanStack Query, DataTable

---

### Patient Detail Page
**File:** `pages/patients/PatientDetailPage.tsx`  
**Route:** `/patients/:id`  
**Permission:** `manage_appointments`

Full patient record with inline editing and appointment history.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| Info Card | Name, DOB, MRN, phone, email, preferred language. Inline edit mode. |
| Appointment History | Table of all appointments for this patient |

**API Calls:**
- `GET /patients/:id`
- `PATCH /patients/:id`
- `GET /appointments?patient_id=:id`

**Dependencies:** TanStack Query, react-hook-form, DataTable

---

### Reports Page
**File:** `pages/reports/ReportsPage.tsx`  
**Route:** `/reports`  
**Permission:** `view_reports`

Report generation interface with job status tracking and download links.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| Generate Report Form | Report type selector, format (PDF/CSV), date range, and optional interpreter/agency filters |
| Job Status Card | Shows current job status (queued → processing → complete/failed) with polling every 3 seconds |
| Report History Table | List of previously generated reports with download links |

**Report Types:**
- R1: Interpreter Compensation
- R2: Insurance Agency Billing
- R3: Appointment History
- R4: Interpreter Performance

**API Calls:**
- `POST /reports` — queue a report job
- `GET /reports/:job_id` — poll job status (refetch every 3s until terminal state)
- `GET /reports` — report history

**Dependencies:** TanStack Query (with polling), react-hook-form, react-i18next

---

### Messages Page
**File:** `pages/messages/MessagesPage.tsx`  
**Route:** `/messages`

Two-pane messaging interface between admins and interpreters.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| Conversation List | Left panel listing all interpreter conversations sorted by most recent activity. A "Recent" section floats conversations with activity in the last 7 days. Shows unread dot and latest message preview. |
| Message Thread | Right panel with full chat history, timestamps, and a send input |
| Typing Indicator | Shows "…" when the remote party is typing (via Socket.io) |
| Unread Badge | Orange dot on conversation list entries and sidebar nav icon |

**API Calls:**
- `GET /messages/conversations` (refetch every 30s)
- `GET /messages/conversations/:interpreterId` (refetch every 8s)
- `POST /messages/conversations/:interpreterId`
- `POST /messages/conversations/:interpreterId/read`

**Real-time:** Socket.io connection in room `org:{organizationId}`. Events: `message`, `typing`.

**Dependencies:** socket.io-client, TanStack Query, useMessages hook, react-i18next

---

### Email Intake Page
**File:** `pages/email-intake/EmailIntakePage.tsx`  
**Route:** `/email-intake`  
**Permission:** `manage_appointments`

Log of all inbound emails received by the system with processing status.

**Filters:** Status (pending, processed, failed)

**API Calls:**
- `GET /email-intake/logs`
- `POST /email-intake/logs/:id/retry-confirmation`

**Dependencies:** TanStack Query, DataTable, StatusBadge

---

### Email Intake Drafts Page
**File:** `pages/email-intake/EmailIntakeDraftsPage.tsx`  
**Route:** `/email-intake/drafts`  
**Permission:** `manage_appointments`

Review queue for draft appointments auto-extracted from inbound emails.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| Draft Review Card | Shows extracted fields: patient name, PO number, date/time, clinic, doctor, languages. Highlights unresolved or conflicting fields. |
| Unresolved Fields Badge | Warning badge when extracted fields have conflicts or missing values |
| Duplicate PO Warning | Alert when the PO number matches an existing appointment |
| Approve / Dismiss Controls | Convert draft to live appointment or dismiss it |

**API Calls:**
- `GET /email-intake/drafts?status=pending_review`
- `PATCH /email-intake/drafts/:id`

**Dependencies:** TanStack Query, StatusBadge, react-i18next

---

### Admin Users Page
**File:** `pages/admin-users/AdminUsersPage.tsx`  
**Route:** `/admin-users`  
**Permission:** `manage_admin_users`

Manage admin portal users for the organization.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| Users Table | Name, email, role, 2FA status, active/inactive, last login |
| Create User Form | Dialog/inline form: name, email, password, role assignment |
| Edit User Controls | Inline role change, activate/deactivate toggle |

**API Calls:**
- `GET /admin-users`
- `POST /admin-users`
- `PATCH /admin-users/:id`
- `GET /roles`

**Dependencies:** TanStack Query, react-hook-form, DataTable

---

### Roles Page
**File:** `pages/admin-users/RolesPage.tsx`  
**Route:** `/admin-users/roles`  
**Permission:** `manage_admin_users`

Create and manage named roles with specific permission sets.

**Available Permissions:**
- `manage_appointments`
- `manage_interpreters`
- `manage_clinics`
- `manage_admin_users`
- `view_reports`
- `manage_system_settings`

**API Calls:**
- `GET /roles`
- `POST /roles`

**Dependencies:** TanStack Query, react-hook-form

---

### Settings Page
**File:** `pages/settings/SettingsPage.tsx`  
**Route:** `/settings`  
**Permission:** `manage_system_settings`

Organization-wide configuration.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| General Settings Card | Organization timezone selector, default pay rates (certified / qualified interpreters) |
| Follow-up Reminder Card | Reminder window (hours after appointment), maximum reminder count |
| Languages Card | Add/remove available language options for the org |
| Appointment Types Card | Create and manage appointment type categories with billable minute minimums |
| Interpreter Rates Card | Custom rate tiers (name, rate per minute/hour) for billing and compensation |

**API Calls:**
- `GET /settings`
- `PATCH /settings`
- `GET/PATCH /settings/languages`
- `GET/POST /settings/appointment-types`
- `GET/POST/DELETE /settings/interpreter-rates`

**Dependencies:** TanStack Query, react-hook-form, react-i18next

---

### Localization Page
**File:** `pages/settings/LocalizationPage.tsx`  
**Route:** `/settings/localization`  
**Permission:** `manage_system_settings`

Override UI string translations on a per-organization basis.

**API Calls:**
- `GET /settings/locale-strings`
- `PATCH /settings/locale-strings`

---

### Import Page
**File:** `pages/import/ImportPage.tsx`  
**Route:** `/import`  
**Permission:** `manage_interpreters`

Bulk CSV import tool for interpreters, clinics, and insurance agencies.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| File Upload Area | Drag-and-drop or browse CSV file selector per entity type |
| Import Preview | Parsed row preview before confirmation |
| Result Summary | Row success/failure count after import |

**API Calls:**
- `POST /import/interpreters`
- `POST /import/clinics`
- `POST /import/agencies`

**Dependencies:** TanStack Query, react-hook-form

---

### Account Page
**File:** `pages/account/AccountPage.tsx`  
**Route:** `/account`

Personal account settings for the currently logged-in admin user.

**Features:** Change name, change password, 2FA setup/disable

**API Calls:**
- `PATCH /admin-users/:id` (own account)
- `POST /auth/admin/mfa-setup`
- `POST /auth/admin/mfa-confirm`

---

## Web Admin Portal — Shared Components & Widgets

Located under `apps/web/src/components/`.

---

### Layout: AppLayout
**File:** `components/layout/AppLayout.tsx`

Root layout wrapper rendered for all authenticated pages. Composes `Sidebar`, `TopBar`, and a `<main>` content area. Not rendered on auth pages (`/login`, `/mfa`, `/mfa-setup`).

---

### Layout: Sidebar
**File:** `components/layout/Sidebar.tsx`

Left navigation rail visible on all authenticated pages.

**Features:**
- Dorada logo and wordmark at top
- Permission-filtered nav links (links not accessible to the current user's role are hidden entirely)
- Unread message dot indicator on the Messages nav item (sourced from `useUnreadMessageCount` hook, polling every 30s)
- Account link at bottom

**Nav Items:**
Dashboard, Calendar, Appointments, Interpreters, Clinics, Insurance Agencies, Patients, Reports, Messages, Email Intake, Admin Users, Settings, CSV Import

**Dependencies:** react-router-dom (NavLink), useAuthStore, useUnreadMessageCount, lucide-react

---

### Layout: TopBar
**File:** `components/layout/TopBar.tsx`

Horizontal bar at the top of the content area. Shows current page title and user info / logout button.

---

### Layout: AuthGuard
**File:** `components/layout/AuthGuard.tsx`

Route wrapper that redirects unauthenticated users to `/login`. Reads auth state from `useAuthStore`.

---

### Layout: PermissionGuard
**File:** `components/layout/PermissionGuard.tsx`

Route wrapper that checks if the logged-in user has a required permission. Renders a "Not authorized" message or redirects if the check fails.

**Props:** `permission: string`

---

### Shared: DataTable
**File:** `components/shared/DataTable.tsx`

Generic, reusable table component used across the majority of list pages.

**Props:**
- `columns` — column definitions (header label, accessor key or render function)
- `data` — array of row objects
- `onRowClick` — optional row click handler
- `isLoading` — shows skeleton rows
- `emptyMessage` — text shown when data is empty

**Used by:** AppointmentsPage, InterpretersPage, ClinicsPage, InsuranceAgenciesPage, PatientsPage, AdminUsersPage, EmailIntakePage, ReportsPage

---

### Shared: StatusBadge
**File:** `components/shared/StatusBadge.tsx`

Renders a colored `Badge` for any status string. Converts underscores to spaces for display.

**Status → Color mappings:**

| Status | Color |
|---|---|
| `confirmed` | Green (success) |
| `completed` | Gray (secondary) |
| `pending_offer` | Yellow (warning) |
| `in_progress` | Blue (default) |
| `cancelled` | Red (destructive) |
| `no_show` | Red (destructive) |
| `pending_review` | Yellow (warning) |
| `approved` | Green (success) |
| `failed` | Red (destructive) |
| `active` | Green (success) |
| `inactive` | Gray (secondary) |

**Used by:** AppointmentsPage, AppointmentDetailPage, EmailIntakePage, ReportsPage

---

### Shared: AutocompleteInput
**File:** `components/shared/AutocompleteInput.tsx`

Searchable dropdown that filters a provided options list as the user types. Supports both value-based (ID lookup) and free-text modes.

**Props:**
- `options: { value: string; label: string }[]`
- `value: string` — currently selected value
- `onChange: (value: string) => void`
- `placeholder?: string`
- `freeText?: boolean` — when true, stores the typed label directly rather than looking up an ID

**Used by:** NewAppointmentPage, EditAppointmentPage (patient, clinic, agency, interpreter, referring physician fields)

**Dependencies:** React state (open/close dropdown), outside-click detection via `useEffect`

---

### Shared: InterpreterAvatar
**File:** `components/shared/InterpreterAvatar.tsx`

Displays an interpreter's profile photo. Falls back to initials if no photo is set. Optionally shows an upload button for admin contexts.

**Props:**
- `interpreter: { name: string; profile_picture_url?: string | null }`
- `size?: "sm" | "md" | "lg"`
- `editable?: boolean`
- `onUpload?: (file: File) => void`

**Used by:** InterpreterDetailPage, appointment detail panels

---

### Shared: PageHeader
**File:** `components/shared/PageHeader.tsx`

Standard page heading layout with title, optional description, and an optional actions slot (e.g., a "New +" button).

**Props:**
- `title: string`
- `description?: string`
- `actions?: React.ReactNode`

**Used by:** Most list and detail pages

---

### Shared: LoadingSpinner
**File:** `components/shared/LoadingSpinner.tsx`

Centered animated spinner shown while data is loading.

**Used by:** DashboardPage, detail pages during initial fetch

---

### UI Primitives (`components/ui/`)

Thin wrappers around Radix UI / shadcn components. Not application-specific but used throughout:

| Component | Description |
|---|---|
| `Badge` | Pill-shaped status label with `variant` prop (default, success, warning, destructive, outline, secondary) |
| `Button` | Standard button with variant and size props |
| `Card` / `CardHeader` / `CardContent` / `CardTitle` | Container card with header and content sections |
| `Dialog` / `DialogContent` / `DialogHeader` | Modal dialog wrapper |
| `Input` | Styled text input |
| `Label` | Form field label |
| `Select` / `SelectTrigger` / `SelectContent` / `SelectItem` | Styled dropdown select |
| `Toast` / `Toaster` | Notification toast system (shown on mutation success/failure) |

---

## Web Admin Portal — Hooks & State

### Zustand Auth Store
**File:** `src/store/auth.ts`  
**Persistence:** `localStorage` key `dorada_auth`

| Field / Method | Description |
|---|---|
| `user` | Logged-in `AdminUser` object (id, name, email, permissions, org) |
| `mfaToken` | Temporary MFA token held between login and MFA confirmation |
| `setUser(user)` | Set authenticated user |
| `setMfaToken(token)` | Set MFA session token |
| `hasPermission(permission)` | Returns true if user's role includes the given permission |
| `logout()` | Clears state and localStorage tokens |

---

### TanStack Query Client
**File:** `src/lib/queryClient.ts`

Global query client. Query cache is invalidated on mutations. Refetch strategies per hook:

| Hook / Query | Refetch interval |
|---|---|
| Conversations list | 30 seconds |
| Message thread | 8 seconds |
| Report job status | 3 seconds (until terminal state) |
| All others | On mount + on window focus (default) |

---

### `useMessages`
**File:** `src/hooks/useMessages.ts`

Wraps all messaging API calls and Socket.io integration.

- `useConversations()` — list all interpreter conversations
- `useThread(interpreterId)` — single conversation thread
- `useSendMessage(interpreterId)` — mutation to send a message
- `useMarkRead(interpreterId)` — mutation to mark thread as read
- `useUnreadMessageCount()` — count of conversations with unread messages (used by Sidebar dot)

Socket.io events handled: `message` (new incoming message), `typing` (typing indicator)

---

### `useSettings` / `useOrgTimezone`
**File:** `src/hooks/useSettings.ts`

- `useSystemSettings()` — full org settings object
- `useOrgTimezone()` — extracts just the timezone string; used throughout for `formatInTz` calls
- `useLanguages()` — org's enabled languages
- `useAppointmentTypes()` — configured appointment types
- `useInterpreterRates()` — custom rate tiers

---

### API Client
**File:** `src/lib/api.ts`

Thin wrapper around `fetch`. Attaches `Authorization: Bearer {token}` to every request. On a 401 response, attempts one automatic token refresh via `POST /auth/refresh`. If refresh fails, calls `useAuthStore.logout()`.

Methods: `api.get<T>()`, `api.post<T>()`, `api.patch<T>()`, `api.put<T>()`, `api.delete<T>()`, `api.uploadFile<T>()`

---

### Timezone Utilities
**File:** `src/lib/timezone.ts`

- `formatInTz(date, options, tz)` — formats a date/time in the org's timezone using `Intl.DateTimeFormat`
- `fromTzDateTimeInput(localString, tz)` — converts a `datetime-local` input value (in org tz) to a UTC ISO string for the API
- `toTzDateTimeInput(isoString, tz)` — converts a UTC ISO string from the API to a `datetime-local` value for display in form inputs

---

## Mobile App — Screens

The mobile app is for interpreters only. It uses Expo Router with a tab-based navigation. All screens require interpreter-level JWT authentication. The color scheme mirrors the web portal (deep forest green `#0e402d` / lime accent `#9fcc2e`) defined in `src/theme.ts`.

### Login Screen
**File:** `app/login.tsx`  
**Route:** `/login`

Phone number + PIN login form. Displays the Dorada logo and wordmark.

**Features:**
- `+` country code prefix is optional — auto-normalized before submit
- Phone number persisted in `AsyncStorage` for pre-fill on next open ("remember phone")
- PIN input with numeric keyboard

**API Calls:**
- `POST /auth/interpreter/login`

---

### Appointments Tab
**File:** `app/(tabs)/appointments.tsx`  
**Route:** `/` (default tab)

List of the interpreter's assigned appointments, grouped by date.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| Appointment Card | Date/time, patient name, clinic, language, status badge |
| Status Badge | Color-coded per appointment status |
| Pull-to-Refresh | Refetch on swipe down |

**API Calls:**
- `GET /interpreters/me/appointments`

---

### Appointment Detail Screen
**File:** `app/appointment/[id].tsx`  
**Route:** `/appointment/:id`

Full appointment detail for the interpreter.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| Info Card | Date/time, clinic address, patient language, duration |
| Clock-In Button | Marks interpreter as arrived at the appointment |
| Status Display | Current appointment status |

**API Calls:**
- `GET /appointments/:id` (interpreter-scoped)
- `POST /appointments/:id/clock-in`

---

### Availability Tab
**File:** `app/(tabs)/availability.tsx`

Interpreter's self-managed availability blocks — time windows they are available for assignment.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| Availability Block List | Each block shows day-of-week, start/end time |
| Add Block Form | Day, start time, end time pickers |
| Delete Button | Removes a block |

**API Calls:**
- `GET /interpreters/me/availability`
- `POST /interpreters/me/availability`
- `DELETE /interpreters/me/availability/:block_id`

---

### Messages Tab
**File:** `app/(tabs)/messages.tsx`

Chat interface for the interpreter to communicate with admins.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| Message Thread | Scrollable list of messages with timestamps |
| Send Input | Text field + send button |
| Unread Dot | Orange dot on tab icon when there are unread messages from admin |

**API Calls:** 1-second polling (no Socket.io on mobile)
- `GET /messages/conversations/me` (or equivalent)
- `POST /messages/conversations/:adminId`
- `POST /messages/conversations/:adminId/read`

---

### Profile Tab
**File:** `app/(tabs)/profile.tsx`

Interpreter's own profile viewer and editor.

**Cards & Widgets:**

| Widget | Description |
|---|---|
| Profile Card | Name, phone, email, languages, type |
| Edit Mode | Toggle to edit name, email, and notification preferences |
| Logout Button | Clears AsyncStorage tokens and returns to login screen |

**API Calls:**
- `GET /interpreters/me`
- `PATCH /interpreters/me`

---

### Tab Bar Layout
**File:** `app/(tabs)/_layout.tsx`

Configures the bottom tab bar and shared header options for all tabs.

**Features:**
- Active tab color: `#0e402d` (forest green)
- Green header bar with white text across all tabs
- Dorada logo in top-right corner of every screen (`HeaderLogo` component)
- Unread message polling every 5 seconds → shows orange notification dot on Messages tab icon

---

## Shared Packages

### `@dorada/types`
**Location:** `packages/types/`

Zod schemas shared between the API and web app for request/response validation.

Key schemas include:
- `CreateAppointmentBodySchema`, `UpdateAppointmentBodySchema`
- `CreateInterpreterBodySchema`, `UpdateInterpreterBodySchema`, `UpdateSelfInterpreterBodySchema`
- `CreateClinicBodySchema`, `UpdateClinicBodySchema`
- `CreateInsuranceAgencyBodySchema`, `UpdateInsuranceAgencyBodySchema`
- `CreatePatientBodySchema`, `UpdatePatientBodySchema`
- `InterpreterListQuerySchema`, `ClinicListQuerySchema`, `InsuranceAgencyListQuerySchema`
- `GenerateReportBodySchema`, `ReportListQuerySchema`
- `CreateAvailabilityBlockBodySchema`

All schemas are used on the API side for `req.body` parsing and on the web side for form validation via `@hookform/resolvers/zod`.

---

### `@dorada/i18n`
**Location:** `packages/i18n/`

Translation files for the web admin portal in English (`en.json`) and Spanish (`es.json`).

Key namespaces within the single flat JSON file:
- `nav.*` — sidebar navigation labels
- `auth.*` — authentication screen strings
- `dashboard.*` — dashboard labels
- `appointments.*` — appointment module strings
- `interpreters.*` — interpreter module strings
- `clinics.*` — clinic module strings
- `insurance_agencies.*` — insurance agency strings
- `patients.*` — patient module strings
- `reports.*` — report strings
- `messages.*` — messaging strings
- `email_intake.*` — email intake strings
- `admin_users.*` — admin user management strings
- `settings.*` — settings module strings
- `common.*` — generic labels (save, cancel, edit, confirm, etc.)

---

## Auth & Security

### JWT Token Flow (Web Admin)
1. `POST /auth/admin/login` → returns `mfa_token` (if 2FA enabled) or `access_token` + `refresh_token`
2. If 2FA: `POST /auth/admin/mfa` with `mfa_token` + TOTP code → returns `access_token` + `refresh_token`
3. Tokens stored in `localStorage` (`dorada_access_token`, `dorada_refresh_token`)
4. `Authorization: Bearer {access_token}` header sent with every API request
5. On 401: API client automatically calls `POST /auth/refresh` → stores new tokens → retries original request
6. On refresh failure: `logout()` is called, user redirected to `/login`

### RBAC (Role-Based Access Control)
- Each admin user is assigned a `Role`
- Each `Role` has an array of permission strings
- Permissions checked in two places:
  - **API**: `requirePermission(perm)` Fastify preHandler returns 403 if not matched
  - **Web**: `PermissionGuard` component hides routes; `Sidebar` hides nav links; `hasPermission()` from Zustand store gates UI actions

### JWT Token Flow (Mobile / Interpreter)
1. `POST /auth/interpreter/login` with phone + PIN → returns `access_token` + `refresh_token`
2. Tokens stored in `AsyncStorage`
3. Bearer token sent with each request

---

## Real-time & Background Jobs

### Socket.io (Web Messaging)
- Server emits events to room `org:{organizationId}` on new messages
- Web client joins room on `MessagesPage` mount
- Events: `message` (new message received), `typing` (typing indicator)
- Mobile app does not use Socket.io — it polls the message API every 1 second instead

### BullMQ Report Queue
- `POST /reports` enqueues a job in the `reportQueue` (Redis-backed via BullMQ)
- A background worker picks up the job, runs queries, generates the PDF/CSV file, and updates `ReportJob` status in the database
- Web client polls `GET /reports/:job_id` every 3 seconds until status is `completed` or `failed`
- Completed jobs include a download URL pointing to the generated file

### Activity Log (`ActivityLog` table)
All admin mutations are written to the org-wide `ActivityLog` via the shared helper `src/lib/activityLog.ts`. The dashboard reads the 50 most recent entries. Covered entity types:

| Entity Type | Actions Logged |
|---|---|
| `appointment` | created, updated, cancelled, status changes |
| `clinic` | created, updated, deactivated |
| `interpreter` | created, updated, deactivated |
| `agency` | created, updated, deactivated |
| `admin_user` | created, updated, role_created |
| `report` | generated |
