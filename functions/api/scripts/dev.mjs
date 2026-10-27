// Runs the API locally against the in-memory repo with fake Google sign-in.
// Sign in with: POST /api/v1/auth/google { "idToken": "dev:you@example.com:Your Name", "platform": "web" }
import { createMemoryApp } from '../src/app.js';
import { seedBuiltInCategories } from './seed-lib.mjs';

const port = Number(process.env.PORT || 3000);
const app = createMemoryApp();
await seedBuiltInCategories(app.ctx.repo);
app.listen(port, () => {
  console.log(`Validity Tracker API (memory mode) listening on http://localhost:${port}/api/v1`);
});
