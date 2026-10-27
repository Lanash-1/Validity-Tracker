import React, { useEffect, useState } from 'react';
import type { Category, Space } from '@vt/shared';
import { extensionAuthUrl, getApi, isSignedIn } from '@/src/lib/api';
import { getSettings, saveSettings, type Settings } from '@/src/lib/settings';
import { tokenStore } from '@/src/lib/token-store';
import { PENDING_CAPTURE_KEY, type PendingCapture } from '@/src/lib/messages';
import { ExpiringList } from './ExpiringList';
import { QuickAdd } from './QuickAdd';

type Tab = 'expiring' | 'add' | 'settings';

export function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('expiring');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [capture, setCapture] = useState<PendingCapture | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const s = await getSettings();
    setSettings(s);
    const ok = await isSignedIn();
    setSignedIn(ok);
    if (!ok) return;
    try {
      const api = await getApi();
      const [sp, cats] = await Promise.all([api.listSpaces(), api.listCategories()]);
      setSpaces(sp);
      setCategories(cats);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      if (/sign in/i.test(msg)) setSignedIn(false);
    }
  };

  useEffect(() => {
    void load();
    // A context-menu capture waiting for us?
    chrome.storage.session.get(PENDING_CAPTURE_KEY).then((r) => {
      const c = r[PENDING_CAPTURE_KEY] as PendingCapture | undefined;
      if (c && Date.now() - c.createdAt < 10 * 60_000) {
        setCapture(c);
        setTab('add');
        void chrome.storage.session.remove(PENDING_CAPTURE_KEY);
      }
    });
    // Re-check when the web app hands us tokens while the popup is open.
    const onChange = (changes: Record<string, unknown>) => {
      if ('vt.auth.tokens' in changes) void load();
    };
    chrome.storage.local.onChanged.addListener(onChange);
    return () => chrome.storage.local.onChanged.removeListener(onChange);
  }, []);

  const signIn = async () => {
    await chrome.tabs.create({ url: await extensionAuthUrl() });
  };

  const signOut = async () => {
    try {
      (await getApi()).signOut();
    } catch {
      // ignore
    }
    await tokenStore.clear();
    await chrome.runtime.sendMessage({ type: 'vt:signedOut' });
    setSignedIn(false);
  };

  return (
    <div className="app">
      <header>
        <img src="/icon/48.png" alt="" />
        <h1>Validity Tracker</h1>
        <button className="ghost" title="Settings" onClick={() => setTab(tab === 'settings' ? 'expiring' : 'settings')}>⚙︎</button>
      </header>
      {signedIn === null ? (
        <main><p className="muted">Loading…</p></main>
      ) : tab === 'settings' ? (
        <SettingsPane settings={settings!} onSave={async (p) => { setSettings(await saveSettings(p)); await load(); }} signedIn={signedIn} onSignOut={signOut} />
      ) : !signedIn ? (
        <main>
          <div className="card center">
            <div style={{ fontSize: 34 }}>🔗</div>
            <strong>Connect to your account</strong>
            <p className="muted">Sign in on the web app once; it will hand the session to this extension.</p>
            <button className="primary" onClick={signIn}>Sign in</button>
            {error ? <p className="err">{error}</p> : null}
          </div>
        </main>
      ) : (
        <>
          <div className="tabs">
            <button className={`tab ${tab === 'expiring' ? 'active' : ''}`} onClick={() => setTab('expiring')}>Expiring soon</button>
            <button className={`tab ${tab === 'add' ? 'active' : ''}`} onClick={() => setTab('add')}>Add</button>
          </div>
          <main>
            {error ? <p className="err">{error}</p> : null}
            {tab === 'expiring' ? (
              <ExpiringList spaces={spaces} categories={categories} webUrl={settings?.apiUrl ?? ''} />
            ) : (
              <QuickAdd spaces={spaces} categories={categories} defaultSpaceId={settings?.defaultSpaceId ?? ''} capture={capture} onSaved={() => setCapture(null)} />
            )}
          </main>
        </>
      )}
    </div>
  );
}

function SettingsPane({ settings, onSave, signedIn, onSignOut }: { settings: Settings; onSave: (p: Partial<Settings>) => Promise<void>; signedIn: boolean; onSignOut: () => Promise<void> }) {
  const [apiUrl, setApiUrl] = useState(settings.apiUrl);
  const [saved, setSaved] = useState(false);
  return (
    <main>
      <div className="card">
        <label>
          Web app / API URL
          <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://your-project.catalystserverless.com" />
        </label>
        <p className="muted">The extension talks to the same Catalyst domain that hosts the web app. Sign in again after changing it.</p>
        <div className="row">
          <button className="primary" onClick={async () => { await onSave({ apiUrl }); setSaved(true); setTimeout(() => setSaved(false), 1500); }}>{saved ? 'Saved' : 'Save'}</button>
          {signedIn ? <button className="danger" onClick={onSignOut}>Sign out</button> : null}
        </div>
      </div>
      <p className="muted">Tip: select a date or an offer on any page, right-click and choose “Track validity”.</p>
    </main>
  );
}
