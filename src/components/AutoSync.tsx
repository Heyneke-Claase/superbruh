'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { triggerSyncAndScore } from '@/app/actions';

interface Props {
  /** ISO date strings of unresolved matches — used to detect live windows */
  matchTimes: string[];
}

const RATE_LIMIT_MS = 10 * 60 * 1000; // fire at most once per 10 minutes (no cron job on free tier)
const STORAGE_KEY = 'lastAutoSync';

/**
 * Silently calls triggerSyncAndScore() (a Server Action) when any match is currently
 * live — within a 2–5 hour window of its scheduled kick-off.
 *
 * This ensures matches are synced AND scored automatically without waiting for the
 * Vercel cron. The new syncAndScore function is idempotent - it won't double-score.
 *
 * Rate-limited to once per 5 minutes via localStorage so multiple users
 * with the page open don't all trigger it simultaneously.
 * 
 * When matches are scored, the page will refresh to show updated points.
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

    // triggerSyncAndScore is a Server Action — it calls syncAndScore() which:
    // 1. Syncs matches from API
    // 2. Scores any newly completed matches (idempotent)
    // 3. Updates individual pick points
    // 4. Recalculates membership totals
    // After it resolves, trigger a soft refresh to show new data.
    triggerSyncAndScore().then((result) => {
      if (result.success && result.scored && result.scored > 0) {
        // Only refresh if we actually scored some matches
        router.refresh();
      }
    }).catch(() => {
      // Non-fatal — LiveRefresh will catch it on the next 30s tick
    });
  }, [matchTimes, router]);

  return null;
}
