// Web Google sign-in via Google Identity Services (GIS) ID-token flow.
import { config } from './config';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(opts: {
            client_id: string;
            callback: (r: { credential?: string }) => void;
            ux_mode?: 'popup' | 'redirect';
            use_fedcm_for_prompt?: boolean;
          }): void;
          prompt(cb?: (n: { isNotDisplayed(): boolean; isSkippedMoment(): boolean; getNotDisplayedReason(): string }) => void): void;
          renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
        };
      };
    };
  }
}

export function isGoogleConfigured(): boolean {
  return Boolean(config.googleWebClientId);
}

let scriptPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load Google sign-in'));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * Opens the Google One Tap / account chooser and resolves with an ID token.
 * Falls back to rendering a hidden button and clicking it when One Tap is
 * not displayed (e.g. the user dismissed it before).
 */
export async function getGoogleIdToken(): Promise<string | null> {
  await loadGis();
  const gis = window.google!.accounts.id;
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: string | null) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    gis.initialize({
      client_id: config.googleWebClientId,
      ux_mode: 'popup',
      use_fedcm_for_prompt: true,
      callback: (r) => done(r.credential ?? null),
    });
    gis.prompt((n) => {
      if (n.isNotDisplayed() || n.isSkippedMoment()) {
        // Render a real button and click it to open the popup chooser.
        const host = document.createElement('div');
        host.style.position = 'fixed';
        host.style.opacity = '0';
        host.style.pointerEvents = 'none';
        document.body.appendChild(host);
        gis.renderButton(host, { type: 'standard', size: 'large' });
        const btn = host.querySelector<HTMLElement>('div[role=button]');
        if (btn) btn.click();
        else done(null);
        setTimeout(() => host.remove(), 60_000);
      }
    });
  });
}

export async function googleSignOut(): Promise<void> {
  // Nothing to do: GIS does not keep a session of its own.
}
