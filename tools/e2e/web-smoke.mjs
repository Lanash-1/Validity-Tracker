import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = 'http://localhost:8080';
const shots = process.argv[2];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push('reqfail: ' + r.url() + ' ' + r.failure()?.errorText); });

await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.screenshot({ path: `${shots}/01-signin.png` });
await page.getByPlaceholder('email').fill('tester@example.com');
await page.getByRole('button', { name: 'Sign in as developer' }).click();
await page.getByText('Nothing tracked yet').waitFor({ timeout: 15000 });
await page.screenshot({ path: `${shots}/02-empty-home.png` });

// Add an item via the FAB.
await page.getByLabel('Add item').click();
await page.getByPlaceholder('e.g. Marie biscuits').fill('Marie biscuits');
await page.getByRole('button', { name: '🍪 Food' }).last().click();
await page.getByText('+1 wk', { exact: true }).last().click();
await page.getByPlaceholder('e.g. 2').fill('2');
await page.getByRole('button', { name: 'pack', exact: true }).last().click();
await page.getByPlaceholder('Fridge, bathroom shelf, wallet…').fill('Pantry');
await page.screenshot({ path: `${shots}/03-add-form.png`, fullPage: true });
await page.getByRole('button', { name: 'Add item', exact: true }).last().click();
await page.locator('text=Expires in 7 days >> visible=true').first().waitFor({ timeout: 15000 });
await page.screenshot({ path: `${shots}/04-item-detail.png`, fullPage: true });

// Add a second item (offer, period type) and one already expired, then check the home list.
for (const it of [
  { name: 'Diwali 20% off', type: 'Valid from–to', dates: ['Today', '+2 wk'] },
]) {
  await page.goto(base + '/items/new', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('e.g. Marie biscuits').fill(it.name);
  await page.getByRole('button', { name: it.type, exact: true }).last().click();
  await page.getByText(it.dates[0], { exact: true }).last().click();
  await page.getByText(it.dates[1], { exact: true }).last().click();
  await page.getByRole('button', { name: 'Add item', exact: true }).last().click();
  await page.locator('text=Ends in 14 days >> visible=true').first().waitFor({ timeout: 15000 });
}
await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.locator('text=Marie biscuits >> visible=true').first().waitFor({ timeout: 15000 });
await page.locator('text=Diwali 20% off >> visible=true').first().waitFor();
await page.screenshot({ path: `${shots}/05-home-list.png`, fullPage: true });

// Calendar shows badges.
await page.goto(base + '/calendar', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${shots}/06-calendar.png`, fullPage: true });

// Search finds by brand-less name.
await page.goto(base + '/search', { waitUntil: 'networkidle' });
await page.getByPlaceholder('Search name, brand, notes or barcode').fill('diwali');
await page.locator('text=Diwali 20% off >> visible=true').first().waitFor({ timeout: 15000 });

// Spaces: create a shared space and see its invite code.
await page.goto(base + '/spaces', { waitUntil: 'networkidle' });
await page.getByPlaceholder('e.g. Home').fill('Home');
await page.getByRole('button', { name: 'Create' }).click();
await page.locator('text=Invite people >> visible=true').first().waitFor({ timeout: 15000 });
await page.screenshot({ path: `${shots}/07-space.png`, fullPage: true });

// Mark the biscuits used up from the detail page.
await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.locator('text=Marie biscuits >> visible=true').first().click();
await page.getByRole('button', { name: /Used up all|Mark as used up/ }).last().click();
await page.locator('text=Restore to active >> visible=true').first().waitFor({ timeout: 15000 });

console.log('E2E OK');
if (errors.length) { console.log('Browser errors:'); for (const e of errors) console.log(' -', e); }
await browser.close();
