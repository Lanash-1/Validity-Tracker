# Validity Tracker

Track the validity of anything with a date: food best-before dates, cosmetics
(months after opening), medicines, documents, warranties, offers, coupons and
subscriptions. The home screen answers *what expires first?* and reminders
arrive before things lapse. Items live in a private **personal space** or in
**shared spaces** (home, office) that anyone can join with an invite code.

| Client | Where | Notes |
|---|---|---|
| Android app | `apps/mobile` | Expo / React Native, Google sign-in, barcode scanner, photos, push reminders |
| Web app (PWA) | `apps/mobile` (same code, `expo export --platform web`) | Google Identity Services sign-in, Web Push |
| Chrome extension | `apps/extension` | Save offers/validity dates from any page, expiring-soon popup, badge |
| API | `functions/api` | Zoho Catalyst Advanced I/O function (Express) |
| Reminders | `functions/reminders-cron` | Zoho Catalyst Cron function, runs hourly |
| Shared code | `packages/shared`, `functions/common` | zod schemas, expiry rules, API client, repositories, push |

## How it fits together

```
 Android (Expo)  ──┐                       ┌─ Data Store (Catalyst)
 Web (Expo web)  ──┼─ HTTPS /api/v1 ─► api ┼─ File Store (photos)
 Extension (WXT) ──┘      (Express)        └─ Open Food Facts (barcodes)
                                 ▲
        Expo Push ◄── reminders-cron (hourly) ──► Web Push (VAPID)
```

- **Auth.** Each client obtains a Google ID token natively. `POST /api/v1/auth/google`
  verifies it and issues our own short-lived access token plus a rotating refresh
  token. Catalyst Authentication is not used because it has no React Native SDK and
  its web SDK is iframe/cookie based.
- **Expiry rules** (`packages/shared/src/expiry.ts`): `fixed` → expiry date;
  `period` → end date (start date shown as "starts in"); `after_opening` →
  min(printed expiry, opened + PAO months); `review` → review date. The API stores
  the computed `effective_expiry`, which everything sorts and reminds on.
- **Reminders** fire at 09:00 in each member's time zone: a lead reminder (item
  override → category default → 3 days), one on the day and one the day after
  expiry, de-duplicated in `reminder_log`. More than three due at once become a digest.

## Prerequisites

- Node 22+, pnpm 10 (`corepack enable`)
- A Zoho Catalyst project (free tier is enough) and the Catalyst CLI: `npm i -g zcatalyst-cli`
- Google Cloud OAuth client IDs: one **Web** (used by web, extension and the
  Android SDK's `webClientId`) and one **Android** (package `com.validitytracker.app`)
- For Android builds: Android Studio or an EAS account (`npm i -g eas-cli`)

## Local development (no Catalyst needed)

```bash
pnpm install
pnpm --filter @vt/shared build

# API in memory mode with a fake Google sign-in (POST /auth/google with idToken "dev:you@example.com")
pnpm dev:api                                  # http://localhost:3000/api/v1

# Web app
cd apps/mobile && cp .env.example .env         # EXPO_PUBLIC_API_URL=http://localhost:3000, EXPO_PUBLIC_DEV_SIGNIN=1
pnpm web                                       # opens http://localhost:8081

# Extension
cd apps/extension && pnpm dev                  # loads into Chromium via WXT; set the URL in the popup's settings
```

Run everything that can run headlessly:

```bash
pnpm typecheck && pnpm test
```

`tools/e2e/` has Playwright smoke tests for the web build and the extension
(`web-smoke.mjs`, `extension-smoke.mjs`); see `tools/e2e/README.md`.

## Deploying to Zoho Catalyst

1. **Create the project** in the Catalyst console, then `catalyst login` and
   `catalyst init` *is not needed* — `catalyst.json` already lists the two functions.
   Create `.catalystrc` by running `catalyst project:use` (or copy the project id,
   key and domain from the console).
2. **Data Store.** Create the tables and columns listed in `functions/DATASTORE.md`
   (Development and Production). Create a File Store folder `item-photos`.
3. **Environment variables** for both functions (console → Functions → Configuration),
   documented in `functions/api/.env.example` and `functions/reminders-cron/.env.example`:
   `JWT_SECRET`, `GOOGLE_CLIENT_IDS`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`
   (`npx web-push generate-vapid-keys`), `VAPID_SUBJECT`, `PHOTO_FOLDER_ID`,
   `CORS_ORIGINS`, optional `EXPO_ACCESS_TOKEN`.
4. **Build and deploy.**
   ```bash
   pnpm --filter @vt/shared build
   pnpm --filter api build && pnpm --filter reminders-cron build    # writes dist/ bundles
   catalyst deploy --only functions
   ```
   The bundles include `@vt/shared` and npm dependencies; only `zcatalyst-sdk-node`
   is left external and installed from each function's `package.json`.
5. **Seed categories.** `pnpm --filter api seed` with `CATALYST_PROJECT_ID`,
   `CATALYST_PROJECT_KEY`, `CATALYST_PROJECT_DOMAIN`, `CATALYST_ENVIRONMENT` and a
   `ZOHO_OAUTH_TOKEN` in the environment (or call the seed from `catalyst shell`).
6. **Cron.** Console → Cron → create a cron targeting `reminders-cron`, every 1 hour.
7. **Web client.** `cd apps/mobile && EXPO_PUBLIC_API_URL=https://<project>.catalystserverless.com npx expo export --platform web`
   and host `dist/` with Catalyst Web Client Hosting (set `client.source` in
   `catalyst.json` to that folder). The API URL for Advanced I/O functions is
   `https://<project>.catalystserverless.com/server/api/api/v1/...`; the Express app
   also accepts the bare `/api/v1` prefix, so put a rewrite or use the full URL in
   `EXPO_PUBLIC_API_URL`.

## Android

```bash
cd apps/mobile
cp .env.example .env     # set EXPO_PUBLIC_API_URL and the Google client ids
eas build --profile development --platform android   # or: npx expo run:android
```

Google sign-in on Android uses `@react-native-google-signin/google-signin`, which
needs a development build (not Expo Go). Push notifications go through Expo's
push service; configure FCM credentials in EAS (`eas credentials`).

## Extension

```bash
cd apps/extension
WXT_API_URL=https://<project>.catalystserverless.com pnpm build   # → .output/chrome-mv3
```

Load `.output/chrome-mv3` as an unpacked extension. In the popup choose **Sign in**:
it opens the web app's `/extension-auth` page, which hands the session to the
extension. Select text on any page and right-click **Track validity** to capture
dates such as "valid from 1 Nov to 15 Nov" into a prefilled form.

## Repository layout

```
packages/shared          types, zod schemas, date & expiry logic, API client (tested)
functions/common         config, repository interface (memory + Catalyst), push, reminder engine (tested)
functions/api            Express API, routes, auth, photo storage, dev server, seed (tested)
functions/reminders-cron hourly reminder sweep
apps/mobile              Expo app (Android + web)
apps/extension           WXT Chrome extension
tools/e2e                Playwright smoke tests
```

## Known gaps

- Offline *writes* queue is not implemented; lists work offline from the cache.
- Data Store tables are created by hand (see `functions/DATASTORE.md`).
- Icons are generated placeholders.
