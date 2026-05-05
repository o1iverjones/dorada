# Pulpito — API Specification
*Base URL: `/api/v1`*
*All requests require `Authorization: Bearer <jwt>` unless marked public.*
*All responses are JSON. Errors follow the shape: `{ "error": { "code": string, "message": string } }`*
*All data is implicitly scoped to the authenticated user's `organization_id`.*

---

## Conventions

### Pagination
List endpoints return cursor-based pagination:
```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6IjEyMyJ9",
    "has_more": true
  }
}
```
Pass `?cursor=<next_cursor>&limit=<n>` to fetch the next page. Default limit: 25. Max: 100.

### Filtering
Filters are passed as query parameters on list endpoints. Multiple values for the same filter are comma-separated (e.g. `?status=confirmed,completed`).

### Dates & Times
All datetimes are ISO 8601 in UTC (e.g. `2025-06-15T14:00:00Z`). Clients handle timezone display.

### IDs
All IDs are UUIDs (v4).

---

## 1. Appointments

### 1.1 List Appointments
```
GET /appointments
```
**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `status` | string (csv) | Filter by status: `pending_offer`, `confirmed`, `in_progress`, `completed`, `cancelled` |
| `interpreter_id` | uuid | Filter by assigned interpreter |
| `clinic_id` | uuid | Filter by clinic |
| `insurance_agency_id` | uuid | Filter by insurance agency |
| `language` | string | Filter by required language code |
| `type_id` | uuid | Filter by appointment type |
| `date_from` | date | Filter appointments on or after this date (YYYY-MM-DD) |
| `date_to` | date | Filter appointments on or before this date (YYYY-MM-DD) |
| `cursor` | string | Pagination cursor |
| `limit` | integer | Page size (default 25, max 100) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "status": "confirmed",
      "date_time": "2025-06-15T14:00:00Z",
      "duration_minutes": 60,
      "type": { "id": "uuid", "name": "In-Person" },
      "language": "es",
      "interpreter_type_required": "certified",
      "interpreter": { "id": "uuid", "name": "Maria Lopez" },
      "clinic": { "id": "uuid", "name": "Downtown Medical" },
      "insurance_agency": { "id": "uuid", "name": "BlueCross" },
      "patient": { "id": "uuid", "name": "John Smith", "mrn": "MRN-001" },
      "referring_physician": "Dr. Nguyen",
      "department": "Cardiology",
      "pre_auth_amount": 120.00,
      "pre_auth_mileage": 30,
      "po_number": "BC-2025-4421",
      "source": "email_intake",
      "clock_in": null,
      "clock_out": null,
      "created_at": "2025-06-01T09:00:00Z",
      "updated_at": "2025-06-01T09:00:00Z"
    }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6IjEyMyJ9",
    "has_more": true
  }
}
```

---

### 1.2 Get Appointment
```
GET /appointments/:id
```
**Response `200`:** Full appointment object (same shape as list item above) plus:
```json
{
  "shift_notes": "Patient arrived late. Session extended.",
  "offers": [
    {
      "id": "uuid",
      "interpreter": { "id": "uuid", "name": "Carlos Ruiz" },
      "status": "pending",
      "offered_at": "2025-06-01T10:00:00Z"
    }
  ]
}
```

---

### 1.3 Create Appointment
```
POST /appointments
```
**Permissions required:** `manage_appointments`

**Request Body:**
```json
{
  "date_time": "2025-06-15T14:00:00Z",
  "duration_minutes": 60,
  "type_id": "uuid",
  "language": "es",
  "interpreter_type_required": "certified",
  "clinic_id": "uuid",
  "insurance_agency_id": "uuid",
  "patient_id": "uuid",
  "referring_physician": "Dr. Nguyen",
  "department": "Cardiology",
  "pre_auth_amount": 120.00,
  "pre_auth_mileage": 30
}
```
**Notes:**
- `interpreter_type_required` must be `"certified"` or `"qualified"`
- `pre_auth_amount` and `pre_auth_mileage` are required — entered manually at creation
- `po_number` — optional for manually created appointments; automatically populated when created from an email intake draft
- Status is set to `pending_offer` automatically

**Response `201`:** Full appointment object.

---

### 1.4 Update Appointment
```
PATCH /appointments/:id
```
**Permissions required:** `manage_appointments`

**Request Body:** Any subset of the create body fields. Additionally:
```json
{
  "status": "cancelled"
}
```
**Notes:**
- Status transitions are validated server-side (e.g. a `completed` appointment cannot be moved to `confirmed`)
- Updating a `confirmed` appointment triggers a notification to the assigned interpreter

**Response `200`:** Updated appointment object.

---

### 1.5 Delete / Cancel Appointment
```
DELETE /appointments/:id
```
**Permissions required:** `manage_appointments`

**Notes:**
- Soft delete only — status set to `cancelled`, record retained for reporting
- Assigned interpreter is notified via push notification
- All pending offers are expired

**Response `204`:** No content.

---

### 1.6 Offer Appointment to Interpreters
```
POST /appointments/:id/offers
```
**Permissions required:** `manage_appointments`

**Request Body:**
```json
{
  "interpreter_ids": ["uuid", "uuid", "uuid"],
  "expires_after_minutes": 60
}
```
**Notes:**
- Only interpreters whose type matches `interpreter_type_required` are accepted; others are rejected with a `422`
- Only interpreters not on the clinic's `not_allowed` list are accepted
- Only interpreters with no availability conflict are accepted
- Push notification sent to all offered interpreters immediately
- A BullMQ delayed job is scheduled to alert admin if no confirmation arrives before `expires_after_minutes`
- If appointment already has a confirmed interpreter, returns `409 Conflict`

**Response `201`:**
```json
{
  "offers": [
    {
      "id": "uuid",
      "interpreter": { "id": "uuid", "name": "Maria Lopez" },
      "status": "pending",
      "offered_at": "2025-06-15T10:00:00Z",
      "expires_at": "2025-06-15T11:00:00Z"
    }
  ]
}
```

---

### 1.7 Confirm Appointment Offer (Interpreter)
```
POST /appointments/:id/offers/:offer_id/confirm
```
**Auth:** Interpreter JWT only (not admin)

**Notes:**
- Atomically assigns appointment to this interpreter and expires all other pending offers for the same appointment
- Push notifications sent to other interpreters informing them the appointment is no longer available
- Appointment status transitions to `confirmed`
- Returns `409 Conflict` if offer already expired or another interpreter confirmed first

**Response `200`:**
```json
{
  "appointment": { "id": "uuid", "status": "confirmed" }
}
```

---

### 1.8 Decline Appointment Offer (Interpreter)
```
POST /appointments/:id/offers/:offer_id/decline
```
**Auth:** Interpreter JWT only

**Response `200`:**
```json
{
  "offer": { "id": "uuid", "status": "declined" }
}
```

---

### 1.9 Clock In (Interpreter)
```
POST /appointments/:id/clock-in
```
**Auth:** Interpreter JWT only

**Notes:**
- Only the assigned interpreter can clock in
- Appointment must be in `confirmed` status; transitions to `in_progress`
- Returns `409` if already clocked in

**Response `200`:**
```json
{
  "clock_in": "2025-06-15T14:03:00Z",
  "status": "in_progress"
}
```

---

### 1.10 Clock Out (Interpreter)
```
POST /appointments/:id/clock-out
```
**Auth:** Interpreter JWT only

**Notes:**
- Appointment must be `in_progress`; transitions to `completed`
- Actual duration is calculated from `clock_in` to `clock_out`; minimum billable hours from appointment type applied if actual is lower

**Response `200`:**
```json
{
  "clock_out": "2025-06-15T15:10:00Z",
  "actual_duration_minutes": 70,
  "billable_duration_minutes": 70,
  "status": "completed"
}
```

---

### 1.11 Add Shift Notes (Interpreter)
```
POST /appointments/:id/notes
```
**Auth:** Interpreter JWT only

**Notes:**
- Appointment must be `completed`
- Replaces any existing shift notes (not appended)

**Request Body:**
```json
{
  "notes": "Patient arrived late. Needed additional time for medication questions."
}
```

**Response `200`:**
```json
{
  "notes": "Patient arrived late. Needed additional time for medication questions.",
  "updated_at": "2025-06-15T15:20:00Z"
}
```

---

### 1.12 Get Interpreter's Appointments (Mobile)
```
GET /interpreters/me/appointments
```
**Auth:** Interpreter JWT only

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `status` | string (csv) | Filter by status |
| `date_from` | date | Start of date range |
| `date_to` | date | End of date range |

**Notes:**
- Returns only appointments assigned to or offered to the authenticated interpreter
- Ordered by `date_time` ascending

**Response `200`:** Paginated list of appointment objects (same shape as 1.1, without `offers` array).

---

## 2. Status Transition Rules

| From | To | Trigger |
|---|---|---|
| `pending_offer` | `confirmed` | Interpreter confirms an offer |
| `pending_offer` | `cancelled` | Admin cancels |
| `confirmed` | `in_progress` | Interpreter clocks in |
| `confirmed` | `cancelled` | Admin cancels |
| `in_progress` | `completed` | Interpreter clocks out |
| `completed` | *(terminal)* | No further transitions |
| `cancelled` | *(terminal)* | No further transitions |

---

## 3. Error Codes (Appointments)

| Code | HTTP | Meaning |
|---|---|---|
| `APPOINTMENT_NOT_FOUND` | 404 | Appointment does not exist or not in tenant |
| `INVALID_STATUS_TRANSITION` | 422 | Attempted status change is not allowed |
| `INTERPRETER_NOT_ELIGIBLE` | 422 | Interpreter type mismatch or on clinic not-allowed list |
| `INTERPRETER_UNAVAILABLE` | 422 | Interpreter has an availability conflict |
| `ALREADY_CONFIRMED` | 409 | Another interpreter already confirmed this appointment |
| `OFFER_EXPIRED` | 409 | Offer window has closed |
| `ALREADY_CLOCKED_IN` | 409 | Interpreter already clocked in to this appointment |
| `NOT_ASSIGNED_INTERPRETER` | 403 | Interpreter is not assigned to this appointment |

---

---

## 4. Auth

All auth endpoints are **public** (no JWT required) unless noted.

### 4.1 Request OTP (Interpreter)
```
POST /auth/interpreter/otp/request
```
**Request Body:**
```json
{ "phone": "+15551234567" }
```
**Notes:**
- Phone must be in E.164 format
- OTP is 6 digits, valid for 10 minutes, single-use
- Rate limited: max 3 requests per phone number per 10 minutes
- Returns `200` whether or not the phone number exists (prevents enumeration)

**Response `200`:**
```json
{ "message": "OTP sent if number is registered." }
```

---

### 4.2 Verify OTP (Interpreter)
```
POST /auth/interpreter/otp/verify
```
**Request Body:**
```json
{
  "phone": "+15551234567",
  "otp": "483921"
}
```
**Notes:**
- On success issues a short-lived access token (15 min) and a refresh token (30 days)
- Refresh token is rotated on each use
- Failed attempts are counted; account locked for 15 minutes after 5 consecutive failures

**Response `200`:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "interpreter": {
    "id": "uuid",
    "name": "Maria Lopez",
    "phone": "+15551234567"
  }
}
```

