import { defineContentScript } from 'wxt/utils/define-content-script';
import type { ContentRequest, PageScan, PageSelection } from '@/src/lib/messages';

const VALIDITY_WORDS = /\b(valid|validity|expir\w*|ends?|ending|until|till|through|last date|deadline|due|renew\w*|offer|coupon|best before|use by)\b/i;
const HAS_DATEISH = /\b(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{4}-\d{2}-\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|tonight|days?|weeks?|months?|midnight)\b/i;

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    chrome.runtime.onMessage.addListener((msg: ContentRequest, _sender, sendResponse) => {
      if (msg?.type === 'vt:getSelection') {
        const sel: PageSelection = {
          text: window.getSelection()?.toString() ?? '',
          title: document.title,
          url: location.href,
        };
        sendResponse(sel);
        return false;
      }
      if (msg?.type === 'vt:scanPage') {
        sendResponse(scanPage());
        return false;
      }
      return false;
    });
  },
});

/** Finds lines of visible text that talk about validity and contain something date-like. */
function scanPage(): PageScan {
  const text = document.body?.innerText ?? '';
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line.length < 8 || line.length > 220) continue;
    if (!VALIDITY_WORDS.test(line) || !HAS_DATEISH.test(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
    if (lines.length >= 20) break;
  }
  return { title: document.title, url: location.href, lines };
}
