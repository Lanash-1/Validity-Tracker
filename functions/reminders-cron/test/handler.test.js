import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('reminders-cron wiring', () => {
  it('declares a cron function in catalyst-config.json', () => {
    const cfg = JSON.parse(readFileSync(new URL('../catalyst-config.json', import.meta.url), 'utf8'));
    expect(cfg.deployment.type).toBe('cron');
    expect(cfg.execution.main).toBe('index.js');
  });
});