---

### 4.3 Admin Login — Step 1 (Email + Password)
```
POST /auth/admin/login
```
**Request Body:**
```json
{
  "email": "admin@clinic.com",
  "password": "..."
}
```
**Notes:**
- Returns a short-lived, scope-limited `mfa_token` (5 min) if credentials are valid; does not issue a full session
- `mfa_token` is only valid for the TOTP verification step (4.4)
- Returns `401` for invalid credentials (no distinction between wrong email / wrong password)
- Rate limited: max 5 failed attempts per email per 15 minutes; account locked after limit

**Response `200`:**
```json
{ "mfa_token": "eyJ..." }
```

---

### 4.4 Admin Login — Step 2 (TOTP)
```
POST /auth/admin/mfa/verify
```
**Request Body:**
```json
{
  "mfa_token": "eyJ...",
  "totp_code": "123456"
}
```
**Notes:**
- Validates TOTP code against the admin's secret (Google Authenticator / Authy compatible)
- On success issues full access token (15 min) + refresh token (8 hours)
- TOTP codes are single-use (replay attack prevention)

**Response `200`:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "admin": {
    "id": "uuid",
    "name": "Jane Admin",
    "email": "admin@clinic.com",
    "role": { "id": "uuid", "name": "Scheduler" },
    "permissions": ["manage_appointments", "view_reports"]
  }
}
```

---

### 4.5 Refresh Token
```
POST /auth/refresh
```
**Request Body:**
```json
{ "refresh_token": "eyJ..." }
```
**Notes:**
- Works for both interpreter and admin tokens
- Old refresh token is invalidated immediately (rotation)
- Returns `401` if token is expired, already used, or revoked

**Response `200`:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

---

### 4.6 Logout
```
POST /auth/logout
```
**Auth:** Required (interpreter or admin JWT)

**Notes:**
- Revokes the current refresh token server-side
- Client should discard both tokens locally

**Response `204`:** No content.

---

### 4.7 Admin TOTP Setup
```
POST /auth/admin/mfa/setup
```
**Auth:** Admin JWT required (used during onboarding before 2FA is active)

**Notes:**
- Generates a new TOTP secret for the admin
- Returns a `otpauth://` URI and base64-encoded QR code for scanning with authenticator app
- Secret is not saved until confirmed via 4.8

**Response `200`:**
```json
{
  "qr_code": "data:image/png;base64,...",
  "otpauth_uri": "otpauth://totp/Pulpito:admin@clinic.com?secret=BASE32SECRET&issuer=Pulpito"
}
```

---

