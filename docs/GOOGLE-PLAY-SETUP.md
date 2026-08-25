# Google Play — service account setup for `eas submit`

One-time setup so `eas submit --platform android` can upload builds to the Play
Console without manual drag-and-drop. Do this **after** the Play Console account
(Organization) clears verification and the app listing for `com.dorada.app`
exists. Budget ~15 minutes.

The goal: a **service account JSON key** saved as
`apps/mobile/google-service-account.json` (already referenced by `eas.json` →
`submit.production.android.serviceAccountKeyPath`, and already gitignored).

---

## Part A — Google Cloud Console: create the service account + key

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**, signed
   in with the **same Google account** that owns the Play Console.
2. **Create (or select) a project** — e.g. name it `dorada-play`. A dedicated
   project keeps this credential isolated.
3. **Enable the Play Developer API:**
   APIs & Services → **Library** → search **"Google Play Android Developer API"**
   → **Enable**.
4. **Create the service account:**
   IAM & Admin → **Service Accounts** → **Create service account**.
   - Name: `eas-play-publisher`
   - **Skip** the optional "grant this service account access to the project"
     step — permissions are granted in the Play Console instead (Part B), not
     at the GCP project level.
   - Click **Done**.
5. **Create a JSON key:**
   Click the new service account → **Keys** tab → **Add key** → **Create new key**
   → **JSON** → **Create**. A `.json` file downloads. **This is a secret** —
   treat it like a password.
6. **Copy the client email** for Part B: open the JSON and note the
   `"client_email"` value (looks like
   `eas-play-publisher@dorada-play.iam.gserviceaccount.com`).

## Part B — Play Console: grant the service account access

1. Go to **[play.google.com/console](https://play.google.com/console)**.
2. **Users and permissions** (account-level, left sidebar) → **Invite new users**.
3. Email address: paste the service account's **`client_email`** from step A6.
4. **Permissions** — least-privilege set that `eas submit` needs:
   - **View app information and download bulk reports**
   - **Manage testing track releases**
   - **Manage production releases**
   - **Create and edit draft apps**

   (If you'd rather not fuss: **Admin (all permissions)** also works but grants
   more than needed. Prefer the specific set above.)
5. **Invite user.** Service accounts auto-accept — no email confirmation needed.

## Part C — wire it into the repo

1. Move the downloaded key to the exact path `eas.json` expects:
   ```bash
   mv ~/Downloads/<downloaded-key>.json \
      /Users/macbook/Documents/Pulpito-Dev/Dev/apps/mobile/google-service-account.json
   ```
2. Confirm it is **gitignored** (it already is — verify, never commit it):
   ```bash
   git -C /Users/macbook/Documents/Pulpito-Dev/Dev check-ignore \
     apps/mobile/google-service-account.json   # must print the path
   ```
3. Verify the reference in `apps/mobile/eas.json` (already set):
   ```json
   "submit": { "production": { "android": {
     "serviceAccountKeyPath": "./google-service-account.json",
     "track": "internal"
   }}}
   ```

## Part D — first upload

```bash
cd apps/mobile
eas build  --platform android --profile production   # produces an AAB
eas submit --platform android --profile production   # uploads to the internal track
```

- The **first** `eas submit` may need the app to already exist in Play Console
  with **one manual AAB uploaded** — Google blocks API uploads until the very
  first release of a brand-new app is created by hand. If `eas submit` errors
  with "only releases with status draft may be created / app not found," do one
  manual upload in the Console (Internal testing → Create release → upload the
  AAB from the `eas build` step), then all future submits go through the API.
- After that: **Internal testing → Closed testing → Production** promotion in the
  Console when ready.

## Notes

- **Account type reminder:** as an **Organization** account you are exempt from
  Google's "~12 testers for 14 days" closed-testing requirement that applies to
  new personal accounts. Reuse the **D-U-N-S number** from the Apple org
  enrollment for Google's business verification.
- **Signing:** the app is signed with the EAS-managed keystore
  (`apps/mobile/credentials.json`). Enable **Google Play App Signing** when
  prompted on the first release (recommended) — Google holds the app signing key
  and you keep the upload key.
- **Package name** `com.dorada.app` must match between the app listing and the
  build. It already does.
