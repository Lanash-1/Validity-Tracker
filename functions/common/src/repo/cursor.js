export function encodeCursor(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (parsed && typeof parsed === 'object' && 'k' in parsed && 'id' in parsed) return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Sort key accessor per sort mode. */
export function sortKeyOf(sort, row) {
  switch (sort) {
    case 'created':
      return row.CREATEDTIME;
    case 'name':
      return String(row.name).toLowerCase();
    default:
      return row.expiry_sort;
  }
}

/** Direction: created is newest-first, the others ascending. */
export function sortDesc(sort) {
  return sort === 'created';
}