### 4.8 Admin TOTP Confirm
```
POST /auth/admin/mfa/confirm
```
**Auth:** Admin JWT required

**Request Body:**
```json
{ "totp_code": "123456" }
```
**Notes:**
- Confirms the admin has successfully scanned and can generate valid codes
- Saves the TOTP secret; 2FA is now active on the account

**Response `200`:**
```json
{ "mfa_enabled": true }
```

---

### 4.9 Admin Password Reset — Request
```
POST /auth/admin/password/reset-request
```
**Request Body:**
```json
{ "email": "admin@clinic.com" }
```
**Notes:**
- Sends a password reset link via SendGrid if email exists
- Always returns `200` to prevent email enumeration
- Reset link is valid for 1 hour, single-use

**Response `200`:**
```json
{ "message": "Reset link sent if email is registered." }
```

---

### 4.10 Admin Password Reset — Confirm
```
POST /auth/admin/password/reset-confirm
```
**Request Body:**
```json
{
  "reset_token": "...",
  "new_password": "..."
}
```
**Notes:**
- Password must meet minimum complexity requirements (min 10 chars, mixed case, digit)
- All existing refresh tokens for this admin are revoked on success

**Response `200`:**
```json
{ "message": "Password updated successfully." }
```

---

### 4.11 Error Codes (Auth)

| Code | HTTP | Meaning |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Wrong email/password or invalid OTP |
| `MFA_TOKEN_INVALID` | 401 | MFA token missing, expired, or already used |
| `TOTP_INVALID` | 401 | TOTP code is wrong or already used |
| `ACCOUNT_LOCKED` | 429 | Too many failed attempts |
| `OTP_RATE_LIMITED` | 429 | Too many OTP requests for this phone |
| `RESET_TOKEN_INVALID` | 401 | Password reset token expired or already used |
| `TOKEN_REVOKED` | 401 | Refresh token has been revoked |

---

## 5. Interpreters

### 5.1 List Interpreters
```
GET /interpreters
```
**Permissions required:** `manage_interpreters`

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `type` | string | Filter by `certified` or `qualified` |
| `language` | string | Filter by language code |
| `clinic_id` | uuid | Exclude interpreters on this clinic's not-allowed list |
| `available_on` | datetime | Only interpreters with no availability block at this datetime |
| `search` | string | Full-text search on interpreter name |
| `cursor` | string | Pagination cursor |
| `limit` | integer | Page size (default 25, max 100) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Maria Lopez",
      "phone": "+15551234567",
      "email": "maria@example.com",
      "type": "certified",
      "languages": ["es", "en"],
      "profile_picture_url": "https://storage.googleapis.com/...",
      "location": { "lat": 34.0522, "lng": -118.2437 },
      "pay_rate": 35.00,
      "payment_method": "direct_deposit",
      "clinics_not_allowed": [
        { "id": "uuid", "name": "Eastside Clinic" }
      ],
      "created_at": "2025-01-10T09:00:00Z",
      "updated_at": "2025-03-01T11:00:00Z"
    }
  ],
  "pagination": { "next_cursor": "eyJ...", "has_more": false }
}
```

---

### 5.2 Get Interpreter
```
GET /interpreters/:id
```
**Permissions required:** `manage_interpreters`

**Response `200`:** Full interpreter object (same as list item) plus:
```json
{
  "address": "123 Main St, Los Angeles, CA 90001",
  "emergency_contact": { "name": "Pedro Lopez", "phone": "+15559876543" },
  "notes": "Prefers morning appointments.",
  "availability_blocks": [
    {
      "id": "uuid",
      "from": "2025-06-20T00:00:00Z",
      "to": "2025-06-27T23:59:59Z",
      "reason": "Vacation"
    }
  ]
}
```

---

### 5.3 Create Interpreter
```
POST /interpreters
```
**Permissions required:** `manage_interpreters`

**Request Body:**
```json
{
  "name": "Maria Lopez",
  "phone": "+15551234567",
  "email": "maria@example.com",
  "type": "certified",
  "languages": ["es", "en"],
  "location": { "lat": 34.0522, "lng": -118.2437 },
  "pay_rate": 35.00,
  "payment_method": "direct_deposit",
  "address": "123 Main St, Los Angeles, CA 90001",
  "emergency_contact": { "name": "Pedro Lopez", "phone": "+15559876543" },
  "clinics_not_allowed": ["uuid", "uuid"],
  "notes": "Prefers morning appointments."
}
```
**Notes:**
- `pay_rate` overrides the organization-wide default for this interpreter's type if provided; if omitted, the system default applies
- `phone` must be unique within the organization
- Profile picture is uploaded separately via 5.6

**Response `201`:** Full interpreter object.

---

### 5.4 Update Interpreter
```
PATCH /interpreters/:id
```
**Permissions required:** `manage_interpreters`

**Request Body:** Any subset of the create body fields.

**Notes:**
- Changing `type` updates the default pay rate to the new type's system default unless `pay_rate` is explicitly set
- Changing `clinics_not_allowed` takes effect immediately — any pending offers to now-excluded clinics are not retroactively revoked, but admin is warned

**Response `200`:** Updated interpreter object.

---

### 5.5 Deactivate Interpreter
```
DELETE /interpreters/:id
```
**Permissions required:** `manage_interpreters`

**Notes:**
- Soft delete — interpreter is deactivated, not removed; historical records retained
- Deactivated interpreters cannot receive new offers or log in
- Returns `409` if interpreter has upcoming confirmed appointments (must be resolved first)

**Response `204`:** No content.

---

### 5.6 Upload Profile Picture
```
POST /interpreters/:id/profile-picture
```
**Permissions required:** `manage_interpreters`

**Request:** `multipart/form-data` with field `file` (JPEG or PNG, max 5MB)

**Notes:**
- File is uploaded to Google Cloud Storage; public URL is stored on interpreter record
- Previous picture is deleted from storage on replacement

**Response `200`:**
```json
{ "profile_picture_url": "https://storage.googleapis.com/pulpito/interpreters/uuid/profile.jpg" }
```

---

### 5.7 Get Interpreter Profile (Mobile — Self)
```
GET /interpreters/me
```
**Auth:** Interpreter JWT only

**Response `200`:** Interpreter's own profile. Excludes `notes`, `pay_rate`, `payment_method`, and `emergency_contact` (admin-only fields).

---

### 5.8 Update Own Profile (Mobile — Self)
```
PATCH /interpreters/me
```
**Auth:** Interpreter JWT only

**Request Body:** Only the following fields are self-editable:
```json
{
  "email": "new@example.com",
  "location": { "lat": 34.0522, "lng": -118.2437 }
}
```
**Notes:**
- Interpreters cannot change their own name, type, pay rate, or clinics-not-allowed list

**Response `200`:** Updated interpreter profile (self-view).

---

### 5.9 List Availability Blocks (Interpreter — Self)
```
GET /interpreters/me/availability
```
**Auth:** Interpreter JWT only

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "from": "2025-06-20T00:00:00Z",
      "to": "2025-06-27T23:59:59Z",
      "reason": "Vacation"
    }
  ]
}
```

