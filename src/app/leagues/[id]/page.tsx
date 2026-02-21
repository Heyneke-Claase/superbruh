/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from 'next/navigation';
import Link from 'next/link';
import PredictionForm from '@/components/PredictionForm';
import { createClient } from '@/lib/supabase/server';
import { getTeamFlag } from '@/lib/countryMap';
import MatchInfo from '@/components/MatchInfo';
import RemoveMemberButton from '@/components/RemoveMemberButton';
import DeleteLeagueButton from '@/components/DeleteLeagueButton';
import { getActualMargin } from '@/lib/matchService';

export default async function LeagueDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Run auth + league fetch in parallel
  const [{ data: { user } }, { data: league }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('League')
      .select('id, name, inviteCode, members:Membership(id, userId, joinedAt, user:User(id, name, image))')
      .eq('id', id)
      .single(),
  ]);

  const userId = user?.id;
  if (!userId) redirect('/');
  if (!league) redirect('/leagues');

  // Sort members by creation date to identify owner
  const sortedMembers = (league.members as any[] || []).sort((a: any, b: any) =>
    new Date(a.joinedAt || 0).getTime() - new Date(b.joinedAt || 0).getTime()
  );

  const ownerId = sortedMembers[0]?.userId;
  const isOwner = userId === ownerId;

  // Run matches + predictions in parallel
  const [{ data: matches }, { data: userPredictions }] = await Promise.all([
    supabase
      .from('Match')
      .select('id, team1, team2, dateTimeGMT, status, matchType, venue, winner, matchStarted, matchEnded')
      .ilike('seriesName', '%World Cup%')
      .not('team1', 'ilike', '%U19%')
      .not('team2', 'ilike', '%U19%')
      .order('dateTimeGMT', { ascending: true }),
    supabase
      .from('Prediction')
      .select('matchId, predictedWinner')
      .eq('userId', userId),
  ]);

  const predictionMap = new Map<string, string>((userPredictions || []).map((p: any) => [p.matchId, p.predictedWinner]));

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
          <div className="flex items-center gap-4">
            <Link href="/leagues" prefetch={true} className="text-yellow-400 hover:underline">← Back to Leagues</Link>
            {isOwner && (
              <DeleteLeagueButton leagueId={id} leagueName={league.name} />
            )}
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Link href={`/leagues/${id}/picks`} prefetch={true} className="bg-slate-800 px-4 py-2 rounded-lg font-bold hover:bg-slate-700 flex-1 text-center">All Picks</Link>
            <Link href={`/leagues/${id}/leaderboard`} prefetch={true} className="bg-slate-800 px-4 py-2 rounded-lg font-bold hover:bg-slate-700 flex-1 text-center">Leaderboard</Link>
          </div>
        </div>

        <header className="space-y-2 text-center md:text-left">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black italic text-yellow-400 uppercase tracking-tighter break-words">
            {league.name}
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs sm:text-sm">
            Invite Code: <span className="text-slate-300">{league.inviteCode}</span>
          </p>
          <div className="flex flex-wrap gap-2 pt-2 justify-center md:justify-start">
            <span className="text-xs font-bold text-slate-500 uppercase flex items-center mr-2">{league.members?.length || 0} Members:</span>
            {sortedMembers.map((m: any) => (
              <div key={m.id} className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                {m.user?.image && <img src={m.user.image} alt="" className="w-5 h-5 rounded-full" />}
                <span className="text-xs font-bold text-slate-300">{m.user?.name || 'User'}</span>
                {isOwner && m.userId !== userId && (
                  <RemoveMemberButton leagueId={id} userId={m.userId} userName={m.user?.name || 'User'} />
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
                  <div className="flex items-center justify-center md:justify-start gap-2 sm:gap-4">
                    <span className="text-base sm:text-xl font-bold flex items-center gap-1 sm:gap-2">
                      {getTeamFlag(match.team1) && (
                        <img src={getTeamFlag(match.team1)} alt="" className="w-[1.2em] rounded-sm shadow-sm" />
                      )}
                      {match.team1}
                    </span>
                    <span className="text-slate-600 font-black italic text-sm sm:text-base">VS</span>
                    <span className="text-base sm:text-xl font-bold flex items-center gap-1 sm:gap-2">
                      {match.team2}
                      {getTeamFlag(match.team2) && (
                        <img src={getTeamFlag(match.team2)} alt="" className="w-[1.2em] rounded-sm shadow-sm" />
                      )}
                    </span>
                    <div className="ml-1 sm:ml-2">
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
              <div key={match.id} className="bg-slate-900 p-6 rounded-xl border border-slate-800 opacity-75 grayscale-[0.5] flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex-1 text-center md:text-left">
                  <div className="text-base sm:text-xl font-bold flex items-center justify-center md:justify-start gap-1 sm:gap-2">
                    {getTeamFlag(match.team1) && (
                      <img src={getTeamFlag(match.team1)} alt="" className="w-[1.2em] rounded-sm shadow-sm" />
                    )}
                    {match.team1} vs {match.team2}
                    {getTeamFlag(match.team2) && (
                      <img src={getTeamFlag(match.team2)} alt="" className="w-[1.2em] rounded-sm shadow-sm" />
                    )}
                    <div className="ml-1 sm:ml-2">
                      <MatchInfo matchId={match.id} team1={match.team1} team2={match.team2} />
                    </div>
                  </div>
                  <div className="text-sm text-yellow-400 font-bold uppercase mt-2">
                    Winner: {match.winner || 'TBA'}
                    {match.winner && getActualMargin(match.status) && ` (${getActualMargin(match.status)})`}
                  </div>
                  <div className="mt-4 flex items-center justify-center md:justify-start gap-4">
                    <div className="text-left">
                      <div className="text-xs text-slate-500 uppercase font-bold">Your Pick</div>
                      <div className={`font-bold ${
                        predictionMap.get(match.id)?.split('|')[0] === match.winner 
                          ? (predictionMap.get(match.id)?.split('|')[1] === getActualMargin(match.status) ? 'text-green-400' : 'text-green-600')
                          : 'text-red-500'
                      }`}>
                        {predictionMap.get(match.id)?.split('|')[0] || 'No Pick'}
                      </div>
                      {predictionMap.get(match.id)?.split('|')[1] && (
                        <div className={`text-[10px] uppercase font-bold tracking-wider ${
                          predictionMap.get(match.id)?.split('|')[1] === getActualMargin(match.status)
                            ? 'text-green-400'
                            : 'text-red-500/70'
                        }`}>
                          {predictionMap.get(match.id)?.split('|')[1]}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 w-full md:w-auto">
                   <PredictionForm 
                    matchId={match.id} 
                    team1={match.team1} 
                    team2={match.team2} 
                    currentPrediction={predictionMap.get(match.id)}
                    matchStarted={false} // Override to allow picking old matches
                   />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
