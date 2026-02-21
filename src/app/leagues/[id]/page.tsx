/* eslint-disable @typescript-eslint/no-explicit-any */
import { syncMatches } from '@/lib/matchService';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import PredictionForm from '@/components/PredictionForm';
import { createClient } from '@/lib/supabase/server';
import ReactCountryFlag from 'react-country-flag';
import { getCountryCode } from '@/lib/countryMap';
import MatchInfo from '@/components/MatchInfo';
import RemoveMemberButton from '@/components/RemoveMemberButton';

export default async function LeagueDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!userId) redirect('/');

  // Sync matches to ensure we have latest data
  // await syncMatches(); // Removed to speed up page load. Sync should be done via a cron job or separate admin action.

  const { data: league } = await supabase
    .from('League')
    .select('*, members:Membership(*, user:User(*))')
    .eq('id', id)
    .single();

  if (!league) redirect('/leagues');

  // Sort members by creation date to identify owner
  const sortedMembers = (league.members as any[] || []).sort((a: any, b: any) => 
    new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
  );
  
  const ownerId = sortedMembers[0]?.userId;
  const isOwner = userId === ownerId;

  const { data: matches } = await supabase
    .from('Match')
    .select('*')
    .ilike('seriesName', '%World Cup%')
    .not('team1', 'ilike', '%U19%')
    .not('team2', 'ilike', '%U19%')
    .order('dateTimeGMT', { ascending: true });

  const { data: userPredictions } = await supabase
    .from('Prediction')
    .select('*')
    .eq('userId', userId);

  const predictionMap = new Map<string, string>((userPredictions || []).map((p: any) => [p.matchId, p.predictedWinner]));

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
          <Link href="/leagues" prefetch={true} className="text-yellow-400 hover:underline">← Back to Leagues</Link>
          <div className="flex gap-2 w-full md:w-auto">
            <Link href={`/leagues/${id}/picks`} prefetch={true} className="bg-slate-800 px-4 py-2 rounded-lg font-bold hover:bg-slate-700 flex-1 text-center">All Picks</Link>
            <Link href={`/leagues/${id}/leaderboard`} prefetch={true} className="bg-slate-800 px-4 py-2 rounded-lg font-bold hover:bg-slate-700 flex-1 text-center">Leaderboard</Link>
          </div>
        </div>

        <header className="space-y-2 text-center md:text-left">
          <h1 className="text-4xl font-black italic text-yellow-400 uppercase tracking-tighter">
            {league.name}
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">
            Invite Code: <span className="text-slate-300">{league.inviteCode}</span>
          </p>
          <div className="flex flex-wrap gap-2 pt-2 justify-center md:justify-start">
            <span className="text-xs font-bold text-slate-500 uppercase flex items-center mr-2">{league.members?.length || 0} Members:</span>
            {sortedMembers.map((m: any) => (
              <div key={m.id} className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                {m.user.image && <img src={m.user.image} alt="" className="w-5 h-5 rounded-full" />}
                <span className="text-xs font-bold text-slate-300">{m.user.name}</span>
                {isOwner && m.userId !== userId && (
                  <RemoveMemberButton leagueId={id} userId={m.userId} userName={m.user.name} />
                )}
              </div>
            ))}
          </div>
        </header>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold uppercase text-slate-400 border-b border-slate-800 pb-2">Upcoming Fixtures</h2>
          <div className="grid gap-4">
            {(matches || []).filter((m: any) => !m.matchEnded).map((match: any) => (
              <div key={match.id} className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex-1 text-center md:text-left">
                  <div suppressHydrationWarning className="text-xs text-slate-500 font-bold uppercase mb-2">
                    {new Date(match.dateTimeGMT).toLocaleString('en-ZA', { 
                      weekday: 'short', 
                      day: 'numeric', 
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Africa/Johannesburg'
                    })}
                  </div>
                  <div className="flex items-center justify-center md:justify-start gap-4">
                    <span className="text-xl font-bold flex items-center gap-2">
                      {getCountryCode(match.team1) && <ReactCountryFlag countryCode={getCountryCode(match.team1)} svg />}
                      {match.team1}
                    </span>
                    <span className="text-slate-600 font-black italic">VS</span>
                    <span className="text-xl font-bold flex items-center gap-2">
                      {match.team2}
                      {getCountryCode(match.team2) && <ReactCountryFlag countryCode={getCountryCode(match.team2)} svg />}
                    </span>
                    <div className="ml-2">
                      <MatchInfo matchId={match.id} team1={match.team1} team2={match.team2} />
                    </div>
                  </div>
                  <div className="text-sm text-slate-500 mt-2 italic">{match.venue}</div>
                </div>

                <div className="flex-1 w-full md:w-auto">
                   <PredictionForm 
                    matchId={match.id} 
                    team1={match.team1} 
                    team2={match.team2} 
                    currentPrediction={predictionMap.get(match.id)}
                    matchStarted={match.matchStarted}
                   />
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-bold uppercase text-slate-400 border-b border-slate-800 pb-2 pt-8">Completed Matches</h2>
          <div className="grid gap-4">
             {(matches || []).filter((m: any) => m.matchEnded).map((match: any) => (
              <div key={match.id} className="bg-slate-900 p-6 rounded-xl border border-slate-800 opacity-75 grayscale-[0.5]">
                <div className="flex justify-between items-center">
                   <div>
                      <div className="text-xl font-bold flex items-center gap-2">
                        {getCountryCode(match.team1) && <ReactCountryFlag countryCode={getCountryCode(match.team1)} svg />}
                        {match.team1} vs {match.team2}
                        {getCountryCode(match.team2) && <ReactCountryFlag countryCode={getCountryCode(match.team2)} svg />}
                        <MatchInfo matchId={match.id} team1={match.team1} team2={match.team2} />
                      </div>
                      <div className="text-sm text-yellow-400 font-bold uppercase">Winner: {match.winner || 'TBA'}</div>
                   </div>
                   <div className="text-right">
                      <div className="text-xs text-slate-500 uppercase font-bold">Your Pick</div>
                      <div className={`font-bold ${predictionMap.get(match.id) === match.winner ? 'text-green-500' : 'text-red-500'}`}>
                        {predictionMap.get(match.id) || 'No Pick'}
                      </div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