---

### 5.10 Add Availability Block (Interpreter — Self)
```
POST /interpreters/me/availability
```
**Auth:** Interpreter JWT only

**Request Body:**
```json
{
  "from": "2025-06-20T00:00:00Z",
  "to": "2025-06-27T23:59:59Z",
  "reason": "Vacation"
}
```
**Notes:**
- `to` must be after `from`
- Blocks cannot overlap with existing confirmed appointments (returns `409` with conflicting appointment IDs)
- Admin sees these blocks on the calendar when filtering by interpreter

**Response `201`:** Availability block object.

---

### 5.11 Delete Availability Block (Interpreter — Self)
```
DELETE /interpreters/me/availability/:block_id
```
**Auth:** Interpreter JWT only

**Response `204`:** No content.

---

### 5.12 Error Codes (Interpreters)

| Code | HTTP | Meaning |
|---|---|---|
| `INTERPRETER_NOT_FOUND` | 404 | Interpreter not found or not in tenant |
| `PHONE_ALREADY_EXISTS` | 409 | Phone number already registered |
| `HAS_UPCOMING_APPOINTMENTS` | 409 | Cannot deactivate — has confirmed upcoming appointments |
| `AVAILABILITY_CONFLICTS_WITH_APPOINTMENT` | 409 | Unavailability block overlaps a confirmed appointment |
| `INVALID_DATE_RANGE` | 422 | `to` is before or equal to `from` |
| `FILE_TOO_LARGE` | 422 | Profile picture exceeds 5MB |
| `INVALID_FILE_TYPE` | 422 | Only JPEG and PNG are accepted |

---

*Next sections to be added: Clinics & Insurance Agencies, Patients, Reports, Messages, System Settings*

---

## 6. Clinics

### 6.1 List Clinics
```
GET /clinics
```
**Permissions required:** `manage_clinics`

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `search` | string | Full-text search on clinic name |
| `cursor` | string | Pagination cursor |
| `limit` | integer | Page size (default 25, max 100) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Downtown Medical Center",
      "address": "456 Health Ave, Los Angeles, CA 90010",
      "phone": "+12135550100",
      "primary_contact": {
        "name": "Dr. Sandra Ortiz",
        "phone": "+12135550101",
        "email": "sortiz@downtownmed.com"
      },
      "billing": {
        "model": "mixed",
        "hourly_rate": 95.00,
        "flat_rate": null,
        "invoice_cycle": "monthly"
      },
      "created_at": "2025-01-05T08:00:00Z",
      "updated_at": "2025-04-01T10:00:00Z"
    }
  ],
  "pagination": { "next_cursor": "eyJ...", "has_more": false }
}
```

---

### 6.2 Get Clinic
```
GET /clinics/:id
```
**Permissions required:** `manage_clinics`

**Response `200`:** Full clinic object (same as list item) plus:
```json
{
  "interpreters_not_allowed": [
    { "id": "uuid", "name": "Carlos Ruiz" }
  ]
}
```

---

### 6.3 Create Clinic
```
POST /clinics
```
**Permissions required:** `manage_clinics`

**Request Body:**
```json
{
  "name": "Downtown Medical Center",
  "address": "456 Health Ave, Los Angeles, CA 90010",
  "phone": "+12135550100",
  "primary_contact": {
    "name": "Dr. Sandra Ortiz",
    "phone": "+12135550101",
    "email": "sortiz@downtownmed.com"
  },
  "billing": {
    "model": "mixed",
    "hourly_rate": 95.00,
    "flat_rate": null,
    "invoice_cycle": "monthly"
  }
}
```
**Notes:**
- `billing.model` must be one of: `hourly`, `flat`, `mixed`, `monthly`
- `billing.hourly_rate` required if model is `hourly` or `mixed`
- `billing.flat_rate` required if model is `flat` or `mixed`

**Response `201`:** Full clinic object.

---

### 6.4 Update Clinic
```
PATCH /clinics/:id
```
**Permissions required:** `manage_clinics`

**Request Body:** Any subset of the create body fields.

**Response `200`:** Updated clinic object.

---

### 6.5 Deactivate Clinic
```
DELETE /clinics/:id
```
**Permissions required:** `manage_clinics`

**Notes:**
- Soft delete — clinic is deactivated, not removed; historical appointment records retained
- Returns `409` if clinic has upcoming confirmed appointments

**Response `204`:** No content.

---

### 6.6 Error Codes (Clinics)

| Code | HTTP | Meaning |
|---|---|---|
| `CLINIC_NOT_FOUND` | 404 | Clinic not found or not in tenant |
| `HAS_UPCOMING_APPOINTMENTS` | 409 | Cannot deactivate — has confirmed upcoming appointments |
| `INVALID_BILLING_CONFIG` | 422 | Billing model and rate fields are inconsistent |

---

## 7. Insurance Agencies

### 7.1 List Insurance Agencies
```
GET /insurance-agencies
```
**Permissions required:** `manage_clinics`

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `search` | string | Full-text search on agency name |
| `cursor` | string | Pagination cursor |
| `limit` | integer | Page size (default 25, max 100) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "BlueCross Health",
      "address": "789 Insurance Blvd, Sacramento, CA 95814",
      "phone": "+19165550200",
      "primary_contact": {
        "name": "Janet Kim",
        "phone": "+19165550201",
        "email": "jkim@bluecross.com"
      },
      "notes": "Requires itemized monthly reconciliation.",
      "created_at": "2025-01-08T09:00:00Z",
      "updated_at": "2025-02-15T14:00:00Z"
    }
  ],
  "pagination": { "next_cursor": "eyJ...", "has_more": false }
}
```

---

### 7.2 Get Insurance Agency
```
GET /insurance-agencies/:id
```
**Permissions required:** `manage_clinics`

**Response `200`:** Full insurance agency object (same as list item).

---

### 7.3 Create Insurance Agency
```
POST /insurance-agencies
```
**Permissions required:** `manage_clinics`

**Request Body:**
```json
{
  "name": "BlueCross Health",
  "address": "789 Insurance Blvd, Sacramento, CA 95814",
  "phone": "+19165550200",
  "primary_contact": {
    "name": "Janet Kim",
    "phone": "+19165550201",
    "email": "jkim@bluecross.com"
  },
  "notes": "Requires itemized monthly reconciliation.",
  "email_intake": {
    "sender_domains": ["bluecross.com", "bcbs.com"],
    "confirmation_method_override": null,
    "reply_template": "Dear {{agency_name}},\n\nThank you for your appointment request. We confirm receipt of PO {{po_number}} for patient {{patient_name}} on {{date_time}}.\n\nBest regards,\n{{org_name}}",
    "reply_from_name": "Acme Interpreters",
    "reply_from_email": "appointments@acme-interpreters.pulpito.com"
  }
}
```
**Notes:**
- `email_intake.sender_domains` — only emails from these domains are processed for this agency; others are flagged as unrecognized sender
- `email_intake.confirmation_method_override` — `null` means AI auto-detects; set to `"reply_email"` or `"confirmation_link"` to force
- `reply_template` supports variable placeholders: `{{agency_name}}`, `{{patient_name}}`, `{{po_number}}`, `{{date_time}}`, `{{org_name}}`
- `email_intake` config is optional — agencies without it receive no special email handling

