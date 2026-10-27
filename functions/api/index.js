'use strict';
// Catalyst Advanced I/O entry point. `pnpm build` writes dist/app.js.
const { createApp } = require('./dist/app.js');

let app;
module.exports = (req, res) => {
  if (!app) app = createApp();
  return app(req, res);
};
