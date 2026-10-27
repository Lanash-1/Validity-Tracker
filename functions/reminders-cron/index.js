'use strict';
// Catalyst Cron entry point. Schedule: every hour (console → Cron → create,
// target this function, "Every 1 hour"). `pnpm build` writes dist/handler.js.
const { runCron } = require('./dist/handler.js');

module.exports = async (cronDetails, context) => {
  try {
    const summary = await runCron(cronDetails);
    console.log('reminder sweep done', JSON.stringify(summary));
    context.closeWithSuccess();
  } catch (err) {
    console.error('reminder sweep failed', err);
    context.closeWithFailure();
  }
};