**Response `201`:** Full insurance agency object including `email_intake` config.

---

## 13. Email Intake Agent

### 13.1 List Email Intake Logs
```
GET /email-intake/logs
```
**Permissions required:** `manage_appointments`

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `status` | string (csv) | Filter by: `pending`, `processing`, `draft_created`, `failed`, `duplicate_po`, `flagged` |
| `insurance_agency_id` | uuid | Filter by detected agency |
| `date_from` | date | Filter emails received on or after this date |
| `date_to` | date | Filter emails received on or before this date |
| `cursor` | string | Pagination cursor |
| `limit` | integer | Page size (default 25, max 100) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "received_at": "2025-06-15T09:03:00Z",
      "from_email": "scheduling@bluecross.com",
      "subject": "Interpreter Request - PO #BC-2025-4421",
      "status": "draft_created",
      "insurance_agency": { "id": "uuid", "name": "BlueCross Health" },
      "draft_appointment_id": "uuid",
      "confirmation_status": "success",
      "confirmation_method": "reply_email",
      "has_unresolved_fields": false,
      "duplicate_po": false,
      "processed_at": "2025-06-15T09:03:45Z"
    }
  ],
  "pagination": { "next_cursor": "eyJ...", "has_more": true }
}
```

---

### 13.2 Get Email Intake Log Detail
```
GET /email-intake/logs/:log_id
```
**Permissions required:** `manage_appointments`

**Response `200`:**
```json
{
  "id": "uuid",
  "received_at": "2025-06-15T09:03:00Z",
  "from_email": "scheduling@bluecross.com",
  "subject": "Interpreter Request - PO #BC-2025-4421",
  "status": "draft_created",
  "insurance_agency": { "id": "uuid", "name": "BlueCross Health" },
  "raw_email_url": "https://storage.googleapis.com/pulpito/email-intake/...",
  "extraction": {
    "model": "claude-sonnet-4-20250514",
    "prompt_version": "v1.2",
    "extracted_at": "2025-06-15T09:03:12Z",
    "fields": {
      "patient_name": { "value": "John Smith", "confidence": "high", "matched_record_id": "uuid", "auto_created": false },
      "po_number": { "value": "BC-2025-4421", "confidence": "high" },
      "date_time": { "value": "2025-06-22T10:00:00Z", "confidence": "high" },
      "doctor_name": { "value": "Dr. Nguyen", "confidence": "high", "matched_record": "Cardiology", "auto_created": false },
      "clinic_name": { "value": "Downtown Medical", "confidence": "high", "matched_record_id": "uuid", "auto_created": false },
      "languages": { "value": ["es"], "confidence": "high" },
      "confirmation_method": { "value": "reply_email", "confidence": "high" }
    },
    "unresolved_fields": []
  },
  "confirmation": {
    "method": "reply_email",
    "status": "success",
    "executed_at": "2025-06-15T09:03:40Z",
    "screenshot_url": null
  },
  "draft_appointment_id": "uuid",
  "duplicate_po": false
}
```

---

### 13.3 List Email Intake Drafts (Admin Review Queue)
```
GET /email-intake/drafts
```
**Permissions required:** `manage_appointments`

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `status` | string (csv) | Filter by: `pending_review`, `approved`, `dismissed` |
| `has_unresolved_fields` | boolean | Filter to only drafts with flagged fields |
| `cursor` | string | Pagination cursor |
| `limit` | integer | Page size (default 25, max 100) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "status": "pending_review",
      "has_unresolved_fields": true,
      "po_number": "BC-2025-4421",
      "date_time": "2025-06-22T10:00:00Z",
      "patient": { "id": "uuid", "name": "John Smith", "ai_generated": false },
      "clinic": { "id": "uuid", "name": "Downtown Medical", "ai_generated": false },
      "insurance_agency": { "id": "uuid", "name": "BlueCross Health" },
      "languages": ["es"],
      "referring_physician": "Dr. Nguyen",
      "unresolved_fields": ["languages"],
      "email_log_id": "uuid",
      "created_at": "2025-06-15T09:03:45Z"
    }
  ],
  "pagination": { "next_cursor": "eyJ...", "has_more": false }
}
```

---

### 13.4 Review and Publish Email Intake Draft
```
PATCH /email-intake/drafts/:draft_id
```
**Permissions required:** `manage_appointments`

**Notes:**
- Admin reviews extracted fields, corrects any unresolved ones, and either approves or dismisses
- On `status: "approved"`, a real appointment record is created with status `pending_offer` and the PO number is stored on the appointment
- On `status: "dismissed"`, the draft is discarded and the email log is marked accordingly

**Request Body:**
```json
{
  "status": "approved",
  "date_time": "2025-06-22T10:00:00Z",
  "patient_id": "uuid",
  "clinic_id": "uuid",
  "insurance_agency_id": "uuid",
  "type_id": "uuid",
  "languages": ["es"],
  "interpreter_type_required": "certified",
  "referring_physician": "Dr. Nguyen",
  "department": "Cardiology",
  "pre_auth_amount": 120.00,
  "pre_auth_mileage": 30
}
```

**Response `200`:**
```json
{
  "draft_status": "approved",
  "appointment": {
    "id": "uuid",
    "status": "pending_offer",
    "po_number": "BC-2025-4421",
    "date_time": "2025-06-22T10:00:00Z"
  }
}
```

---

### 13.5 Retry Failed Confirmation
```
POST /email-intake/logs/:log_id/retry-confirmation
```
**Permissions required:** `manage_appointments`

**Notes:**
- Manually triggers a re-attempt of the reply email or link confirmation for a failed log entry
- Only valid for logs with `confirmation_status: "failed"`
- Returns `409` if confirmation already succeeded

**Response `202`:**
```json
{ "message": "Confirmation retry enqueued.", "job_id": "uuid" }
```

---

### 13.6 Super-Admin: Email Intake Settings
```
GET /super-admin/settings
PATCH /super-admin/settings
```
**Auth:** Super-admin only (platform-level, not tenant-scoped)

**Settings object:**
```json
{
  "email_polling_interval_minutes": 5,
  "llm_model": "claude-sonnet-4-20250514",
  "llm_prompt_version": "v1.2",
  "max_confirmation_retries": 3,
  "playwright_timeout_seconds": 30
}
```
**Notes:**
- `email_polling_interval_minutes` — how frequently the inbox poller runs across all tenants (default: 5)
- `llm_model` — the Claude model used for extraction; changing this is logged for auditability
- `llm_prompt_version` — references a versioned prompt stored in the codebase; allows rollback if a new prompt performs worse
- `max_confirmation_retries` — how many times the agent retries a failed confirmation before alerting admin
- `playwright_timeout_seconds` — max time the headless browser waits for a confirmation page to load

