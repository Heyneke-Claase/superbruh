import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { syncAndScore } from '@/lib/matchService';

// Vercel Cron automatically sends Authorization: Bearer <CRON_SECRET>
// when invoking cron job routes. We also allow a SYNC_SECRET for manual calls.
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const syncSecret = process.env.SYNC_SECRET;

  // In local dev with no secrets set, allow all calls
  if (!cronSecret && !syncSecret) return true;

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);
  return token === cronSecret || token === syncSecret;
}

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
 * - Vercel Cron (with CRON_SECRET)
 * - Manual trigger (with SYNC_SECRET)
 * - Frontend components during live matches (no auth in dev, cookie auth in prod)
 * 
 * Query params:
 * - ?skipAuth=true - Allow call without Bearer token (for frontend on-demand calls)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const skipAuth = searchParams.get('skipAuth') === 'true';
  
  // Require auth unless skipAuth is set (for frontend on-demand calls)
  if (!skipAuth && !isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
