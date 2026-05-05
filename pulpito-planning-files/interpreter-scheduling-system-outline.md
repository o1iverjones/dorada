# Pulpito — Feature Outline
*Interpreter Appointment Scheduling System*

## Overview
**Pulpito** (Spanish for "little octopus") is a system for tracking medical appointments that require a language interpreter.
Consists of two main components: a **Web App** (for administrators) and a **Smartphone App** (for interpreters/users).

Pulpito is designed for international use — all UI text, field labels, and public-facing strings must be fully localizable. English and Spanish are the required launch languages, with the architecture supporting additional locales in the future.

---

## 0. Localization & Internationalization (i18n)

- All UI text, labels, field names, notifications, and messages stored in locale files (not hardcoded)
- **Launch languages:** English (en) and Spanish (es)
- Architecture supports adding new languages without code changes — translators work on locale files only
- Admin portal includes a **localization management** section to view and edit UI strings per language
- Date, time, and number formats adapt to the user's locale
- Interpreter app language follows the device locale, with a manual override option
- Admin web app language selectable per user account
- Notification text (push and SMS) also fully localized
- Generated reports and exports (PDFs, CSVs) localized to match the admin's language setting
- **RTL (right-to-left) language support planned for future locales** (e.g., Arabic, Hebrew) — UI layout must be built RTL-aware from the start (mirrored layouts, bidirectional text handling)

---

## 1. Core Data Entities

### 1.1 Appointments
Known fields:
- Date and time
- Duration / minimum hours
- Appointment type/category (e.g., in-person, phone, video) — also determines hourly vs. flat rate pay
- Required language
- Required interpreter type (Certified or Qualified)
- Assigned interpreter
- Status (pending confirmation, confirmed, in progress, completed, cancelled)
- Patient name or ID
- Clinic
- Insurance agency
- Pre-authorized coverage amount (entered manually at appointment creation)
- Pre-authorized mileage coverage (entered manually at appointment creation)
- Referring physician or department
- Shift notes (added by interpreter post-appointment)
- Clock-in and clock-out timestamps

### 1.2 Patients
Known fields:
- Full name
- Contact information (phone, email)
- Medical record number (MRN)
- Preferred language

### 1.3 Clinics
Known fields:
- Name
- Address
- Phone number
- Primary contact (name and details)
- Billing information and per-clinic billing configuration (model, rates, invoice settings)

### 1.4 Insurance Agencies
> *Full fields to be defined — linked to every appointment; determines pre-authorized coverage amount and mileage per appointment*

### 1.5 Interpreters

**Two types:**
- **Certified** — higher qualification tier; has its own default pay rate
- **Qualified** — standard qualification tier; has its own default pay rate
- Both types share the same fields and can take the same appointment types
- Individual interpreter pay rate can override the type default

**Fields (all interpreters):**
- Full name
- Phone number (used for SMS authentication and contact)
- Email address
- Profile picture
- Location (coordinates of approximate home address — used to suggest nearby appointments using straight-line distance; no mapping API required)
- Language(s) spoken
- Type (Certified or Qualified)
- Clinics not allowed (list of one or more clinics this interpreter cannot be assigned to)
- Contractor pay rate (per-interpreter override of the type default) and payment method
- Emergency contact (name and phone)
- Address
- Availability blocks (dates/times marked unavailable)
- Notes (internal admin notes on the interpreter)

### 1.6 Admin Staff
Known fields:
- Full name
- Email address (used for login)
- Assigned role (custom, with configurable permissions)
- Two-factor authentication status

---

## 2. Web App (Administrator Portal)

### 2.1 Appointment Management
- View appointments on an interactive calendar
- Calendar filtering: by interpreter, by appointment status (pending confirmation, confirmed, completed, etc.), by clinic, by language, and other relevant fields; when filtering by interpreter, their unavailability blocks are shown visually on the calendar
- Create, edit, and cancel appointments
- Specify required interpreter tier or specialization per appointment
- Assign interpreters to appointments directly (system filters by required tier/specialization)
- Offer appointments to one or more eligible interpreters simultaneously — first to confirm is assigned; appointment is removed from others' queues automatically
- Alert admin when an offered appointment has no confirmation (so they can re-offer or reassign)
- View and manage interpreter responses (confirmed/declined/pending)
- **Follow-up review queue** — draft appointments created from interpreter follow-up confirmations appear here for admin review, editing, and publishing