**Response `200`:** Full settings object.

---

### 13.7 Error Codes (Email Intake)

| Code | HTTP | Meaning |
|---|---|---|
| `EMAIL_LOG_NOT_FOUND` | 404 | Email intake log not found |
| `DRAFT_NOT_FOUND` | 404 | Email intake draft not found |
| `DRAFT_ALREADY_RESOLVED` | 409 | Draft has already been approved or dismissed |
| `CONFIRMATION_ALREADY_SUCCEEDED` | 409 | Cannot retry a successful confirmation |
| `DUPLICATE_PO_NUMBER` | 409 | PO number already exists in the system |
| `UNRECOGNIZED_SENDER` | 422 | Email sender domain not matched to any insurance agency |
| `EXTRACTION_FAILED` | 500 | LLM extraction job failed entirely — email flagged for manual review |
| `CONFIRMATION_FAILED` | 500 | Reply or link confirmation could not be completed |

---

### 7.4 Update Insurance Agency
```
PATCH /insurance-agencies/:id
```
**Permissions required:** `manage_clinics`

**Request Body:** Any subset of the create body fields.

**Response `200`:** Updated insurance agency object.

---

### 7.5 Deactivate Insurance Agency
```
DELETE /insurance-agencies/:id
```
**Permissions required:** `manage_clinics`

**Notes:**
- Soft delete — historical appointment records retained
- Returns `409` if agency has upcoming confirmed appointments

**Response `204`:** No content.

---

### 7.6 Error Codes (Insurance Agencies)

| Code | HTTP | Meaning |
|---|---|---|
| `AGENCY_NOT_FOUND` | 404 | Insurance agency not found or not in tenant |
| `HAS_UPCOMING_APPOINTMENTS` | 409 | Cannot deactivate — has confirmed upcoming appointments |

---

## 8. Patients

### 8.1 List Patients
```
GET /patients
```
**Permissions required:** `manage_appointments`

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `search` | string | Full-text search on name or MRN |
| `language` | string | Filter by preferred language code |
| `cursor` | string | Pagination cursor |
| `limit` | integer | Page size (default 25, max 100) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "John Smith",
      "mrn": "MRN-00123",
      "phone": "+13105550300",
      "email": "jsmith@email.com",
      "preferred_language": "es",
      "created_at": "2025-02-10T09:00:00Z",
      "updated_at": "2025-02-10T09:00:00Z"
    }
  ],
  "pagination": { "next_cursor": "eyJ...", "has_more": false }
}
```

---

### 8.2 Get Patient
```
GET /patients/:id
```
**Permissions required:** `manage_appointments`

**Response `200`:** Full patient object (same as list item).

---

### 8.3 Create Patient
```
POST /patients
```
**Permissions required:** `manage_appointments`

**Request Body:**
```json
{
  "name": "John Smith",
  "mrn": "MRN-00123",
  "phone": "+13105550300",
  "email": "jsmith@email.com",
  "preferred_language": "es"
}
```
**Notes:**
- `mrn` must be unique within the organization
- `preferred_language` must be a language code active in the organization's language list

**Response `201`:** Full patient object.

---

### 8.4 Update Patient
```
PATCH /patients/:id
```
**Permissions required:** `manage_appointments`

**Request Body:** Any subset of the create body fields.

**Response `200`:** Updated patient object.

---

### 8.5 Error Codes (Patients)

| Code | HTTP | Meaning |
|---|---|---|
| `PATIENT_NOT_FOUND` | 404 | Patient not found or not in tenant |
| `MRN_ALREADY_EXISTS` | 409 | MRN is already registered in this organization |
| `INVALID_LANGUAGE` | 422 | Language code is not active in this organization |

---

## 9. Reports

All report endpoints require the `view_reports` permission. Reports are generated asynchronously for large datasets — the API returns a job ID immediately and the client polls for completion.

### 9.1 Generate Report
```
POST /reports
```
**Request Body:**
```json
{
  "type": "interpreter_compensation",
  "format": "pdf",
  "locale": "es",
  "filters": {
    "interpreter_ids": ["uuid", "uuid"],
    "date_from": "2025-06-01",
    "date_to": "2025-06-30"
  },
  "options": {
    "detail_level": "detail_and_summary"
  }
}
```

**Report types and their filters/options:**

| `type` | Required filters | Available options |
|---|---|---|
| `interpreter_compensation` | `date_from`, `date_to` | `interpreter_ids`, `detail_level` (`summary`, `detail_and_summary`, `detail_summary_by_clinic`) |
| `insurance_agency_billing` | `date_from`, `date_to`, `insurance_agency_ids` | `detail_level` (`summary`, `detail_and_summary`) |
| `appointment_history` | `date_from`, `date_to` | `statuses`, `interpreter_ids`, `clinic_ids`, `insurance_agency_ids`, `language`, `type_id` |
| `interpreter_performance` | `date_from`, `date_to` | `interpreter_ids`, `detail_level` (`summary`, `detail`) |

**Notes:**
- `format` must be `pdf` or `csv` (`csv` not available for `interpreter_compensation` PDF layout)
- `locale` defaults to the requesting admin's language setting if omitted
- Report is generated as a background BullMQ job

**Response `202`:**
```json
{
  "job_id": "uuid",
  "status": "pending",
  "estimated_seconds": 5
}
```

---

### 9.2 Get Report Status
```
GET /reports/:job_id
```

**Response `200`:**
```json
{
  "job_id": "uuid",
  "status": "completed",
  "download_url": "https://storage.googleapis.com/pulpito/reports/uuid/report.pdf",
  "expires_at": "2025-06-30T18:00:00Z"
}
```
**Notes:**
- `status` values: `pending`, `processing`, `completed`, `failed`
- `download_url` is a signed GCS URL, valid for 1 hour
- Failed jobs include an `error` field with a human-readable message
- Completed report files are deleted from storage after 24 hours

---

### 9.3 List Recent Reports
```
GET /reports
```

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `type` | string | Filter by report type |
| `cursor` | string | Pagination cursor |
| `limit` | integer | Page size (default 25, max 100) |

**Response `200`:** Paginated list of report job objects (same shape as 9.2, without `download_url` for expired reports).

---

### 9.4 Error Codes (Reports)

| Code | HTTP | Meaning |
|---|---|---|
| `REPORT_NOT_FOUND` | 404 | Report job not found |
| `INVALID_REPORT_TYPE` | 422 | Unknown report type |
| `INVALID_FORMAT` | 422 | Format not supported for this report type |
| `MISSING_REQUIRED_FILTER` | 422 | A required filter for this report type is missing |
| `REPORT_GENERATION_FAILED` | 500 | Background job failed — retry or contact support |

---

## 10. Messages

### 10.1 List Conversations
```
GET /messages/conversations
```
**Auth:** Admin or interpreter JWT

**Notes:**
- Admins see all conversations across all interpreters in the organization
- Interpreters see only their own conversation thread with admin

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "interpreter": { "id": "uuid", "name": "Maria Lopez" },
      "last_message": {
        "body": "Your appointment tomorrow has been updated.",
        "sent_at": "2025-06-14T16:30:00Z",
        "sender_type": "admin"
      },
      "unread_count": 2
    }
  ],
  "pagination": { "next_cursor": "eyJ...", "has_more": false }
}
```

