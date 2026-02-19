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

export async function updatePoints() {
  const supabase = await createClient();

  // Get all finished matches
  const { data: finishedMatches } = await supabase
    .from('Match')
    .select('id, winner')
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
        if (match && match.winner === pred.predictedWinner) {
          points += 1;
        }
      }
    }

    await supabase
      .from('Membership')
      .update({ points })
      .eq('id', membership.id);
  }
}
