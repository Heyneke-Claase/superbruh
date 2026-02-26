import { createClient } from './supabase/server';
import { getActualMargin } from './utils';

export { getActualMargin };

const API_KEY = 'a8f16eab-0f85-45c8-8477-10de77bb60d1';
const SERIES_ID = 'd7dcef2e-6391-4039-b7b1-15fd3e354432';
const API_URL = `https://api.cricapi.com/v1/series_info?apikey=${API_KEY}&id=${SERIES_ID}`;

/**
 * Sync and Score - Main entry point for automatic scoring
 * 
 * This function:
 * 1. Fetches latest match statuses from API
 * 2. Upserts matches into DB (status, winner, margin, etc.)
 * 3. Detects newly completed matches (completed but not scored yet)
 * 4. Calculates points for every pick for newly completed matches
 * 5. Updates the picks rows with individual points and results
 * 6. Marks matches as scored (sets scoredAt)
 * 7. Updates membership totals
 * 
 * This is idempotent - you can run it every minute and it won't double-score.
 */
export async function syncAndScore(): Promise<{ synced: number; scored: number }> {
  console.log('[syncAndScore] Starting sync and score process...');
  const supabase = await createClient();
  
  // Step 1 & 2: Sync matches from API
  console.log('[syncAndScore] Step 1: Syncing matches from API...');
  await syncMatchesInternal(supabase);
  
  // Step 3-7: Score any un-scored completed matches
  console.log('[syncAndScore] Step 2: Scoring un-scored matches...');
  const scoredCount = await scoreUnscoredMatches(supabase);
  
  console.log(`[syncAndScore] Complete. Scored ${scoredCount} matches.`);
  return { synced: 1, scored: scoredCount };
}

async function syncMatchesInternal(supabase: any) {
  const response = await fetch(API_URL);
  const result = await response.json();

  if (result.status !== 'success') {
    console.error('API Error:', result.reason);
    return;
  }

  const matches = result.data.matchList;

  // Load already-resolved matches from DB so we don't re-fetch their match_info
  const { data: resolvedInDb } = await supabase
    .from('Match')
    .select('id')
    .eq('matchEnded', true)
    .not('winner', 'is', null);
  const resolvedIds = new Set((resolvedInDb || []).map((r: any) => r.id));

  for (const m of matches) {
    const seriesName = "ICC Men's T20 World Cup 2026";
    
    // Skip U19 matches
    if (m.teams[0].includes('U19') || m.teams[1].includes('U19') || m.name?.includes('U19')) {
      continue;
    }
    
    let winner: string | null = m.winner || null;
    let detailedStatus: string = m.status;
    let matchScore = null;
    let matchEnded: boolean = m.matchEnded ?? false;
    let matchStarted: boolean = m.matchStarted ?? false;

    const scheduledAt = new Date(m.dateTimeGMT).getTime();
    const threeHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const alreadyResolved = resolvedIds.has(m.id);
    const shouldFetchDetail = !alreadyResolved && (m.matchEnded || m.matchStarted || scheduledAt <= threeHoursAgo);

    if (shouldFetchDetail) {
      try {
        const res = await fetch(`https://api.cricapi.com/v1/match_info?apikey=${API_KEY}&id=${m.id}`);
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          matchScore = json.data.score || null;
          if (json.data.matchEnded !== undefined) matchEnded = json.data.matchEnded;
          if (json.data.matchStarted !== undefined) matchStarted = json.data.matchStarted;
          if (json.data.status) detailedStatus = json.data.status;
          if (json.data.winner) {
            winner = json.data.winner;
          } else if (!winner && detailedStatus.includes(' won by ')) {
            winner = detailedStatus.split(' won by ')[0].trim();
          }
          if (!matchEnded && (detailedStatus.includes(' won by ') || detailedStatus.toLowerCase().includes('super over'))) {
            matchEnded = true;
            matchStarted = true;
          }
        }
      } catch (err) {
        console.error('Error fetching full match info:', err);
      }
    }

    if (!winner && m.status && m.status.includes(' won by ')) {
      winner = m.status.split(' won by ')[0].trim();
    }

    if (matchEnded && !detailedStatus.match(/\((Narrow|Comfortable|Easy|Thrashing)\)/i)) {
      const margin = getActualMargin(detailedStatus);
      if (margin) detailedStatus = `${detailedStatus} (${margin})`;
    }

    const matchData: any = {
      id: m.id,
      team1: m.teams[0],
      team2: m.teams[1],
      seriesName: seriesName,
      dateTimeGMT: new Date(m.dateTimeGMT).toISOString(),
      status: detailedStatus,
      matchType: m.matchType,
      venue: m.venue,
      matchStarted,
      matchEnded,
    };

    if (winner !== null) {
      matchData.winner = winner;
    }

    if (winner === null && detailedStatus.includes(' won by ')) {
      matchData.winner = detailedStatus.split(' won by ')[0].trim();
    }

    if (matchScore) {
      matchData.score = matchScore;
    }

    if (alreadyResolved) continue;

    await supabase.from('Match').upsert(matchData);
  }
}

// Legacy wrapper for backward compatibility - now uses the new syncAndScore
export async function syncMatches() {
  try {
    await syncAndScore();
  } catch (error) {
    console.error('Sync error:', error);
  }
}

