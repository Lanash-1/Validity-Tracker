/** Messages exchanged between popup, background and content scripts. */
export type ContentRequest = { type: 'vt:getSelection' } | { type: 'vt:scanPage' };

export interface PageSelection {
  text: string;
  title: string;
  url: string;
}

export interface PageScan {
  title: string;
  url: string;
  /** Lines of page text that mention validity/expiry words. */
  lines: string[];
}

export type BackgroundRequest = { type: 'vt:refreshBadge' } | { type: 'vt:signedOut' };

export interface PendingCapture {
  text: string;
  title: string;
  url: string;
  createdAt: number;
}

export const PENDING_CAPTURE_KEY = 'vt.pendingCapture';
