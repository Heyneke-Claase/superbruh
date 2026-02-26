/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ReactCountryFlag from 'react-country-flag';
import { getCountryCode } from '@/lib/countryMap';
import MatchInfo from '@/components/MatchInfo';
import ScrollToMatch from '@/components/ScrollToMatch';
import { getActualMargin } from '@/lib/matchService';
import LiveRefresh from '@/components/LiveRefresh';
import AutoSync from '@/components/AutoSync';

export const dynamic = 'force-dynamic';

export default async function PicksPage({ params }: { params: Promise<{ id: string }> | any }) {
  const { id } = await params;
  const supabase = await createClient();

  // NOTE: With only 100 API hits/day, we rely on the cron job (every 15 min) for syncing.
  // Pages display cached data. The syncAndScore() function is only called by:
  // 1. Vercel cron job every 15 minutes
  // 2. AutoSync component during live matches (rate-limited to once per 30 min)
  // 3. Manual ForceSyncButton if user explicitly requests it

  // Fetch auth + league in parallel
  const [{ data: { user } }, { data: league }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('League')
      .select('id, name, members:Membership(id, userId, user:User(id, name, image))')
      .eq('id', id)
      .single(),
  ]);

  if (!league) redirect('/leagues');
  if (!user) redirect('/');
  const currentUserId = user.id;

  const memberUserIds = (league.members as any[] || []).map((m: any) => m.userId);

  // Fetch matches + predictions in parallel
  const [{ data: matches }, { data: allPredictions }] = await Promise.all([
    supabase
      .from('Match')
      .select('id, team1, team2, dateTimeGMT, status, winner, matchStarted, matchEnded')
      .ilike('seriesName', '%World Cup%')
      .not('team1', 'ilike', '%U19%')
      .not('team2', 'ilike', '%U19%')
      .order('dateTimeGMT', { ascending: true }),
    supabase
      .from('Prediction')
      .select('matchId, userId, predictedWinner')
      .in('userId', memberUserIds),
  ]);

  // Build O(1) nested lookup: matchId -> userId -> predictedWinner
  const pickMap = new Map<string, Map<string, string>>();
  for (const p of (allPredictions || []) as any[]) {
    if (!pickMap.has(p.matchId)) pickMap.set(p.matchId, new Map());
    pickMap.get(p.matchId)!.set(p.userId, p.predictedWinner);
  }

  const activeMatch = (matches || []).find((m: any) => !m.matchEnded) || (matches || [])[(matches || []).length - 1];
  const activeMatchId = activeMatch?.id;

  const getPick = (match: any, userId: string) => {
    const matchPicks = pickMap.get(match.id);
    const currentUserPick = matchPicks?.get(currentUserId);
    const targetUserPick = matchPicks?.get(userId);

    // Always show your own pick to yourself
    if (userId === currentUserId) {
      if (targetUserPick) return targetUserPick;
      if (match.matchStarted) return 'No Pick';
      return 'Hidden';
    }

    // Show others' picks if match started
    if (match.matchStarted) {
      if (targetUserPick) return targetUserPick;
      return 'No Pick';
    }

    // For others' picks before match starts, only show if BOTH have picked
    if (currentUserPick && targetUserPick) {
      return targetUserPick;
    }

    return 'Hidden';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <LiveRefresh intervalMs={30_000} />
      {/* Trigger a sync automatically whenever a match is live */}
      <AutoSync matchTimes={(matches || []).filter((m: any) => !m.matchEnded).map((m: any) => m.dateTimeGMT)} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
          <Link href={`/leagues/${id}`} prefetch={true} className="text-yellow-400 hover:underline">← Back to Fixtures</Link>
          <div className="flex gap-2 w-full md:w-auto">
            <div className="bg-slate-800 px-4 py-2 rounded-lg font-bold text-slate-400 flex-1 text-center cursor-default">All Picks</div>
            <Link href={`/leagues/${id}/leaderboard`} prefetch={true} className="bg-slate-800 px-4 py-2 rounded-lg font-bold hover:bg-slate-700 flex-1 text-center">Leaderboard</Link>
          </div>
        </div>

        <header className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black italic text-yellow-400 uppercase tracking-tighter break-words">
            {league.name}
          </h1>
          <p className="text-slate-400 font-medium italic text-sm md:text-base">Head to Head Picks</p>
        </header>

        <div className="space-y-6">
          <ScrollToMatch matchId={activeMatchId} />
          {(matches || []).map((match: any) => (
            <div key={match.id} id={`match-${match.id}`} className="bg-slate-900 p-6 rounded-xl border border-slate-800">
              <div className="text-center mb-6">
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
                <div className="flex items-center justify-center gap-2 sm:gap-4">
                  <span className="text-base sm:text-xl font-bold flex items-center gap-1 sm:gap-2">
                    {match.team1 === 'West Indies' ? (
                      <img src="/west-indies-cricket-board-flag.svg" alt="WI" className="w-[1.4em] h-[1em] object-cover rounded-[2px]" />
                    ) : (
                      getCountryCode(match.team1) && <ReactCountryFlag countryCode={getCountryCode(match.team1)} svg style={{ width: '1.4em', height: '1em' }} />
                    )}
                    {match.team1}
                  </span>
                  <span className="text-slate-600 font-black italic text-sm sm:text-base">VS</span>
                  <span className="text-base sm:text-xl font-bold flex items-center gap-1 sm:gap-2">
                    {match.team2}
                    {match.team2 === 'West Indies' ? (
                      <img src="/west-indies-cricket-board-flag.svg" alt="WI" className="w-[1.4em] h-[1em] object-cover rounded-[2px]" />
                    ) : (
                      getCountryCode(match.team2) && <ReactCountryFlag countryCode={getCountryCode(match.team2)} svg style={{ width: '1.4em', height: '1em' }} />
                    )}
                  </span>
                  <div className="ml-1 sm:ml-2">
                    <MatchInfo matchId={match.id} team1={match.team1} team2={match.team2} />
                  </div>
                </div>
                {match.matchEnded && (
                  <div className="text-sm text-yellow-400 font-bold uppercase mt-2">
                    Winner: {match.winner || 'TBA'} 
                    {match.winner && getActualMargin(match.status) && ` (${getActualMargin(match.status)})`}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {(league.members as any[] || []).map((m: any) => {
                  const pick = getPick(match, m.userId);
                  const pickTeam = pick.split('|')[0];
                  const pickMargin = pick.split('|')[1];
                  
                  const actualMargin = getActualMargin(match.status);
                  const isCorrectTeam = match.matchEnded && pickTeam === match.winner;
                  const isCorrectMargin = isCorrectTeam && pickMargin === actualMargin;
                  const isWrongTeam = match.matchEnded && pickTeam !== match.winner && pick !== 'No Pick' && pick !== 'Hidden';
                  
                  let pointsScored = 0;
                  if (match.matchEnded && pick !== 'Hidden' && pick !== 'No Pick') {
                    if (isCorrectTeam) pointsScored += 1;
                    if (isCorrectMargin) pointsScored += 1;
                  }
                  
                  return (
                    <div key={m.id} className="bg-slate-800/50 p-3 rounded-lg flex items-center justify-between border border-slate-700/50">
                      <div className="flex items-center gap-2">
                        {m.user.image && (
                          <img src={m.user.image} alt="" className="w-6 h-6 rounded-full border border-slate-600" />
                        )}
                        <span className="font-bold text-sm truncate max-w-[100px]">{m.user.name}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className={`text-sm font-bold ${
                          pick === 'Hidden' ? 'text-slate-500 italic' :
                          pick === 'No Pick' ? 'text-red-500/50' :
                          isCorrectMargin ? 'text-green-400' :
                          isCorrectTeam ? 'text-green-600' :
                          isWrongTeam ? 'text-red-500' :
                          'text-white'
                        }`}>
                          {pickTeam}
                        </div>
                        {pickMargin && pick !== 'Hidden' && pick !== 'No Pick' && (
                          <div className={`text-[10px] uppercase font-bold tracking-wider ${
                            match.matchEnded 
                              ? (isCorrectMargin ? 'text-green-400' : 'text-red-500/70')
                              : 'text-slate-400'
                          }`}>
                            {pickMargin}
                          </div>
                        )}
                        {match.matchEnded && pick !== 'Hidden' && pick !== 'No Pick' && (
                          <div className="text-[10px] font-black text-yellow-400 mt-0.5 bg-yellow-400/10 px-1.5 py-0.5 rounded">
                            +{pointsScored} PT{pointsScored !== 1 ? 'S' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
