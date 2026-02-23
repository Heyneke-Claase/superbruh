/**
 * Standalone script to:
 * 1. Fix matches that have matchEnded=true but winner=null by deriving the
 *    winner from the status string.
 * 2. Recalculate every membership's points from scratch using both the stored
 *    winner AND the status-derived winner as a fallback.
 *
 * Run with:  node scripts/fix-points.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------- Load .env.local ----------
// Use process.cwd() so the script works when run from the project root
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
// Parse every key=value line (handles both LF and CRLF)
for (const line of envContent.split(/\r?\n/)) {
  const eqIdx = line.indexOf('=');
  if (eqIdx < 1 || line[0] === '#') continue;
  const k = line.slice(0, eqIdx).trim();
  const v = line.slice(eqIdx + 1).trim();
  if (k) process.env[k] = v;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

// ---------- Step 1: Fix null winners in DB ----------
console.log('Step 1: Fixing matches with matchEnded=true but winner=null …');
const { data: brokenMatches, error: bmErr } = await supabase
  .from('Match')
  .select('id, status, winner')
  .eq('matchEnded', true)
  .is('winner', null);

if (bmErr) { console.error('Error querying matches:', bmErr); process.exit(1); }

let fixed = 0;
for (const m of (brokenMatches || [])) {
  const derived = winnerFromStatus(m.status);
  if (derived) {
    const { error } = await supabase.from('Match').update({ winner: derived }).eq('id', m.id);
    if (error) {
      console.error(`  ✗ Could not fix match ${m.id}:`, error.message);
    } else {
      console.log(`  ✓ Fixed match ${m.id}: status="${m.status}" → winner="${derived}"`);
      fixed++;
    }
  } else {
    console.log(`  ~ Match ${m.id} status="${m.status}" — cannot derive winner, skipping`);
  }
}
console.log(`  Fixed ${fixed} / ${(brokenMatches || []).length} null-winner matches.\n`);

// ---------- Step 2: Recalculate all member points ----------
console.log('Step 2: Recalculating points for all memberships …');
const { data: finishedMatches, error: fmErr } = await supabase
  .from('Match')
  .select('id, winner, status')
  .eq('matchEnded', true);

if (fmErr) { console.error('Error querying finished matches:', fmErr); process.exit(1); }

const { data: memberships, error: memErr } = await supabase
  .from('Membership')
  .select('id, userId');

if (memErr) { console.error('Error querying memberships:', memErr); process.exit(1); }

for (const membership of (memberships || [])) {
  const { data: predictions } = await supabase
    .from('Prediction')
    .select('matchId, predictedWinner')
    .eq('userId', membership.userId);

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
      if (actualMargin && predictedMargin === actualMargin) {
        points += 1;
      }
    }
  }

  const { error: upErr } = await supabase
    .from('Membership')
    .update({ points })
    .eq('id', membership.id);

  if (upErr) {
    console.error(`  ✗ Could not update membership ${membership.id}:`, upErr.message);
  } else {
    console.log(`  ✓ Membership ${membership.id} (user ${membership.userId}) → ${points} pts`);
  }
}

console.log('\nDone!');
