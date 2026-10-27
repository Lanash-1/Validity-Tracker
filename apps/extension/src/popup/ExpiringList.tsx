import React, { useEffect, useState } from 'react';
import { addDays, bucketForDays, daysUntil, describeDays, todayInTimeZone, type Category, type Item, type Space } from '@vt/shared';
import { getApi } from '@/src/lib/api';

export function ExpiringList({ spaces, categories, webUrl }: { spaces: Space[]; categories: Category[]; webUrl: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [spaceId, setSpaceId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const today = todayInTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  useEffect(() => {
    let alive = true;
    setItems(null);
    getApi()
      .then((api) => api.listItems({ status: 'active', to: addDays(today, 14), sort: 'expiry', limit: 50, spaceId: spaceId || undefined, ...({ today } as object) }))
      .then((r) => alive && setItems(r.items))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [spaceId, today]);

  const catIcon = (id: string | null) => categories.find((c) => c.id === id)?.icon ?? '📦';

  return (
    <>
      {spaces.length > 1 ? (
        <div className="chips">
          <button className={`chip ${spaceId === '' ? 'active' : ''}`} onClick={() => setSpaceId('')}>All spaces</button>
          {spaces.map((s) => (
            <button key={s.id} className={`chip ${spaceId === s.id ? 'active' : ''}`} onClick={() => setSpaceId(s.id)}>{s.icon ?? ''} {s.name}</button>
          ))}
        </div>
      ) : null}
      {error ? <p className="err">{error}</p> : null}
      {items === null ? <p className="muted">Loading…</p> : null}
      {items && items.length === 0 ? (
        <div className="card center"><div style={{ fontSize: 30 }}>🎉</div><strong>Nothing expires in the next two weeks</strong></div>
      ) : null}
      {items?.map((it) => {
        const d = daysUntil(it.effectiveExpiry, today);
        const b = bucketForDays(d);
        return (
          <a key={it.id} className="item" href={`${webUrl}/items/${it.id}`} target="_blank" rel="noreferrer">
            <span>{catIcon(it.categoryId)}</span>
            <span className="name">{it.name}</span>
            <span className={`when ${b}`}>{d === null ? '—' : d < 0 ? `expired ${describeDays(d)}` : describeDays(d)}</span>
          </a>
        );
      })}
      <a className="ghost" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }} href={webUrl} target="_blank" rel="noreferrer">Open the full app ↗</a>
    </>
  );
}