---

### 10.2 Get Messages in Conversation
```
GET /messages/conversations/:interpreter_id
```
**Auth:** Admin or interpreter JWT (interpreter can only access their own)

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `cursor` | string | Pagination cursor (newest first) |
| `limit` | integer | Page size (default 50, max 100) |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "body": "Your appointment tomorrow has been updated.",
      "sender_type": "admin",
      "sender": { "id": "uuid", "name": "Jane Admin" },
      "sent_at": "2025-06-14T16:30:00Z",
      "read_at": null
    }
  ],
  "pagination": { "next_cursor": "eyJ...", "has_more": true }
}
```

---

### 10.3 Send Message
```
POST /messages/conversations/:interpreter_id
```
**Auth:** Admin or interpreter JWT (interpreter can only send to their own thread)

**Request Body:**
```json
{ "body": "Please confirm your availability for tomorrow." }
```
**Notes:**
- Push notification sent to the recipient via FCM
- `body` max 2000 characters

**Response `201`:**
```json
{
  "id": "uuid",
  "body": "Please confirm your availability for tomorrow.",
  "sender_type": "admin",
  "sender": { "id": "uuid", "name": "Jane Admin" },
  "sent_at": "2025-06-14T16:35:00Z",
  "read_at": null
}
```

---

### 10.4 Mark Messages as Read
```
POST /messages/conversations/:interpreter_id/read
```
**Auth:** Admin or interpreter JWT

**Notes:**
- Marks all unread messages in the conversation as read for the authenticated user
- Updates `unread_count` to 0 for this conversation

**Response `200`:**
```json
{ "marked_read": 2 }
```

---

### 10.5 Error Codes (Messages)

| Code | HTTP | Meaning |
|---|---|---|
| `CONVERSATION_NOT_FOUND` | 404 | Interpreter not found or not in tenant |
| `MESSAGE_TOO_LONG` | 422 | Message body exceeds 2000 characters |
| `UNAUTHORIZED_CONVERSATION` | 403 | Interpreter attempting to access another's thread |

---

## 11. System Settings

All system settings endpoints require the `manage_system_settings` permission.

### 11.1 Get System Settings
```
GET /settings
```

**Response `200`:**
```json
{
  "default_pay_rates": {
    "certified": 40.00,
    "qualified": 30.00
  },
  "offer_expiry_default_minutes": 60,
  "languages": [
    { "code": "es", "name": "Spanish", "active": true },
    { "code": "en", "name": "English", "active": true },
    { "code": "zh", "name": "Mandarin", "active": false }
  ],
  "appointment_types": [
    {
      "id": "uuid",
      "name": "In-Person",
      "pay_model": "hourly",
      "minimum_billable_minutes": 120
    },
    {
      "id": "uuid",
      "name": "Phone",
      "pay_model": "flat",
      "minimum_billable_minutes": 60
    }
  ]
}
```

---

### 11.2 Update System Settings
```
PATCH /settings
```

**Request Body:** Any subset of top-level settings fields:
```json
{
  "default_pay_rates": {
    "certified": 42.00,
    "qualified": 32.00
  },
  "offer_expiry_default_minutes": 90
}
```
**Notes:**
- Changing `default_pay_rates` does not retroactively update interpreter pay rates — only affects new interpreters whose pay rate is not individually overridden

**Response `200`:** Full settings object.

---

### 11.3 Create Appointment Type
```
POST /settings/appointment-types
```

**Request Body:**
```json
{
  "name": "Video Call",
  "pay_model": "hourly",
  "minimum_billable_minutes": 60
}
```
**Notes:**
- `pay_model` must be `hourly` or `flat`
- `minimum_billable_minutes` must be a positive integer

**Response `201`:** Appointment type object.

---

### 11.4 Update Appointment Type
```
PATCH /settings/appointment-types/:id
```

**Request Body:** Any subset of create fields.

**Notes:**
- Changing `pay_model` or `minimum_billable_minutes` does not affect already-completed appointments

**Response `200`:** Updated appointment type object.

---

### 11.5 Deactivate Appointment Type
```
DELETE /settings/appointment-types/:id
```

**Notes:**
- Soft delete — existing appointments of this type are unaffected
- Deactivated types cannot be assigned to new appointments
- Returns `409` if type has upcoming confirmed appointments

**Response `204`:** No content.

---

### 11.6 Update Language List
```
PATCH /settings/languages
```

**Request Body:**
```json
{
  "languages": [
    { "code": "es", "name": "Spanish", "active": true },
    { "code": "zh", "name": "Mandarin", "active": true },
    { "code": "tl", "name": "Tagalog", "active": false }
  ]
}
```
**Notes:**
- Language codes follow IETF BCP 47 (e.g. `es`, `zh`, `tl`, `ar`)
- Deactivating a language does not affect existing appointments using it
- Deactivated languages are hidden from appointment creation forms

**Response `200`:** Full updated language list.

---

### 11.7 Get Localization Strings
```
GET /settings/localization/:locale
```

**Notes:**
- Returns the merged result of base locale strings + any tenant overrides for the given locale
- `locale` must be a code in the organization's language list

**Response `200`:**
```json
{
  "locale": "es",
  "strings": {
    "appointment.status.confirmed": "Confirmada",
    "interpreter.type.certified": "Certificado",
    "nav.appointments": "Citas"
  }
}
```

---

### 11.8 Update Localization Strings
```
PATCH /settings/localization/:locale
```

**Request Body:**
```json
{
  "strings": {
    "nav.appointments": "Turnos"
  }
}
```
**Notes:**
- Only tenant-specific overrides are stored; base strings from locale files are not modified
- Sending an empty string for a key resets it to the base locale default

**Response `200`:** Full merged locale strings object for the locale.

---

### 11.9 Error Codes (System Settings)

| Code | HTTP | Meaning |
|---|---|---|
| `APPOINTMENT_TYPE_NOT_FOUND` | 404 | Appointment type not found |
| `INVALID_PAY_MODEL` | 422 | `pay_model` must be `hourly` or `flat` |
| `INVALID_LANGUAGE_CODE` | 422 | Language code is not a valid BCP 47 code |
| `HAS_UPCOMING_APPOINTMENTS` | 409 | Cannot deactivate appointment type with upcoming confirmed appointments |
| `LOCALE_NOT_SUPPORTED` | 422 | Locale is not in the organization's active language list |

---

## 12. Follow-Up Confirmation Flow

The follow-up flow is triggered automatically when an interpreter clocks out. It is managed via BullMQ background jobs and delivered via push notification (default) or SMS (per interpreter preference).

### 12.1 Submit Follow-Up Response (Interpreter)
```
POST /appointments/:id/follow-up
```
**Auth:** Interpreter JWT only

**Notes:**
- This endpoint is called by the mobile app when the interpreter responds to the automated follow-up prompt
- Appointment must be in `completed` status
- If `has_follow_up` is `true`, a draft appointment is created automatically and admin is notified per their notification preference
- Media files are uploaded separately via 12.2 and linked to the follow-up response

**Request Body:**
```json
{
  "has_follow_up": true,
  "same_physician": true,
  "same_clinic": false,
  "follow_up_datetime": "next Tuesday at 10am",
  "notes": "Patient mentioned they need a different clinic location."
}
```

**Notes on fields:**
- `has_follow_up`: required — `true` or `false`
- `same_physician`: required if `has_follow_up` is `true`
- `same_clinic`: required if `has_follow_up` is `true`
- `follow_up_datetime`: required if `has_follow_up` is `true`; free text string — admin reviews and formalizes into a proper datetime when reviewing the draft
- `notes`: optional additional context from the interpreter

**Response `201`:**
```json
{
  "follow_up_response": {
    "id": "uuid",
    "has_follow_up": true,
    "same_physician": true,
    "same_clinic": false,
    "follow_up_datetime": "next Tuesday at 10am",
    "notes": "Patient mentioned they need a different clinic location.",
    "media": [],
    "draft_appointment_id": "uuid",
    "submitted_at": "2025-06-15T15:25:00Z"
  }
}
```

---

### 12.2 Attach Media to Follow-Up Response (Interpreter)
```
POST /appointments/:id/follow-up/media
```
**Auth:** Interpreter JWT only

**Request:** `multipart/form-data` with field `file` (JPEG, PNG, or PDF, max 10MB per file)

**Notes:**
- Can be called multiple times to attach multiple files
- Files uploaded to Google Cloud Storage and linked to the follow-up response record
- Appointment must have a submitted follow-up response (12.1 must be called first)

**Response `201`:**
```json
{
  "media": {
    "id": "uuid",
    "url": "https://storage.googleapis.com/pulpito/follow-ups/uuid/photo.jpg",
    "type": "image/jpeg",
    "filename": "photo.jpg",
    "uploaded_at": "2025-06-15T15:27:00Z"
  }
}
```

---

### 12.3 List Follow-Up Drafts (Admin)
```
GET /appointments/follow-up-drafts
```
**Permissions required:** `manage_appointments`

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by draft status: `pending_review`, `scheduled`, `dismissed` |
| `cursor` | string | Pagination cursor |
| `limit` | integer | Page size (default 25, max 100) |

**Notes:**
- Returns draft appointments created from interpreter follow-up confirmations, ordered by creation date descending
- Each item includes the original appointment, the interpreter's follow-up response, and any attached media

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "status": "pending_review",
      "created_from_appointment": { "id": "uuid", "date_time": "2025-06-15T14:00:00Z" },
      "patient": { "id": "uuid", "name": "John Smith" },
      "clinic": { "id": "uuid", "name": "Downtown Medical" },
      "interpreter": { "id": "uuid", "name": "Maria Lopez" },
      "follow_up_response": {
        "same_physician": true,
        "same_clinic": false,
        "follow_up_datetime": "next Tuesday at 10am",
        "notes": "Patient mentioned they need a different clinic location.",
        "media": [
          { "id": "uuid", "url": "https://storage.googleapis.com/...", "type": "image/jpeg" }
        ]
      },
      "created_at": "2025-06-15T15:25:00Z"
    }
  ],
  "pagination": { "next_cursor": "eyJ...", "has_more": false }
}
```

