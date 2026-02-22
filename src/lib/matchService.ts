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

    for (const m of matches) {
      const seriesName = "ICC Men's T20 World Cup 2026";
      
      // Skip U19 matches
      if (m.teams[0].includes('U19') || m.teams[1].includes('U19') || m.name?.includes('U19')) {
        continue;
      }
      
      // series_info often returns a short status like "Match ended" without the
      // full result. Fetch match_info for every finished match so we get the
      // accurate status ("England won by 51 runs") and winner fields.
      let winner: string | null = m.winner || null;
      let detailedStatus: string = m.status;
      let matchScore = null;

      if (m.matchEnded) {
        try {
          const res = await fetch(`https://api.cricapi.com/v1/match_info?apikey=${API_KEY}&id=${m.id}`);
          const json = await res.json();
          if (json.status === 'success' && json.data) {
            matchScore = json.data.score || null;
            // Prefer the detailed status from match_info
            if (json.data.status) detailedStatus = json.data.status;
            // Prefer explicit winner field, then derive from status
            if (json.data.winner) {
              winner = json.data.winner;
            } else if (!winner && detailedStatus.includes(' won by ')) {
              winner = detailedStatus.split(' won by ')[0];
            }
          }
        } catch (err) {
          console.error('Error fetching full match info:', err);
        }
      }

      // Fallback: derive winner from series_info status if still null
      if (!winner && m.status && m.status.includes(' won by ')) {
        winner = m.status.split(' won by ')[0];
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
        winner: winner,
        matchStarted: m.matchStarted,
        matchEnded: m.matchEnded,
      };

      if (matchScore) {
        matchData.score = matchScore;
      }

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
          const predictedTeam = pred.predictedWinner?.split('|')[0];
          const predictedMargin = pred.predictedWinner?.split('|')[1];
          
          if (match.winner === predictedTeam) {
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
