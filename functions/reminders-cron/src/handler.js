import { createCatalystRepo, loadConfig, runReminderSweep } from '@vt/fn-common';

/**
 * Runs one reminder sweep against Catalyst. The engine itself lives in
 * @vt/fn-common (`runReminderSweep`) and is unit-tested there against the
 * in-memory repo; this file only wires Catalyst in.
 *
 * @param {any} cronDetails  the object Catalyst passes to cron functions
 */
export async function runCron(cronDetails) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const catalyst = require('zcatalyst-sdk-node');
  const app = catalyst.initialize(cronDetails, { scope: 'admin' });
  const config = loadConfig();
  const repo = createCatalystRepo(app);
  return runReminderSweep(repo, {
    push: { vapid: config.vapid, expoAccessToken: config.expoAccessToken },
    now: new Date(),
  });
}
