import { describe, expect, it } from 'vitest';
import { parseValidity, suggestName } from '../src/lib/parse';

const ref = new Date(2026, 9, 27, 12); // 27 Oct 2026 local

describe('parseValidity', () => {
  it('reads a single expiry date', () => {
    const p = parseValidity('Coupon expires on 30 November 2026', ref);
    expect(p).toMatchObject({ kind: 'fixed', endDate: '2026-11-30', categoryKey: 'offers' });
  });

  it('reads an explicit range as a validity period', () => {
    const p = parseValidity('Offer valid from 1 Nov 2026 to 15 Nov 2026', ref);
    expect(p).toMatchObject({ kind: 'period', startDate: '2026-11-01', endDate: '2026-11-15', categoryKey: 'offers' });
  });

  it('pairs two separate dates into a range', () => {
    const p = parseValidity('Sale starts 5 December 2026. Last date 20 December 2026.', ref);
    expect(p).toMatchObject({ kind: 'period', startDate: '2026-12-05', endDate: '2026-12-20' });
  });

  it('understands relative phrases and prefers future dates', () => {
    expect(parseValidity('Valid till tomorrow', ref).endDate).toBe('2026-10-28');
    expect(parseValidity('Expires in 30 days', ref).endDate).toBe('2026-11-26');
    expect(parseValidity('Renew by 15 Jan', ref).endDate).toBe('2027-01-15');
  });

  it('suggests categories from wording', () => {
    expect(parseValidity('Netflix subscription renews on 3 Nov', ref).categoryKey).toBe('subscriptions');
    expect(parseValidity('Passport expires 2 March 2030', ref).categoryKey).toBe('documents');
    expect(parseValidity('Best before 12/12/2026', ref).categoryKey).toBeNull();
  });

  it('returns nulls when no date is present', () => {
    expect(parseValidity('Hello world', ref)).toMatchObject({ kind: 'fixed', startDate: null, endDate: null, matched: null });
  });
});

describe('suggestName', () => {
  it('uses short selections verbatim, otherwise the page title', () => {
    expect(suggestName('20% off shoes', 'Big Shoe Store | Deals')).toBe('20% off shoes');
    expect(suggestName('x'.repeat(100), 'Big Shoe Store | Deals')).toBe('Big Shoe Store');
  });
});
