/**
 * Barcode → product lookup backed by Open Food Facts (food), with the v3
 * `product_type=all` endpoint as fallback so cosmetics and other products
 * (Open Beauty Facts / Open Products Facts) resolve too. Results are cached
 * in the product_cache table for 30 days.
 */

const UA = 'ValidityTracker/0.1 (https://github.com/lanash-1/validity-tracker)';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function lookupProduct(repo, barcode, { fetch: fetchImpl = fetch, now = () => Date.now() } = {}) {
  const cached = await repo.productCache.get(barcode);
  if (cached && now() - Date.parse(cached.fetched_at) < CACHE_TTL_MS) {
    return cached.name === null && cached.source === 'none' ? null : fromRow(cached);
  }

  const found = (await fetchOff(fetchImpl, `https://world.openfoodfacts.org/api/v2/product/${enc(barcode)}.json?fields=product_name,brands,image_front_url,image_url,quantity`, 'openfoodfacts')) ??
    (await fetchOff(fetchImpl, `https://world.openfoodfacts.org/api/v3/product/${enc(barcode)}?product_type=all&fields=product_name,brands,image_front_url,image_url,quantity`, 'openfacts-all'));

  const row = {
    barcode,
    name: found?.name ?? null,
    brand: found?.brand ?? null,
    image_url: found?.imageUrl ?? null,
    quantity: found?.quantity ?? null,
    source: found?.source ?? 'none',
    fetched_at: new Date(now()).toISOString(),
  };
  await repo.productCache.upsert(row);
  return found ? fromRow(row) : null;
}

async function fetchOff(fetchImpl, url, source) {
  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, redirect: 'follow' });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const json = await res.json();
    const p = json?.product;
    if (!p || (json.status === 0 && !p.product_name)) return null;
    const name = (p.product_name || '').trim();
    if (!name) return null;
    return {
      name,
      brand: (p.brands || '').split(',')[0]?.trim() || null,
      imageUrl: p.image_front_url || p.image_url || null,
      quantity: p.quantity || null,
      source,
    };
  } catch (/** @type {any} */ err) {
    console.warn('product lookup failed', source, err?.message);
    return null;
  }
}

function fromRow(r) {
  return {
    barcode: r.barcode,
    name: r.name ?? null,
    brand: r.brand ?? null,
    imageUrl: r.image_url ?? null,
    quantity: r.quantity ?? null,
    source: r.source,
  };
}

const enc = (s) => encodeURIComponent(s);
