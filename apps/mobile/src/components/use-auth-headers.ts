import { useEffect, useState } from 'react';
import { authHeaders } from '@/lib/api';

/** Auth headers for <Image> sources that point at the API's photo route. */
export function useAuthHeaders(): Record<string, string> {
  const [h, setH] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    authHeaders().then((v) => alive && setH(v));
    return () => {
      alive = false;
    };
  }, []);
  return h;
}
