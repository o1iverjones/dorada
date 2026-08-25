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

## CRITICAL security gate — verify BEFORE/at cutover

- **`APP_ENV` MUST equal `production` on the prod API service.** All `/api/v1/auth/dev/*`
  routes are unauthenticated backdoors — `/dev/otp/:phone` returns *any interpreter's
  login code* (account takeover), `/dev/sms-test` sends arbitrary SMS on your account,
  `/dev/reset/:phone` clears rate limits. They are enabled only when `APP_ENV === "dev"`.
  The config default is `production` and the value is enum-constrained to `dev|production`,
  so this is safe unless someone explicitly set `APP_ENV=dev` on prod. Verify with:
  `curl -s -X POST https://api.dorada.app/api/v1/auth/dev/sms-test -d '{}'` → must return
  **404 Route not found** (not a JSON body). If it returns anything else, the backdoors
  are LIVE on prod — fix `APP_ENV` immediately.

## One-time actions at cutover (order matters)

1. Merge `refactor` → `main`; wait for the production deploy to finish
   (the `add_performance_indexes` migration applies automatically).
2. Run the `APP_ENV` backdoor check above — confirm `/dev/*` routes 404.
3. Verify images, reports, and avatars load in production
   (they now resolve through short-lived signed URLs).
4. **Cloudflare dashboard → R2 → bucket → Settings → disable Public access.**
   Do this only AFTER step 3 checks out. Old avatar URLs cached in logged-in
   browsers break at this moment; a re-login fixes them.
5. Confirm interpreter OTP login (Sinch) works in production with a real
   interpreter number (the `/dev/sms-test` diagnostic is prod-disabled by design —
   Sinch is confirmed working end-to-end on dev as of 2026-07).
6. Watch the API deploy logs for the `CORS_ORIGIN is not set` warning —
   if it appears, the env var didn't take.

## Already set (verify only)

- `SINCH_PROJECT_ID`, `SINCH_KEY_ID`, `SINCH_KEY_SECRET`, `SINCH_APP_ID`,
  `SINCH_FROM_NUMBER` — set on prod 2026-07 during the Twilio → Sinch switch.
- `RESEND_API_KEY` — password-reset + transactional email.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_BUCKET`, `R2_PUBLIC_URL`.
