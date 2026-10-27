# Web smoke test

Drives the exported web app in headless Chromium against the in-memory API.

```bash
# 1. API in memory mode with fake Google sign-in
PORT=3123 pnpm --filter api dev &
# 2. Export the web app pointed at it
cd apps/mobile && EXPO_PUBLIC_API_URL=http://localhost:3123 EXPO_PUBLIC_DEV_SIGNIN=1 npx expo export --platform web --output-dir /tmp/vt-web && cd ../..
# 3. Serve it and run the flow (needs `npx playwright install chromium` once)
node tools/e2e/serve-static.mjs /tmp/vt-web 8080 &
node tools/e2e/web-smoke.mjs /tmp/vt-shots
```

The script signs in, adds a fixed-expiry item and a validity-period offer,
checks the home list, calendar and search, creates a shared space, and marks
an item as used up. Screenshots land in the directory given as the argument.
