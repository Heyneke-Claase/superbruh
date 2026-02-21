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
      
      const matchData = {
        id: m.id,
        team1: m.teams[0],
        team2: m.teams[1],
        seriesName: seriesName,
        dateTimeGMT: new Date(m.dateTimeGMT).toISOString(),
        status: m.status,
        matchType: m.matchType,
        venue: m.venue,
        winner: m.winner || null,
        matchStarted: m.matchStarted,
        matchEnded: m.matchEnded,
      };

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
    const runsMatch = status.match(/won by (\d+) runs?/i);
    if (runsMatch) {
      const runs = parseInt(runsMatch[1], 10);
      if (runs <= 9) return 'Narrow';
      if (runs <= 24) return 'Comfortable';
      if (runs <= 39) return 'Easy';
      return 'Thrashing';
    }
    
    const wktsMatch = status.match(/won by (\d+) wkts?/i) || status.match(/won by (\d+) wickets?/i);
    if (wktsMatch) {
      const wkts = parseInt(wktsMatch[1], 10);
      if (wkts <= 2) return 'Narrow';
      if (wkts <= 5) return 'Comfortable';
      if (wkts <= 8) return 'Easy';
      return 'Thrashing';
    }
    
    if (status.toLowerCase().includes('super over')) {
      return 'Narrow';
    }
  } catch (err) {
    console.error('Error parsing margin:', err);
  }
  
  return null;
}

export async function updatePoints() {
  const supabase = await createClient();

  // Get all finished matches
  const { data: finishedMatches } = await supabase
    .from('Match')
    .select('id, winner, status')
    .eq('matchEnded', true);

  if (!finishedMatches) return;

  // Get all memberships
  const { data: memberships } = await supabase
    .from('Membership')
    .select('id, userId');

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
