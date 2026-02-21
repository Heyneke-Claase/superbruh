import { createClient } from './supabase/server';

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
      
      let winner = m.winner || null;
      if (!winner && m.status && m.status.includes(' won by ')) {
        winner = m.status.split(' won by ')[0];
      }
      
      let matchScore = null;
      if (m.matchEnded) {
        try {
          const res = await fetch(`https://api.cricapi.com/v1/match_info?apikey=${API_KEY}&id=${m.id}`);
          const json = await res.json();
          matchScore = json.data?.score || null;
        } catch (err) {
          console.error('Error fetching full match score:', err);
        }
      }

      const matchData: any = {
        id: m.id,
        team1: m.teams[0],
        team2: m.teams[1],
        seriesName: seriesName,
        dateTimeGMT: new Date(m.dateTimeGMT).toISOString(),
        status: m.status,
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

export function getActualMargin(status: string | null): string | null {
  if (!status || typeof status !== 'string') return null;
  
  try {
    // 1. Check for previously calculated margin in status parentheses
    const parenthesized = status.match(/\((Narrow|Comfortable|Easy|Thrashing)\)/i);
    if (parenthesized) return parenthesized[1];

    const statusLower = status.toLowerCase();
    
    // Super Over is always Narrow
    if (statusLower.includes('super over')) {
      return 'Narrow';
    }

    // Winner Batted First (Runs)
    const runsMatch = status.match(/won by (\d+) runs?/i);
    if (runsMatch) {
      const runs = parseInt(runsMatch[1], 10);
      if (runs <= 9) return 'Narrow';
      if (runs <= 24) return 'Comfortable';
      if (runs <= 39) return 'Easy';
      return 'Thrashing';
    }
    
    // Winner Batted Second (Wickets Fallback - preferred and correct calculations are stored during sync)
    const wktsMatch = status.match(/won by (\d+) wkts?/i) || status.match(/won by (\d+) wickets?/i);
    if (wktsMatch) {
      const wickets = parseInt(wktsMatch[1], 10);
      if (wickets >= 9) return 'Thrashing';
      if (wickets >= 6) return 'Easy';
      if (wickets >= 3) return 'Comfortable';
      return 'Narrow';
    }
  } catch (err) {
    console.error('Error parsing margin:', err);
  }
  
  return null;
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
