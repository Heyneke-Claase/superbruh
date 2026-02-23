import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
for (const line of env.split(/\r?\n/)) {
  const eq = line.indexOf('=');
  if (eq > 0 && line[0] !== '#') process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// All matches including ended, ordered ascending so recent games are at bottom
const { data: matches } = await sb
  .from('Match')
  .select('id, team1, team2, dateTimeGMT, matchEnded, matchStarted, winner, status')
  .order('dateTimeGMT', { ascending: true });

console.log('=== ALL MATCHES ===');
for (const m of matches) {
  const tag = m.matchEnded ? '[ENDED]' : m.matchStarted ? '[LIVE] ' : '[  -  ]';
  console.log(`${tag} ${m.team1} vs ${m.team2}  |  ${m.dateTimeGMT.slice(0,16)}  |  winner: ${m.winner ?? 'null'}  |  status: ${(m.status||'').slice(0,60)}`);
}

// Now call the live API to see what it returns for the recent matches
const API_KEY = '0d758f82-8029-4904-8339-a19df7e9edd3';
const SERIES_ID = '0cdf6736-ad9b-4e95-a647-5ee3a99c5510';
console.log('\n\n=== LIVE API DATA (series_info) ===');
const res = await fetch(`https://api.cricapi.com/v1/series_info?apikey=${API_KEY}&id=${SERIES_ID}`);
const json = await res.json();
if (json.status !== 'success') { console.error('API error:', json); process.exit(1); }

// Show last 5 matches from API ordered by date
const apiMatches = json.data.matchList
  .filter(m => !m.teams[0].includes('U19') && !m.teams[1].includes('U19'))
  .sort((a, b) => new Date(a.dateTimeGMT) - new Date(b.dateTimeGMT));

console.log(`Total API matches: ${apiMatches.length}`);
const recentApi = apiMatches.slice(-8);
for (const m of recentApi) {
  console.log(`\n  ${m.teams[0]} vs ${m.teams[1]}  |  ${m.dateTimeGMT?.slice(0,16)}`);
  console.log(`  matchEnded: ${m.matchEnded}  |  matchStarted: ${m.matchStarted}`);
  console.log(`  status: ${m.status}`);
  console.log(`  winner: ${m.winner ?? 'null'}`);
}