---

### 12.4 Review and Publish Follow-Up Draft (Admin)
```
PATCH /appointments/follow-up-drafts/:draft_id
```
**Permissions required:** `manage_appointments`

**Notes:**
- Admin reviews the interpreter's free-text follow-up datetime and formalizes it into a proper appointment
- On `status: "scheduled"`, the draft is converted to a real appointment in `pending_offer` status
- On `status: "dismissed"`, the draft is discarded

**Request Body:**
```json
{
  "status": "scheduled",
  "date_time": "2025-06-22T10:00:00Z",
  "clinic_id": "uuid",
  "insurance_agency_id": "uuid",
  "pre_auth_amount": 120.00,
  "pre_auth_mileage": 30,
  "notes": "Different clinic as patient requested."
}
```

**Response `200`:**
```json
{
  "draft_status": "scheduled",
  "appointment": { "id": "uuid", "status": "pending_offer", "date_time": "2025-06-22T10:00:00Z" }
}
```

---

### 12.5 Get Follow-Up Response for Appointment (Admin)
```
GET /appointments/:id/follow-up
```
**Permissions required:** `manage_appointments`

**Response `200`:** Full follow-up response object including all media attachments, or `404` if no follow-up response exists for this appointment.

---

### 12.6 Admin Notification Preferences
```
PATCH /admin-users/me/preferences
```
**Auth:** Admin JWT only

**Request Body:**
```json
{
  "follow_up_notification": {
    "push": true,
    "email_immediate": false,
    "email_digest": true,
    "email_digest_times": ["08:00", "13:00", "17:00"]
  },
  "language": "es"
}
```
**Notes:**
- `push`: send immediate push notification to admin's phone when a follow-up draft is created
- `email_immediate`: send immediate email on each new follow-up draft
- `email_digest`: send a digest email at configured times summarizing all new follow-up drafts since the last digest
- `email_digest_times`: array of HH:MM times (in the admin's timezone) at which digests are sent
- All flags can be combined; setting all to `false` means follow-up drafts appear silently in the review queue only

**Response `200`:** Updated preferences object.

---

### 12.7 Error Codes (Follow-Up Flow)

| Code | HTTP | Meaning |
|---|---|---|
| `FOLLOW_UP_ALREADY_SUBMITTED` | 409 | A follow-up response has already been submitted for this appointment |
| `APPOINTMENT_NOT_COMPLETED` | 422 | Follow-up can only be submitted for completed appointments |
| `NO_FOLLOW_UP_RESPONSE` | 404 | No follow-up response exists for this appointment |
| `DRAFT_NOT_FOUND` | 404 | Follow-up draft not found |
| `DRAFT_ALREADY_RESOLVED` | 409 | Draft has already been scheduled or dismissed |
| `MISSING_FOLLOW_UP_DATETIME` | 422 | `follow_up_datetime` is required when `has_follow_up` is true |
| `FILE_TOO_LARGE` | 422 | Attached file exceeds 10MB |
| `INVALID_FILE_TYPE` | 422 | Only JPEG, PNG, and PDF are accepted |