### 2.2 User Management
- Create and manage interpreter accounts (including pay rate, payment method, emergency contact, address)
- Assign interpreter tiers and specializations (e.g., certified, medical, ASL)
- Create and manage admin accounts
- **Custom role management** — define roles with the following individually toggleable permissions:
  - Manage interpreters (create, edit, deactivate)
  - Manage clinics and billing configuration
  - Manage admin users and roles
  - View and generate reports
  - Manage appointments
  - Manage system settings and localization
- **Protected Super Admin role** — always exists, cannot be modified or deleted; has all permissions
- Admin login: email/password + two-factor authentication (2FA)

### 2.3 Clinic Management
- Create and manage clinic profiles
- Configure per-clinic billing rules (billing model, rates, invoice settings)

### 2.4 Reporting Suite

All reports support **PDF and CSV/Excel export**, are **localized** to the admin's language setting, and are generated via a flexible UI where admin selects filters, date ranges, and detail level before generating.

#### R1 — Interpreter Compensation Report
- Scope: one or more interpreters, flexible date range
- Compensation logic: hourly (clock-in/out × rate) or flat rate — determined by appointment type; minimum billable hours floor is configurable per appointment type
- Pay rate sourced from interpreter profile (overrides type default if set)
- Detail levels (admin selects): summary only, detail + summary, or detail + summary + breakdown by clinic
- Line items include: appointment date, clinic, type, hours clocked, minimum hours applied, rate, and amount

#### R2 — Insurance Agency Billing Report
- Scope: one or more insurance agencies, flexible date range
- Reconciliation/summary report only — not a formal invoice
- Shows pre-authorized amounts and mileage vs. actual amounts and mileage per appointment
- Line items include: appointment date, patient, clinic, interpreter, pre-auth amount, pre-auth mileage, actual amount, actual mileage

#### R3 — Appointment History Report
- Scope: flexible date range; admin chooses which appointment statuses to include (completed, cancelled, no-show, etc.)
- Filterable by: clinic, interpreter, insurance agency, language, appointment type
- Line items include: date, time, patient, clinic, interpreter, language, type, status, duration

#### R4 — Interpreter Performance & Attendance Report
- Scope: one or more interpreters, flexible date range
- Metrics: appointments completed, appointments cancelled or no-showed, on-time clock-in rate, total hours worked
- Detail levels (admin selects): summary per interpreter, or full appointment-level detail

### 2.5 System Settings
- Configure default pay rates for Certified and Qualified interpreter types
- Manage the language list (add, edit, deactivate languages)
- Manage appointment types — each type defines:
  - Name
  - Pay model (hourly or flat rate)
  - Minimum billable hours floor
- **Follow-up flow configuration:**
  - Non-response window before first reminder (configurable duration)
  - Number of reminders before marking as "no response" (configurable)
- Localization management — view and edit UI strings per supported language
- Other global configuration TBD

### 2.6 Admin Account Preferences
- Preferred language for the web app UI
- **Follow-up notification preference** — how admin is notified when a new follow-up draft is created:
  - Immediate push notification to phone app
  - Immediate email notification
  - Digest email (configurable frequency)
  - No notification — review queue only

