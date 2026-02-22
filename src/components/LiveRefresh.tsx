'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Silently refreshes the current page's server data at a regular interval.
 * Mount this in any Server Component page to get near-real-time updates
 * without a full page reload.
 *
 * @param intervalMs - How often to refresh in milliseconds (default 30s).
 */
export default function LiveRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
