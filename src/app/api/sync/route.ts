import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { syncMatches } from '@/lib/matchService';

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

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await syncMatches();

    // Bust the Next.js cache for all league pages so navigating to them
    // immediately shows updated points without waiting for revalidation.
    revalidatePath('/leagues');

    return NextResponse.json({ ok: true, synced: new Date().toISOString() });
  } catch (error) {
    console.error('Sync route error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
