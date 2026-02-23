import { createClient } from './supabase/server';
import { getActualMargin } from './utils';

export { getActualMargin };

const API_KEY = '0d758f82-8029-4904-8339-a19df7e9edd3';
const SERIES_ID = '0cdf6736-ad9b-4e95-a647-5ee3a99c5510'; // ICC Men's T20 World Cup 2026
const API_URL = `https://api.cricapi.com/v1/series_info?apikey=${API_KEY}&id=${SERIES_ID}`;

export async function syncMatches() {
  try {
    const supabase = await createClient();
    const response = await fetch(API_URL);
    const result = await response.json();

    if (result.status !== 'success') {
      console.error('API Error:', result.reason);
      return;
    }

    const matches = result.data.matchList;

    // Load already-resolved matches from DB so we don't re-fetch their match_info
    // every single cron tick — this saves API credits significantly.
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
      
      // series_info often returns stale data — matchEnded stays false even after
      // the game finishes. Fetch match_info whenever:
      //   (a) series_info says matchEnded/matchStarted, OR
      //   (b) the scheduled UTC time was >4 hours ago (enough for a T20 to finish)
      // BUT skip the extra API call if the DB already has a resolved result for
      // this match — no point re-fetching what we already know.
      let winner: string | null = m.winner || null;
      let detailedStatus: string = m.status;
      let matchScore = null;
      let matchEnded: boolean = m.matchEnded ?? false;
      let matchStarted: boolean = m.matchStarted ?? false;

      const scheduledAt = new Date(m.dateTimeGMT).getTime();
      const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
      const alreadyResolved = resolvedIds.has(m.id);
      const shouldFetchDetail = !alreadyResolved && (m.matchEnded || m.matchStarted || scheduledAt < fourHoursAgo);

      if (shouldFetchDetail) {
        try {
          const res = await fetch(`https://api.cricapi.com/v1/match_info?apikey=${API_KEY}&id=${m.id}`);
          const json = await res.json();
          if (json.status === 'success' && json.data) {
            matchScore = json.data.score || null;
            // Use match_info fields as they are more up-to-date than series_info
            if (json.data.matchEnded !== undefined) matchEnded = json.data.matchEnded;
            if (json.data.matchStarted !== undefined) matchStarted = json.data.matchStarted;
            // Prefer the detailed status from match_info
            if (json.data.status) detailedStatus = json.data.status;
            // Prefer explicit winner field, then derive from status
            if (json.data.winner) {
              winner = json.data.winner;
            } else if (!winner && detailedStatus.includes(' won by ')) {
              winner = detailedStatus.split(' won by ')[0].trim();
            }
          }
        } catch (err) {
          console.error('Error fetching full match info:', err);
        }
      }

      // Fallback: derive winner from series_info status if still null
      if (!winner && m.status && m.status.includes(' won by ')) {
        winner = m.status.split(' won by ')[0].trim();
      }

      // Embed margin classification into status if not already present.
      // e.g. "England won by 51 runs" → "England won by 51 runs (Thrashing)"
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

      // Only set winner when we actually resolved one — never overwrite a valid
      // winner already in the DB with null just because the API returned nothing.
      if (winner !== null) {
        matchData.winner = winner;
      }

      // Last-chance derivation: if winner is still null but the stored status
      // contains the result, extract it so the DB is always consistent.
      if (winner === null && detailedStatus.includes(' won by ')) {
        matchData.winner = detailedStatus.split(' won by ')[0].trim();
      }

      if (matchScore) {
        matchData.score = matchScore;
      }

      // Skip upsert for matches already fully resolved in the DB — series_info
      // keeps returning matchEnded=false for them and would overwrite our data.
      if (alreadyResolved) continue;

      await supabase.from('Match').upsert(matchData);
    }
    
    console.log(`Synced ${matches.length} matches`);
    await updatePoints();
  } catch (error) {
    console.error('Sync error:', error);
  }
}

export async function updatePoints(userId?: string) {
  const supabase = await createClient();

  // Get all finished matches
  const { data: finishedMatches } = await supabase
    .from('Match')
    .select('id, winner, status, score')
    .eq('matchEnded', true);

  if (!finishedMatches) return;

  // Get memberships
  let query = supabase.from('Membership').select('id, userId');
  if (userId) {
    query = query.eq('userId', userId);
  }
  
  const { data: memberships } = await query;

  if (!memberships) return;

  for (const membership of memberships) {
    let points = 0;
    
    // Get predictions for this user
    const { data: predictions } = await supabase
      .from('Prediction')
      .select('matchId, predictedWinner')
      .eq('userId', membership.userId);

    if (predictions) {
      for (const pred of predictions) {
        const match = finishedMatches.find(m => m.id === pred.matchId);
        if (match) {
          // Use stored winner; fall back to deriving it from the status string
          // so that matches whose winner field was accidentally cleared still
          // award points correctly.
          const effectiveWinner =
            match.winner ||
            (match.status?.includes(' won by ')
              ? match.status.split(' won by ')[0].trim()
              : null);

          const predictedTeam = pred.predictedWinner?.split('|')[0];
          const predictedMargin = pred.predictedWinner?.split('|')[1];
          
          if (effectiveWinner && effectiveWinner === predictedTeam) {
            points += 1; // 1 point for correct team
            
            const actualMargin = getActualMargin(match.status);
            if (actualMargin && predictedMargin === actualMargin) {
              points += 1; // 1 extra point for correct margin
            }
          }
        }
      }
    }

    await supabase
      .from('Membership')
      .update({ points })
      .eq('id', membership.id);
  }
}
