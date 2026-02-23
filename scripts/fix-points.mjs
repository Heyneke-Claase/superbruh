/**
 * Standalone script to:
 * 1. Fetch match_info from the API for any match that should have ended
 *    (scheduled > 4 hours ago) but still has matchEnded=false in the DB.
 * 2. Fix matches that have matchEnded=true but winner=null.
 * 3. Recalculate every membership's points from scratch.
 *
 * Run with:  node scripts/fix-points.mjs
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
for (const line of env.split(/\r?\n/)) {
  const eq = line.indexOf('=');
  if (eq > 0 && line[0] !== '#') process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase env vars'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const API_KEY = '0d758f82-8029-4904-8339-a19df7e9edd3';

// ---------- Helpers ----------
function getActualMargin(status) {
  if (!status) return null;
  const p = status.match(/\((Narrow|Comfortable|Easy|Thrashing)\)/i);
  if (p) return p[1];
  if (status.toLowerCase().includes('super over')) return 'Narrow';
  const runsMatch = status.match(/won by (\d+) runs?/i);
  if (runsMatch) {
    const r = parseInt(runsMatch[1], 10);
    if (r <= 9)  return 'Narrow';
    if (r <= 24) return 'Comfortable';
    if (r <= 39) return 'Easy';
    return 'Thrashing';
  }
  const wktsMatch = status.match(/won by (\d+) wkts?/i) || status.match(/won by (\d+) wickets?/i);
  if (wktsMatch) {
    const w = parseInt(wktsMatch[1], 10);
    if (w <= 2) return 'Narrow';
    if (w <= 5) return 'Comfortable';
    if (w <= 8) return 'Easy';
    return 'Thrashing';
  }
  return null;
}

function winnerFromStatus(status) {
  if (!status) return null;
  if (status.includes(' won by ')) return status.split(' won by ')[0].trim();
  return null;
}

// ---------- Step 1: Fetch match_info for stale matches ----------
console.log('Step 1: Fetching live match_info for matches that should have ended …');

const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;

const { data: staleMatches } = await sb
  .from('Match')
  .select('id, team1, team2, dateTimeGMT, matchEnded, winner, status')
  .eq('matchEnded', false)
  .lt('dateTimeGMT', new Date(fourHoursAgo).toISOString());

console.log(`  Found ${(staleMatches || []).length} stale (not-ended) matches to check.`);

for (const m of (staleMatches || [])) {
  console.log(`\n  Checking: ${m.team1} vs ${m.team2} (${m.dateTimeGMT.slice(0, 16)})`);
  try {
    const res = await fetch(`https://api.cricapi.com/v1/match_info?apikey=${API_KEY}&id=${m.id}`);
    const json = await res.json();
    if (json.status !== 'success' || !json.data) {
      console.log(`    API returned: ${json.status} / ${json.reason || 'unknown'}`);
      continue;
    }
    const d = json.data;
    console.log(`    API matchEnded: ${d.matchEnded}  |  status: ${d.status}`);
    console.log(`    API winner: ${d.winner ?? 'null'}`);

    if (!d.matchEnded) {
      console.log('    Still in progress or API has no result yet — skipping.');
      continue;
    }

    const winner = d.winner || winnerFromStatus(d.status) || winnerFromStatus(m.status);
    let finalStatus = d.status || m.status;
    // Embed margin classification if not already present
    if (finalStatus && !finalStatus.match(/\((Narrow|Comfortable|Easy|Thrashing)\)/i)) {
      const margin = getActualMargin(finalStatus);
      if (margin) finalStatus = `${finalStatus} (${margin})`;
    }
    const update = {
      matchEnded: true,
      matchStarted: true,
      status: finalStatus,
    };
    if (winner) update.winner = winner;

    const { error } = await sb.from('Match').update(update).eq('id', m.id);
    if (error) {
      console.log(`    ✗ DB update failed: ${error.message}`);
    } else {
      console.log(`    ✓ Updated: matchEnded=true, winner="${winner ?? 'null'}"`);
    }
  } catch (err) {
    console.error(`    Error: ${err.message}`);
  }
}

// ---------- Step 2: Embed margin classification in any ended match missing it ----------
console.log('\nStep 2: Embedding margin brackets in ended matches …');
const { data: endedMatches } = await sb.from('Match').select('id, status, winner').eq('matchEnded', true);
let embedded = 0;
for (const m of (endedMatches || [])) {
  if (!m.status || m.status.match(/\((Narrow|Comfortable|Easy|Thrashing)\)/i)) continue;
  const margin = getActualMargin(m.status);
  if (!margin) continue;
  const newStatus = `${m.status} (${margin})`;
  const { error } = await sb.from('Match').update({ status: newStatus }).eq('id', m.id);
  if (!error) { console.log(`  ✓ ${m.status} → ${newStatus}`); embedded++; }
}
console.log(`  Embedded margin in ${embedded} matches.\n`);

// ---------- Step 3: Fix any remaining null winners ----------
console.log('Step 3: Fixing matchEnded=true matches with missing winners …');
const { data: brokenMatches } = await sb.from('Match').select('id, status, winner').eq('matchEnded', true).is('winner', null);

let fixed = 0;
for (const m of (brokenMatches || [])) {
  const derived = winnerFromStatus(m.status);
  if (derived) {
    let fixedStatus = m.status;
    if (!fixedStatus.match(/\((Narrow|Comfortable|Easy|Thrashing)\)/i)) {
      const margin = getActualMargin(fixedStatus);
      if (margin) fixedStatus = `${fixedStatus} (${margin})`;
    }
    const { error } = await sb.from('Match').update({ winner: derived, status: fixedStatus }).eq('id', m.id);
    if (!error) { console.log(`  ✓ Fixed ${m.id}: "${m.status}" → winner="${derived}", status="${fixedStatus}"`); fixed++; }
  }
}
console.log(`  Fixed ${fixed} / ${(brokenMatches || []).length} null-winner matches.\n`);

// ---------- Step 4: Recalculate all member points ----------
console.log('Step 4: Recalculating points for all memberships …');
const { data: finishedMatches } = await sb.from('Match').select('id, winner, status').eq('matchEnded', true);
const { data: memberships } = await sb.from('Membership').select('id, userId');

for (const membership of (memberships || [])) {
  const { data: predictions } = await sb.from('Prediction').select('matchId, predictedWinner').eq('userId', membership.userId);

  let points = 0;
  for (const pred of (predictions || [])) {
    const match = (finishedMatches || []).find(m => m.id === pred.matchId);
    if (!match) continue;

    const effectiveWinner = match.winner || winnerFromStatus(match.status);
    const predictedTeam   = pred.predictedWinner?.split('|')[0];
    const predictedMargin = pred.predictedWinner?.split('|')[1];

    if (effectiveWinner && effectiveWinner === predictedTeam) {
      points += 1;
      const actualMargin = getActualMargin(match.status);
      if (actualMargin && predictedMargin === actualMargin) points += 1;
    }
  }

  const { error } = await sb.from('Membership').update({ points }).eq('id', membership.id);
  if (error) {
    console.error(`  ✗ Membership ${membership.id}: ${error.message}`);
  } else {
    console.log(`  ✓ Membership ${membership.id} (user ${membership.userId.slice(0, 8)}) → ${points} pts`);
  }
}

console.log('\nDone!');
