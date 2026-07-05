# Production cutover checklist — `refactor` → `main`

Environment variables and one-time actions required on the **production** Railway
services when the refactor branch merges to `main`. Keep this file updated as the
refactor progresses; delete it after the cutover is complete.

## Production API service — env vars

| Variable | Value | Why |
|---|---|---|
| `CORS_ORIGIN` | `https://app.dorada.app` | API now logs a warning and reflects all origins when unset. Setting it enables the strict allowlist. Comma-separate if additional origins are ever needed. |
| `APP_URL` | `https://app.dorada.app` | Used to build password-reset email links. Defaults to this value, but set it explicitly so it never silently changes. |
| `R2_SECRET_ACCESS_KEY` | *(same value as current `R2_SECRET_ACCESS_ID`)* | Canonical name; the legacy `R2_SECRET_ACCESS_ID` spelling still works as a fallback, but migrate and then delete the old var. |

## Dev API service — env vars (same reasons, dev values)

| Variable | Value |
|---|---|
| `CORS_ORIGIN` | `https://web-dev-8acf.up.railway.app` |
| `APP_URL` | `https://web-dev-8acf.up.railway.app` |
| `R2_SECRET_ACCESS_KEY` | *(same value as `R2_SECRET_ACCESS_ID`, then delete old)* |

## One-time actions at cutover (order matters)

1. Merge `refactor` → `main`; wait for the production deploy to finish
   (the `add_performance_indexes` migration applies automatically).
2. Verify images, reports, and avatars load in production
   (they now resolve through short-lived signed URLs).
3. **Cloudflare dashboard → R2 → bucket → Settings → disable Public access.**
   Do this only AFTER step 2 checks out. Old avatar URLs cached in logged-in
   browsers break at this moment; a re-login fixes them.
4. Confirm interpreter OTP login (Sinch) still works in production.
5. Watch the API deploy logs for the `CORS_ORIGIN is not set` warning —
   if it appears, the env var didn't take.

## Already set (verify only)

- `SINCH_PROJECT_ID`, `SINCH_KEY_ID`, `SINCH_KEY_SECRET`, `SINCH_APP_ID`,
  `SINCH_FROM_NUMBER` — set on prod 2026-07 during the Twilio → Sinch switch.
- `RESEND_API_KEY` — password-reset + transactional email.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_BUCKET`, `R2_PUBLIC_URL`.
