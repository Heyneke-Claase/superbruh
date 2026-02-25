'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { forceSync } from '@/app/actions';

interface Props {
  /** ISO date strings of unresolved matches — used to detect live windows */
  matchTimes: string[];
}

const RATE_LIMIT_MS = 10 * 60 * 1000; // fire at most once per 10 minutes
const STORAGE_KEY = 'lastAutoSync';

/**
 * Silently calls forceSync() (a Server Action) when any match is currently
 * live — within a 2–5 hour window of its scheduled kick-off.
 *
 * This ensures the DB is updated automatically without waiting for the
 * Vercel cron, which on the free tier only fires once per day regardless
 * of the configured schedule.
 *
 * Rate-limited to once per 10 minutes via localStorage so multiple users
 * with the page open don't all trigger it simultaneously.
 */
export default function AutoSync({ matchTimes }: Props) {
  const router = useRouter();

  useEffect(() => {
    const now = Date.now();

    // Is any match currently in its live window?
    // 2h after start: we begin checking (mid-match polling)
    // 5h after start: safety buffer for rain delays / long matches
    const isLive = matchTimes.some((t) => {
      const start = new Date(t).getTime();
      return now >= start + 2 * 60 * 60 * 1000 && now <= start + 5 * 60 * 60 * 1000;
    });

    if (!isLive) return;

    const lastSync = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    if (now - lastSync < RATE_LIMIT_MS) return;

    localStorage.setItem(STORAGE_KEY, String(now));

    // forceSync is a Server Action — it calls syncMatches() and revalidates
    // the cache. After it resolves, trigger a soft refresh to show new data.
    forceSync().then(() => {
      router.refresh();
    }).catch(() => {
      // Non-fatal — LiveRefresh will catch it on the next 30s tick
    });
  }, [matchTimes, router]);

  return null;
}
