// Loads the built extension into Chromium, signs in on the web app, verifies the
// token hand-off to the extension, and checks the popup shows items.
// Usage: node tools/e2e/extension-smoke.mjs <extension-dir> <shots-dir>
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright');

const [extDir, shots] = process.argv.slice(2);
const web = 'http://localhost:8080';
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'vt-ext-')), {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
  viewport: { width: 1100, height: 800 },
});
const errors = [];
ctx.on('page', (p) => {
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
});

let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const extId = new URL(sw.url()).host;
console.log('extension id', extId);

// Point the extension at the local web app / API.
await sw.evaluate(async (apiUrl) => { await chrome.storage.local.set({ 'vt.settings': { apiUrl, defaultSpaceId: '' } }); }, 'http://localhost:3123');

// 1. Popup before sign-in.
const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${extId}/popup.html`);
await popup.getByRole('button', { name: 'Sign in' }).waitFor({ timeout: 10000 });
await popup.screenshot({ path: `${shots}/ext-01-signed-out.png` });

// 2. Sign in on the web app and add an item.
const app = await ctx.newPage();
await app.goto(web + '/', { waitUntil: 'networkidle' });
await app.getByPlaceholder('email').fill('ext-tester@example.com');
await app.getByRole('button', { name: 'Sign in as developer' }).click();
await app.getByText('Nothing tracked yet').waitFor({ timeout: 15000 });
await app.goto(web + '/items/new', { waitUntil: 'networkidle' });
await app.getByPlaceholder('e.g. Marie biscuits').fill('Gym membership');
await app.getByText('+1 wk', { exact: true }).last().click();
await app.getByRole('button', { name: 'Add item', exact: true }).last().click();
await app.locator('text=Expires in 7 days >> visible=true').first().waitFor({ timeout: 15000 });

// 3. Hand-off page sends the tokens to the extension.
await app.goto(`${web}/extension-auth?ext=${extId}`, { waitUntil: 'networkidle' });
await app.locator('text=Extension connected >> visible=true').first().waitFor({ timeout: 15000 });
await app.screenshot({ path: `${shots}/ext-02-handoff.png` });

// 4. Popup now lists the item; badge reflects nothing within 3 days.
await popup.reload();
await popup.getByText('Gym membership').waitFor({ timeout: 15000 });
await popup.screenshot({ path: `${shots}/ext-03-popup-list.png` });
const badge = await sw.evaluate(() => chrome.action.getBadgeText({}));
console.log('badge text:', JSON.stringify(badge));

// 5. Quick add from the popup with a parsed phrase.
await popup.getByRole('button', { name: 'Add' }).click();
await popup.getByPlaceholder('e.g. Diwali 20% off coupon').fill('Offer valid from 1 Nov 2026 to 15 Nov 2026');
// Simulate what "Use selected text" does by reusing the parser through the UI: pick period and dates.
await popup.getByRole('button', { name: 'Valid from–to' }).click();
await popup.locator('input[type=date]').nth(0).fill('2026-11-01');
await popup.locator('input[type=date]').nth(1).fill('2026-11-15');
await popup.getByRole('button', { name: 'Save to Validity Tracker' }).click();
await popup.getByText(/Saved “/).waitFor({ timeout: 15000 });
await popup.screenshot({ path: `${shots}/ext-04-quick-add.png` });

// 6. Context-menu capture path: store a pending capture like the background does, reopen popup.
await sw.evaluate(async () => {
  await chrome.storage.session.set({ 'vt.pendingCapture': { text: 'Coupon expires on 30 November 2026', title: 'Shoe Store | Deals', url: 'https://shop.example/deal', createdAt: Date.now() } });
});
await popup.reload();
await popup.getByText('Dates read from').waitFor({ timeout: 15000 });
const endVal = await popup.locator('input[type=date]').first().inputValue();
console.log('captured end date:', endVal);
await popup.screenshot({ path: `${shots}/ext-05-capture.png` });

console.log(endVal === '2026-11-30' ? 'EXT E2E OK' : 'EXT E2E DATE MISMATCH');
if (errors.length) { console.log('Browser errors:'); for (const e of errors) console.log(' -', e); }
await ctx.close();
