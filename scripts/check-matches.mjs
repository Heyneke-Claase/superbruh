import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
for (const line of env.split(/\r?\n/)) {
  const eq = line.indexOf('=');
  if (eq > 0 && line[0] !== '#') process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Last 10 matches by date
const { data: matches } = await sb
  .from('Match')
  .select('id, team1, team2, dateTimeGMT, matchEnded, matchStarted, winner, status')
  .order('dateTimeGMT', { ascending: false })
  .limit(10);

console.log('=== LAST 10 MATCHES ===');
for (const m of matches) {
  console.log(`\n${m.team1} vs ${m.team2}  |  ${m.dateTimeGMT.slice(0, 16)}`);
  console.log(`  matchEnded: ${m.matchEnded}  |  winner: ${m.winner}`);
  console.log(`  status: ${m.status}`);
}

// Show all predictions for matches that ended
console.log('\n\n=== PREDICTIONS FOR FINISHED MATCHES ===');
const finishedIds = matches.filter(m => m.matchEnded).map(m => m.id);
const { data: preds } = await sb
  .from('Prediction')
  .select('userId, matchId, predictedWinner')
  .in('matchId', finishedIds);

for (const p of preds || []) {
  const match = matches.find(m => m.id === p.matchId);
  console.log(`\nUser ${p.userId.slice(0,8)} | ${match?.team1} vs ${match?.team2}`);
  console.log(`  predicted: ${p.predictedWinner}  |  actual winner: ${match?.winner}`);
}

// Show current membership points
console.log('\n\n=== CURRENT MEMBERSHIP POINTS ===');
const { data: mems } = await sb.from('Membership').select('id, userId, points');
for (const m of mems || []) console.log(`  ${m.userId.slice(0,8)} → ${m.points} pts`);
