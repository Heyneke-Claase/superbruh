import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { syncAndScore } from '@/lib/matchService';

/**
 * Sync and Score API Endpoint
 * 
 * This endpoint:
 * 1. Syncs match data from the external API
 * 2. Scores any newly completed matches (idempotent - won't double-score)
 * 3. Updates individual predictions with points
 * 4. Recalculates membership totals
 * 
 * Can be called by:
 * - External cron services (cron-job.org) - no auth required
 * - Manual trigger (with SYNC_SECRET)
 * - Frontend components during live matches
 */
export async function GET(request: NextRequest) {
  // Allow external cron services to call this endpoint without auth
  // The endpoint is idempotent so it's safe to call multiple times
  // If you want to restrict access, set SYNC_SECRET and check for it
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${syncSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await syncAndScore();

    // Bust the Next.js cache for all league pages so navigating to them
    // immediately shows updated points without waiting for revalidation.
    revalidatePath('/leagues');
    revalidatePath('/leagues/[id]');
    revalidatePath('/leagues/[id]/picks');
    revalidatePath('/leagues/[id]/leaderboard');
    revalidatePath('/leagues/[id]/match/[matchId]');

    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      matchesSynced: result.synced,
      matchesScored: result.scored,
    });
  } catch (error) {
    console.error('Sync and score error:', error);
    return NextResponse.json(
      { error: 'Sync and score failed', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST handler - same as GET but for explicit trigger actions
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
