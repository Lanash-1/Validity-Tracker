import React, { useEffect, useMemo, useState } from 'react';
import { createItemSchema, effectiveExpiry, type Category, type CreateItemInput, type Space } from '@vt/shared';
import { getApi } from '@/src/lib/api';
import { parseValidity, suggestName } from '@/src/lib/parse';
import type { PageScan, PageSelection, PendingCapture } from '@/src/lib/messages';

type Kind = 'fixed' | 'period' | 'review';

export function QuickAdd({ spaces, categories, defaultSpaceId, capture, onSaved }: {
  spaces: Space[];
  categories: Category[];
  defaultSpaceId: string;
  capture: PendingCapture | null;
  onSaved: () => void;
}) {
  const personal = spaces.find((s) => s.type === 'personal');
  const [spaceId, setSpaceId] = useState(defaultSpaceId || personal?.id || spaces[0]?.id || '');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('fixed');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [matched, setMatched] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!spaceId && (personal?.id || spaces[0]?.id)) setSpaceId(personal?.id || spaces[0]!.id);
  }, [spaces, personal, spaceId]);

  const applyText = (text: string, title: string, url: string) => {
    const p = parseValidity(text);
    setName((n) => n || suggestName(text, title));
    setNotes((v) => v || url);
    setMatched(p.matched);
    if (p.kind === 'period') {
      setKind('period');
      setStartDate(p.startDate ?? '');
      setEndDate(p.endDate ?? '');
    } else if (p.endDate) {
      setKind('fixed');
      setEndDate(p.endDate);
    }
    if (p.categoryKey && !categoryId) {
      const c = categories.find((x) => x.key === p.categoryKey);
      if (c) setCategoryId(c.id);
    }
  };

  // Prefill from a right-click capture.
  useEffect(() => {
    if (capture) applyText(capture.text, capture.title, capture.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture, categories.length]);

  const useSelection = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    try {
      const sel = (await chrome.tabs.sendMessage(tab.id, { type: 'vt:getSelection' })) as PageSelection;
      if (sel.text.trim()) applyText(sel.text, sel.title, sel.url);
      else setMsg({ ok: false, text: 'Select some text on the page first (e.g. “valid till 30 Nov”).' });
    } catch {
      setMsg({ ok: false, text: 'Cannot read this page. Reload it and try again.' });
    }
  };

  const scanPage = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    try {
      const scan = (await chrome.tabs.sendMessage(tab.id, { type: 'vt:scanPage' })) as PageScan;
      setSuggestions(scan.lines);
      setName((n) => n || suggestName('', scan.title));
      setNotes((v) => v || scan.url);
      if (scan.lines.length === 0) setMsg({ ok: false, text: 'No validity phrases found on this page.' });
    } catch {
      setMsg({ ok: false, text: 'Cannot scan this page (browser pages are not accessible).' });
    }
  };

  const preview = useMemo(
    () => effectiveExpiry({ expiryType: kind, startDate: startDate || null, expiryDate: endDate || null, reviewDate: endDate || null }),
    [kind, startDate, endDate],
  );

  const save = async () => {
    setMsg(null);
    const input: CreateItemInput = {
      spaceId,
      name: name.trim(),
      categoryId: categoryId || null,
      notes: notes.trim() || null,
      expiryType: kind,
      startDate: kind === 'period' ? startDate || null : null,
      expiryDate: kind === 'review' ? null : endDate || null,
      reviewDate: kind === 'review' ? endDate || null : null,
    };
    const parsed = createItemSchema.safeParse(input);
    if (!parsed.success) {
      setMsg({ ok: false, text: parsed.error.issues[0]?.message ?? 'Check the form' });
      return;
    }
    setSaving(true);
    try {
      const api = await getApi();
      await api.createItem(parsed.data);
      setMsg({ ok: true, text: `Saved “${input.name}”` });
      setName(''); setStartDate(''); setEndDate(''); setNotes(''); setMatched(null); setSuggestions(null);
      onSaved();
      void chrome.runtime.sendMessage({ type: 'vt:refreshBadge' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="row">
        <button className="secondary" onClick={useSelection}>Use selected text</button>
        <button className="secondary" onClick={scanPage}>Scan this page</button>
      </div>
      {suggestions && suggestions.length > 0 ? (
        <div className="card">
          <span className="muted">Found on this page. Click one to fill the dates:</span>
          {suggestions.map((s, i) => (
            <button key={i} className="suggestion" onClick={() => { applyText(s, '', ''); setSuggestions(null); }}>{s}</button>
          ))}
        </div>
      ) : null}
      <div className="card">
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali 20% off coupon" /></label>
        <div className="chips">
          {(['fixed', 'period', 'review'] as Kind[]).map((k) => (
            <button key={k} className={`chip ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>
              {k === 'fixed' ? 'Expiry date' : k === 'period' ? 'Valid from–to' : 'Review date'}
            </button>
          ))}
        </div>
        {kind === 'period' ? <label>Valid from<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label> : null}
        <label>{kind === 'period' ? 'Valid until' : kind === 'review' ? 'Review on' : 'Expires on'}<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
        {matched ? <span className="muted">Dates read from “{matched}”</span> : null}
        {spaces.length > 1 ? (
          <label>Space<select value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>{spaces.map((s) => <option key={s.id} value={s.id}>{s.icon ?? ''} {s.name}</option>)}</select></label>
        ) : null}
        <label>Category<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">None</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.icon ?? ''} {c.name}</option>)}</select></label>
        <label>Notes / link<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Where you saw it, terms, code…" /></label>
        <span className="muted">{preview ? `Tracked until ${preview}` : 'Pick a date'}</span>
        <button className="primary" disabled={saving || !name.trim()} onClick={save}>{saving ? 'Saving…' : 'Save to Validity Tracker'}</button>
        {msg ? <span className={msg.ok ? 'ok' : 'err'}>{msg.text}</span> : null}
      </div>
    </>
  );
}
