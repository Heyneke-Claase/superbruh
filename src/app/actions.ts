'use server'

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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

  const inviteCode = formData.get('inviteCode') as string;
  const supabase = await createClient();

  const { data: league } = await supabase
    .from('League')
    .select('id, members:Membership(id)')
    .eq('inviteCode', inviteCode)
    .single();

  if (!league) return;

  // Check if league is full (max 2 members)
  const memberCount = (league.members as any[] || []).length;
  
  const { data: existing } = await supabase
    .from('Membership')
    .select('id')
    .eq('userId', userId)
    .eq('leagueId', league.id)
    .single();

  if (!existing) {
    if (memberCount >= 2) {
      // Could return an error here, but for now just return
      return;
    }
    await supabase.from('Membership').insert({ userId, leagueId: league.id });
  }

  redirect(`/leagues/${league.id}`);
}

export async function predictMatch(matchId: string, winner: string) {
  const userId = await getUserId();
  if (!userId) return;

  const supabase = await createClient();
  await supabase.from('Prediction').upsert(
    { userId, matchId, predictedWinner: winner },
    { onConflict: 'userId,matchId' }
  );
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
    const res = await fetch(url, { next: { revalidate: 60 } }); // Cache for 1 minute
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching match info:', error);
    return { status: 'failure', reason: 'Failed to fetch match info' };
  }
}