/**
 * Score all un-scored completed matches.
 * This is idempotent - running it multiple times won't double-score.
 * Returns the number of matches that were scored.
 */
async function scoreUnscoredMatches(supabase: any): Promise<number> {
  console.log('[scoreUnscoredMatches] Looking for completed unscored matches...');
  
  // Find completed matches that haven't been scored yet
  const { data: matchesToScore, error: matchError } = await supabase
    .from('Match')
    .select('id, winner, status')
    .eq('matchEnded', true)
    .is('scoredAt', null);

  if (matchError) {
    console.error('[scoreUnscoredMatches] Error fetching matches:', matchError);
    return 0;
  }

  console.log(`[scoreUnscoredMatches] Found ${matchesToScore?.length || 0} matches to score`);
  
  if (!matchesToScore || matchesToScore.length === 0) {
    console.log('[scoreUnscoredMatches] No matches need scoring');
    return 0;
  }
  
  console.log(`[scoreUnscoredMatches] Match IDs to score: ${matchesToScore.map((m: any) => m.id).join(', ')}`);

  console.log(`Scoring ${matchesToScore.length} newly completed matches...`);

  // Get all predictions for these matches
  const matchIds = matchesToScore.map((m: any) => m.id);
  console.log(`[scoreUnscoredMatches] Fetching predictions for match IDs: ${matchIds.join(', ')}`);
  
  const { data: allPredictions, error: predError } = await supabase
    .from('Prediction')
    .select('id, matchId, userId, predictedWinner')
    .in('matchId', matchIds);

  if (predError) {
    console.error('[scoreUnscoredMatches] Error fetching predictions:', predError);
    return 0;
  }

  console.log(`[scoreUnscoredMatches] Found ${allPredictions?.length || 0} predictions to score`);

  if (!allPredictions || allPredictions.length === 0) {
    // No predictions to score, just mark matches as scored
    console.log('[scoreUnscoredMatches] No predictions found, marking matches as scored');
    for (const match of matchesToScore) {
      await supabase
        .from('Match')
        .update({ scoredAt: new Date().toISOString() })
        .eq('id', match.id);
    }
    return matchesToScore.length;
  }

  // Calculate points for each prediction
  const predictionsToUpdate = [];
  
  for (const prediction of allPredictions) {
    const match = matchesToScore.find((m: any) => m.id === prediction.matchId);
    if (!match) continue;

    const effectiveWinner =
      match.winner ||
      (match.status?.includes(' won by ')
        ? match.status.split(' won by ')[0].trim()
        : null);

    const predictedTeam = prediction.predictedWinner?.split('|')[0];
    const predictedMargin = prediction.predictedWinner?.split('|')[1];

    let points = 0;
    let result = 'incorrect';

    if (effectiveWinner && effectiveWinner === predictedTeam) {
      points += 1;
      result = 'correct_team';
      
      const actualMargin = getActualMargin(match.status);
      if (actualMargin && predictedMargin === actualMargin) {
        points += 1;
        result = 'correct_margin';
      }
    }

    predictionsToUpdate.push({
      id: prediction.id,
      points,
      result,
      matchId: prediction.matchId,
      userId: prediction.userId,
    });
  }

  // Batch update predictions with their points and results
  console.log(`[scoreUnscoredMatches] Updating ${predictionsToUpdate.length} predictions with points`);
  for (const pred of predictionsToUpdate) {
    console.log(`[scoreUnscoredMatches] Updating prediction ${pred.id}: ${pred.points} points (${pred.result})`);
    await supabase
      .from('Prediction')
      .update({ 
        points: pred.points, 
        result: pred.result,
        scoredAt: new Date().toISOString()
      })
      .eq('id', pred.id);
  }

  // Mark all matches as scored
  console.log(`[scoreUnscoredMatches] Marking ${matchesToScore.length} matches as scored`);
  for (const match of matchesToScore) {
    await supabase
      .from('Match')
      .update({ scoredAt: new Date().toISOString() })
      .eq('id', match.id);
  }

  // Update membership totals
  console.log('[scoreUnscoredMatches] Recalculating membership totals');
  await recalculateMembershipTotals(supabase);

  return matchesToScore.length;
}

/**
 * Recalculate total points for all memberships based on scored predictions
 */
async function recalculateMembershipTotals(supabase: any) {
  // Get all memberships
  const { data: memberships } = await supabase
    .from('Membership')
    .select('id, userId');

  if (!memberships) return;

  for (const membership of memberships) {
    // Sum points from all scored predictions for this user
    const { data: predictions } = await supabase
      .from('Prediction')
      .select('points')
      .eq('userId', membership.userId)
      .not('points', 'is', null);

    const totalPoints = (predictions || []).reduce((sum: number, p: any) => sum + (p.points || 0), 0);

    await supabase
      .from('Membership')
      .update({ points: totalPoints })
      .eq('id', membership.id);
  }
}

/**
 * Legacy updatePoints - now triggers scoring of unscored matches
 * and recalculates totals. Kept for backward compatibility.
 */
export async function updatePoints(userId?: string) {
  const supabase = await createClient();
  
  // Score any unscored matches first
  await scoreUnscoredMatches(supabase);
  
  // Recalculate membership totals
  await recalculateMembershipTotals(supabase);
}
