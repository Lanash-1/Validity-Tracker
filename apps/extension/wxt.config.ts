import { defineConfig } from 'wxt';

// Origins allowed to hand session tokens to the extension (the web app).
const webOrigins = (process.env.WXT_WEB_ORIGINS ?? 'https://*.catalystserverless.com/*,http://localhost:8081/*,http://localhost:8080/*,http://localhost:3000/*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: '.',
  manifest: {
    name: 'Validity Tracker',
    description: 'Save offers, coupons and expiry dates from any page and get reminded before they lapse.',
    permissions: ['storage', 'contextMenus', 'alarms', 'notifications', 'activeTab', 'scripting'],
    host_permissions: ['<all_urls>'],
    externally_connectable: { matches: webOrigins },
    action: { default_title: 'Validity Tracker' },
  },
  vite: () => ({
    define: {
      'import.meta.env.WXT_API_URL': JSON.stringify(process.env.WXT_API_URL ?? 'http://localhost:3000'),
    },
  }),
});
