// Seeds built-in categories into the Catalyst Data Store.
// Needs admin credentials: run inside `catalyst shell`, or set
// CATALYST_PROJECT_ID, CATALYST_PROJECT_KEY, CATALYST_PROJECT_DOMAIN,
// CATALYST_ENVIRONMENT and a ZOHO_OAUTH_TOKEN (see README → Seeding).
import { createRequire } from 'node:module';
import { createCatalystRepo } from '@vt/fn-common';
import { seedBuiltInCategories } from './seed-lib.mjs';

const require = createRequire(import.meta.url);
const catalyst = require('zcatalyst-sdk-node');

const env = process.env;
const app = catalyst.initializeApp({
  projectId: env.CATALYST_PROJECT_ID,
  projectKey: env.CATALYST_PROJECT_KEY,
  projectDomain: env.CATALYST_PROJECT_DOMAIN,
  environment: env.CATALYST_ENVIRONMENT || 'Development',
  credential: catalyst.credential.accessToken(env.ZOHO_OAUTH_TOKEN),
});
const n = await seedBuiltInCategories(createCatalystRepo(app));
console.log(`Seeded ${n} built-in categories.`);
