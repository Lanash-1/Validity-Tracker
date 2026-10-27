import * as chrono from 'chrono-node';
import { toDateString, type DateString } from '@vt/shared';

export interface ParsedValidity {
  /** `period` when a range was found, otherwise `fixed`. */
  kind: 'fixed' | 'period';
  startDate: DateString | null;
  endDate: DateString | null;
  /** Suggested built-in category key. */
  categoryKey: string | null;
  /** The text chrono matched, useful to show the user why. */
  matched: string | null;
}

const OFFER_WORDS = /\b(offer|coupon|promo|discount|sale|deal|voucher|cashback|% ?off)\b/i;
const SUBSCRIPTION_WORDS = /\b(subscription|renew|renewal|plan|membership|trial)\b/i;
const DOCUMENT_WORDS = /\b(passport|licen[cs]e|visa|insurance|policy|certificate|id card|warranty)\b/i;
export const VALIDITY_WORDS = /\b(valid|validity|expir\w*|ends?|ending|until|till|through|last date|deadline|due|renew\w*|offer|coupon|best before|use by)\b/i;

function toDs(d: Date): DateString {
  return toDateString(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Extracts validity dates from free text such as
 * "Offer valid from 1 Nov to 15 Nov 2026" or "Expires in 30 days".
 */
export function parseValidity(text: string, ref: Date = new Date()): ParsedValidity {
  const results = chrono.parse(text, ref, { forwardDate: true });
  const categoryKey = OFFER_WORDS.test(text)
    ? 'offers'
    : SUBSCRIPTION_WORDS.test(text)
      ? 'subscriptions'
      : DOCUMENT_WORDS.test(text)
        ? 'documents'
        : null;
  if (results.length === 0) return { kind: 'fixed', startDate: null, endDate: null, categoryKey, matched: null };

  // A single result with an end → range.
  const withEnd = results.find((r) => r.end);
  if (withEnd?.end) {
    return {
      kind: 'period',
      startDate: toDs(withEnd.start.date()),
      endDate: toDs(withEnd.end.date()),
      categoryKey,
      matched: withEnd.text,
    };
  }
  // Two separate dates ("from 1 Nov ... until 15 Nov") → range in order.
  if (results.length >= 2) {
    const dates = results.map((r) => r.start.date()).sort((a, b) => a.getTime() - b.getTime());
    const first = dates[0]!;
    const last = dates[dates.length - 1]!;
    if (first.getTime() !== last.getTime()) {
      return { kind: 'period', startDate: toDs(first), endDate: toDs(last), categoryKey, matched: results.map((r) => r.text).join(' … ') };
    }
  }
  const only = results[0]!;
  return { kind: 'fixed', startDate: null, endDate: toDs(only.start.date()), categoryKey, matched: only.text };
}

/** A short, human-friendly item name from captured text or a page title. */
export function suggestName(text: string, title: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned && cleaned.length <= 60) return cleaned;
  const t = title.split(/[|\-–—:]/)[0]?.trim() ?? '';
  if (t) return t.slice(0, 80);
  return cleaned.slice(0, 80);
}
