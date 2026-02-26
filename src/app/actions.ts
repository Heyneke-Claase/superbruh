'use server'

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { updatePoints, syncMatches, getActualMargin } from '@/lib/matchService';

async function getUserId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id;
}

export async function updateName(formData: FormData) {
  const userId = await getUserId();
  if (!userId) return;

  const name = formData.get('name') as string;
  if (!name) return;

  const supabase = await createClient();
  await supabase.from('User').update({ name, onboarded: true }).eq('id', userId);
}

export async function createLeague(formData: FormData) {
  const userId = await getUserId();
  if (!userId) return;

  const name = formData.get('name') as string;
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const supabase = await createClient();
  
  // NOTE: Predictions are currently global per user, so creating a new league 
  // resets the user's picks to provide a clean slate for the new competition.
  await supabase.from('Prediction').delete().eq('userId', userId);

  const { data: league, error } = await supabase
    .from('League')
    .insert({ name, inviteCode })
    .select()
    .single();

  if (league) {
    await supabase.from('Membership').insert({ userId, leagueId: league.id });
    redirect(`/leagues/${league.id}`);
  }
}

export async function joinLeague(formData: FormData) {
  const userId = await getUserId();
  if (!userId) return;

  const inviteCodeInput = formData.get('inviteCode') as string;
  if (!inviteCodeInput) return;
  
  const inviteCode = inviteCodeInput.trim().toUpperCase();
  const supabase = await createClient();

  // 1. Find the league by invite code
  const { data: league } = await supabase
    .from('League')
    .select('id')
    .eq('inviteCode', inviteCode)
    .maybeSingle();

  if (!league) {
    console.error('League not found with code:', inviteCode);
    return;
  }

  const leagueId = league.id;

  // 2. Check if already a member
  const { data: existing } = await supabase
    .from('Membership')
    .select('id')
    .eq('userId', userId)
    .eq('leagueId', leagueId)
    .maybeSingle();

  if (existing) {
    redirect(`/leagues/${leagueId}`);
  }

  // 3. Check member count
  const { count, error: countError } = await supabase
    .from('Membership')
    .select('*', { count: 'exact', head: true })
    .eq('leagueId', leagueId);

  if ((count || 0) >= 2) {
    console.error('League is full:', inviteCode);
    return;
  }

  // 4. Join the league
  const { error: insertError } = await supabase
    .from('Membership')
    .insert({ userId, leagueId });

  if (insertError) {
    console.error('Error joining league:', insertError);
    return;
  }

  redirect(`/leagues/${leagueId}`);
}

export async function predictMatch(matchId: string, winner: string) {
  const userId = await getUserId();
  if (!userId) return;

  const supabase = await createClient();
  await supabase.from('Prediction').upsert(
    { userId, matchId, predictedWinner: winner },
    { onConflict: 'userId,matchId' }
  );

  // Update points instantly for this user in case they are predicting an old match
  await updatePoints(userId);
}

export async function removeMember(leagueId: string, targetUserId: string) {
  const currentUserId = await getUserId();
  if (!currentUserId) return;

  const supabase = await createClient();

  // Check if current user is the owner (first member)
  const { data: members } = await supabase
    .from('Membership')
    .select('userId')
    .eq('leagueId', leagueId)
    .order('joinedAt', { ascending: true });

  if (!members || members.length === 0 || members[0].userId !== currentUserId) {
    throw new Error('Only the league owner can remove members');
  }

  // Cannot remove yourself
  if (currentUserId === targetUserId) {
    throw new Error('You cannot remove yourself from the league');
  }

  await supabase
    .from('Membership')
    .delete()
    .eq('leagueId', leagueId)
    .eq('userId', targetUserId);
}

export async function getMatchInfo(matchId: string) {
  const API_KEY = '0d758f82-8029-4904-8339-a19df7e9edd3';
  const url = `https://api.cricapi.com/v1/match_info?apikey=${API_KEY}&id=${matchId}`;
  
  try {
    // cache: 'no-store' — server actions cannot use next.revalidate (that's for
    // Server Components / Route Handlers only). Always fetch fresh in an action.
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return { status: 'failure', reason: `HTTP ${res.status} ${res.statusText}` };
    }
    const data = await res.json();
    if (data.status !== 'success') {
      return { status: 'failure', reason: data.reason || data.message || 'API returned failure' };
    }

    // If the match has ended, persist the result to the DB immediately so the
    // leaderboard and all-picks pages reflect it on their next render — without
    // waiting for the cron job to run.
    if (data.data?.matchEnded) {
      const d = data.data;

      // Derive winner from the explicit field or parse from status string
      let winner: string | null = d.winner || null;
      if (!winner && d.status?.includes(' won by ')) {
        winner = d.status.split(' won by ')[0].trim();
      }

      // Embed margin category into status string if not already there
      let status: string = d.status || '';
      if (status && !status.match(/\((Narrow|Comfortable|Easy|Thrashing)\)/i)) {
        const margin = getActualMargin(status);
        if (margin) status = `${status} (${margin})`;
      }

      const supabase = await createClient();

      // Only update fields we have fresh data for — never overwrite a good winner with null
      const update: Record<string, unknown> = {
        matchEnded: true,
        matchStarted: true,
        status,
      };
      if (winner) update.winner = winner;
      if (d.score) update.score = d.score;

      await supabase.from('Match').update(update).eq('id', matchId);

      await updatePoints();

      revalidatePath('/leagues');
      revalidatePath('/leagues/*');
    }

    return data;
  } catch (error: any) {
    console.error('Error fetching match info:', error);
    return { status: 'failure', reason: error?.message || 'Network error' };
  }
}

export async function deleteLeague(leagueId: string) {
  const currentUserId = await getUserId();
  if (!currentUserId) return;

  const supabase = await createClient();

  // Check if current user is the owner (first member)
  const { data: members } = await supabase
    .from('Membership')
    .select('userId')
    .eq('leagueId', leagueId)
    .order('joinedAt', { ascending: true });

  if (!members || members.length === 0 || members[0].userId !== currentUserId) {
    throw new Error('Only the league owner can delete the league');
  }

  // Clear predictions for all members of this league so they have a fresh start elsewhere
  const memberIds = members.map(m => m.userId);
  await supabase.from('Prediction').delete().in('userId', memberIds);

  // Deleting the league will cascade to memberships if the foreign key is set up with ON DELETE CASCADE.
  // If not, we delete them manually.
  await supabase.from('Membership').delete().eq('leagueId', leagueId);
  await supabase.from('League').delete().eq('id', leagueId);

  redirect('/leagues');
}

export async function forceSync() {
  const userId = await getUserId();
  if (!userId) return;

  // Only allow authenticated users to trigger a manual sync
  await syncMatches();
  revalidatePath('/leagues');
  revalidatePath('/leagues/*');
}