### 3.1 Appointment Handling
- View upcoming confirmed appointments
- Receive appointment offers from admin (only matching interpreter's tier/specialization)
- Confirm or decline an offered appointment — confirming claims it and removes it from other interpreters who received the same offer
- Notification sent when a new appointment offer arrives

### 3.2 Clock In / Clock Out
- Clock in when arriving at an appointment
- Clock out when the appointment ends
- Time tracking tied to appointment records

### 3.3 Shift Notes & Media
- Add notes after completing a shift/appointment
- Attach images and media to a shift (e.g. documents, photos relevant to the appointment)
- Notes and media visible to all admin staff

### 3.4 Messaging
- In-app messaging between interpreters and admin staff

### 3.5 Availability Management
- Mark specific dates or time ranges as unavailable
- Unavailability visible to admin when assigning or offering appointments
- Edit or remove unavailability blocks

### 3.7 Automated Follow-Up Confirmation Flow

Triggered automatically when an interpreter clocks out of a completed appointment:

1. **Prompt delivery** — interpreter receives a push notification (default) or SMS (if set in account preferences) asking whether the patient has a follow-up appointment
2. **Interpreter response options:**
   - **No** — no follow-up; flow ends
   - **Yes** — interpreter is prompted with:
     - Is the physician the same as the current appointment? (Yes / No)
     - Is the clinic the same as the current appointment? (Yes / No)
     - What is the date and time of the follow-up? (free text)
     - Optional: attach images or media
3. **Non-response handling** — if the interpreter does not respond within a configurable window (set in system settings), a reminder is sent; the number of reminders before the system marks it as "no response" is also configurable
4. **Draft appointment creation** — when the interpreter confirms a follow-up, a draft appointment is automatically created in the system, pre-filled with all available data (patient, clinic if same, physician if same, language, interpreter type) and flagged as "pending admin review"
5. **Admin notification** — admin is notified according to their personal notification preference (set in their account):
   - Immediate push notification to phone app
   - Immediate email notification
   - Digest email (configurable frequency — multiple times per day)
   - No notification — draft appears silently in the pending review queue

### 3.8 Notifications
- Reminder notification 24 hours before an appointment
- Reminder notification 30 minutes before an appointment
- Notification when a new appointment offer arrives
- Follow-up confirmation prompt on clock-out (push or SMS per interpreter preference)

---

## 4. Automated Email Intake Agent

Insurance agencies send appointment offer emails to a dedicated per-tenant inbox (e.g. `acme-interpreters@appointments.pulpito.com`). An AI agent monitors this inbox, extracts structured data, creates draft appointments, and confirms receipt back to the agency — all without human intervention unless something goes wrong.

### 4.1 Inbox Monitoring
- Each tenant organization is provisioned a unique dedicated email address for receiving insurance agency appointment emails
- The platform polls the inbox every N minutes (default: 5 mins; configurable by super-admin in the super-admin panel)
- On each poll, new unprocessed emails are retrieved and queued for processing
- Each email is marked as processed after handling to prevent duplicate processing

### 4.2 AI Extraction Agent
The agent uses an LLM (Claude) to extract the following fields from each email:
- Patient name
- PO number (unique per appointment; used for billing and reporting)
- Date and time of appointment
- Doctor / physician name
- Clinic name
- Language(s) required
- Confirmation method required (reply email vs. confirmation link — detected automatically from email content)

**Matching logic** — for each extracted name field:
- The agent attempts a fuzzy name match against existing records in the tenant's database (patients, clinics, physicians/departments)
- If a confident match is found, the draft is linked to the existing record
- If no match is found, a new record is created automatically and flagged for admin review
- All auto-created records are clearly marked as AI-generated so admin can verify

**Confidence handling:**
- If the agent extracts all required fields with high confidence → create draft, proceed to confirmation
- If one or more fields are missing or low-confidence → create draft with whatever was extracted, flag specific fields as unresolved, alert admin for manual review; still attempt confirmation unless critical fields (PO number, date/time) are missing

**Duplicate PO detection:**
- Before creating a draft, the agent checks whether the PO number already exists in the system
- If a duplicate is found → flag the email for admin review, do not create a second draft, notify admin

### 4.3 Draft Appointment Creation
- A draft appointment is created with status `pending_email_review`
- The original email (full content + headers) is stored and linked to the draft for admin reference
- All extracted fields are pre-filled; unresolved or low-confidence fields are highlighted in the admin review UI
- Admin notification is sent per each admin's notification preference (same system as follow-up drafts)

### 4.4 Automated Confirmation
After successfully creating the draft, the agent performs the appropriate confirmation action:

**Reply email:**
- Agent sends a reply to the original email using a configurable template set per insurance agency
- Template is configured by admin in the insurance agency record
- Template supports variable substitution (patient name, PO number, date/time, etc.)

**Confirmation link:**
- Agent follows the confirmation link found in the email
- Agent navigates the external website and clicks the confirmation button
- A screenshot of the completed confirmation page is captured and stored with the draft for audit purposes

**Failure handling:**
- If the reply fails or the web confirmation cannot be completed (e.g. page structure changed, link expired), the failure is logged with full error detail
- Admin is alerted immediately to confirm manually
- The draft appointment is still created regardless of confirmation success or failure

### 4.5 Insurance Agency Email Configuration
Each insurance agency record gains new configuration fields for the email intake agent:
- **Expected sender domain(s)** — only emails from these domains are processed for this agency (e.g. `@bluecross.com`)
- **Confirmation method override** — optionally force reply or link mode (otherwise AI detects)
- **Reply template** — configurable email body with variable placeholders for confirmed appointments
- **Reply from name and address** — the from address used when replying on behalf of the tenant

### 4.6 Super-Admin Configuration
- Email polling interval (default: 5 minutes)
- LLM model and prompt version used for extraction (for auditability and rollback)
- Per-tenant inbox provisioning and management

---

## 5. Decisions Made
- System name: **Pulpito** (Spanish for "little octopus") ✅
- Localization: fully localizable i18n architecture; launch languages are English and Spanish, additional locales addable without code changes ✅
- Reports and exports localized to match admin's language setting ✅
- RTL language support (e.g., Arabic, Hebrew) planned for future — UI must be built RTL-aware from the start ✅
- Interpreter type: independent contractors (1099) — payroll reports reflect contractor compensation ✅
- Platform targets: iOS and Android ✅
- Languages: fixed list configured at system setup, managed by admins ✅
- Clinic billing: mix of models (per appointment flat/variable, hourly clocked time, monthly invoice) — rules configurable per clinic ✅
- Interpreter authentication: phone number + SMS one-time code (OTP) ✅
- Admin authentication: email/password + two-factor authentication (2FA) ✅
- Billing rules: configurable per clinic in the admin portal ✅
- Interpreter types: two — **Certified** and **Qualified**; same fields and appointment access, differ only in default pay rate (overridable per interpreter) ✅
- Interpreter record fields: name, phone, email, profile picture, home coordinates (used to suggest nearby appointments), language(s), type, clinics-not-allowed list (multiple), pay rate, payment method, emergency contact, address, availability blocks, internal notes ✅
- Open pool claiming: admin offers to multiple eligible interpreters simultaneously; first to confirm is assigned, appointment disappears for all others ✅
- Admin calendar: interpreter unavailability blocks shown visually when filtering by interpreter ✅
- Patient record fields: full name, contact info, MRN, preferred language ✅
- Clinic record fields: name, address, phone, primary contact, billing info and configuration ✅
- Insurance Agency: new core data entity — every appointment is linked to one; pre-authorized coverage amount and mileage entered manually at appointment creation ✅
- Appointment type determines hourly vs. flat rate pay ✅
- Minimum billable hours floor applies per appointment ✅
- Report export formats: PDF and CSV/Excel ✅
- Report detail level: configurable by admin at generation time ✅
- Compensation report scope: per interpreter, flexible date range ✅
- Billing report scoped per insurance agency (not per clinic) ✅
- Appointment history report: admin selects which statuses to include ✅
- Minimum billable hours floor: configurable per appointment type (not global) ✅
- Reporting suite complete: R1 Interpreter Compensation, R2 Insurance Agency Billing, R3 Appointment History, R4 Interpreter Performance & Attendance ✅
- Default pay rates for Certified and Qualified configured in System Settings ✅
- Nearby appointment suggestion uses straight-line distance (no external mapping API) ✅
- Admin roles: multiple custom roles with individually toggleable permissions per category; one protected Super Admin role that cannot be modified or deleted ✅
- Interpreter record additional fields: address, emergency contact, contractor pay rate and payment method ✅
- Interpreter availability: interpreters can mark themselves unavailable on specific dates/times; admin sees this when assigning ✅
- Shift notes: visible to all admin staff ✅
- Shift notes and follow-up responses support image/media attachments ✅
- Automated follow-up confirmation flow: triggered on clock-out; push notification by default, SMS configurable per interpreter ✅
- Follow-up response captures: yes/no, same physician, same clinic, date/time (free text), optional media ✅
- Non-response reminders: window and number of reminders both configurable in system settings ✅
- Confirmed follow-up creates a draft appointment pre-filled with available data, flagged for admin review ✅
- Admin follow-up notification: configurable per admin account (immediate push, immediate email, digest email, or queue only) ✅
- Email intake agent: AI agent monitors per-tenant dedicated inbox, extracts appointment data, creates drafts, and confirms receipt automatically ✅
- Email matching: fuzzy name match against existing records; auto-creates new records if no match found, flagged for admin review ✅
- Low-confidence extractions: draft created with available data, unresolved fields flagged; admin alerted ✅
- Duplicate PO number: flagged for admin review, no duplicate draft created ✅
- Confirmation method: AI detects automatically (reply email vs. link click) from email content ✅
- Confirmation is automatic — admin reviews the draft separately ✅
- Confirmation failure: logged with full error detail, admin alerted to confirm manually ✅
- Reply email template: configurable per insurance agency with variable substitution ✅
- Web confirmation: agent follows link, clicks confirmation button, captures screenshot for audit ✅
- Email polling interval: configurable in super-admin panel (default: 5 minutes) ✅

---

## 6. Open Questions / To Be Defined
- Insurance Agency entity fields (now expanded to include email configuration) — to be defined in full
- System Settings: other global configuration items TBD
- Super-admin panel scope — what else does it control beyond email polling interval and LLM settings?
