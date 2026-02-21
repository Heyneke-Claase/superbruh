/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ReactCountryFlag from 'react-country-flag';
import { getCountryCode } from '@/lib/countryMap';
import MatchInfo from '@/components/MatchInfo';
import ScrollToMatch from '@/components/ScrollToMatch';

export default async function PicksPage({ params }: { params: Promise<{ id: string }> | any }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: league } = await supabase
    .from('League')
    .select('*, members:Membership(*, user:User(*))')
    .eq('id', id)
    .single();

  if (!league) redirect('/leagues');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');
  const currentUserId = user.id;

  const memberUserIds = (league.members as any[] || []).map(m => m.userId);

  const { data: matches } = await supabase
    .from('Match')
    .select('*')
    .ilike('seriesName', '%World Cup%')
    .not('team1', 'ilike', '%U19%')
    .not('team2', 'ilike', '%U19%')
    .order('dateTimeGMT', { ascending: true });

  const { data: allPredictions } = await supabase
    .from('Prediction')
    .select('*')
    .in('userId', memberUserIds);

  const activeMatch = (matches || []).find((m: any) => !m.matchEnded) || (matches || [])[(matches || []).length - 1];
  const activeMatchId = activeMatch?.id;

  const getPick = (match: any, userId: string) => {
    const currentUserPick = (allPredictions || []).find((p: any) => p.matchId === match.id && p.userId === currentUserId);
    const targetUserPick = (allPredictions || []).find((p: any) => p.matchId === match.id && p.userId === userId);
    
    // Always show your own pick to yourself
    if (userId === currentUserId) {
      if (targetUserPick) return targetUserPick.predictedWinner;
      if (match.matchStarted) return 'No Pick';
      return 'Hidden';
    }

    // Show others' picks if match started
    if (match.matchStarted) {
      if (targetUserPick) return targetUserPick.predictedWinner;
      return 'No Pick';
    }

    // For others' picks before match starts, only show if BOTH have picked
    if (currentUserPick && targetUserPick) {
      return targetUserPick.predictedWinner;
    }

    return 'Hidden';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
          <Link href={`/leagues/${id}`} prefetch={true} className="text-yellow-400 hover:underline">← Back to Fixtures</Link>
          <div className="flex gap-2 w-full md:w-auto">
            <div className="bg-slate-800 px-4 py-2 rounded-lg font-bold text-slate-400 flex-1 text-center cursor-default">All Picks</div>
            <Link href={`/leagues/${id}/leaderboard`} prefetch={true} className="bg-slate-800 px-4 py-2 rounded-lg font-bold hover:bg-slate-700 flex-1 text-center">Leaderboard</Link>
          </div>
        </div>

        <header className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-black italic text-yellow-400 uppercase tracking-tighter">
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
                <div className="flex items-center justify-center gap-4">
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
                {match.matchEnded && (
                  <div className="text-sm text-yellow-400 font-bold uppercase mt-2">Winner: {match.winner || 'TBA'}</div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {(league.members as any[] || []).map((m: any) => {
                  const pick = getPick(match, m.userId);
                  const isCorrect = match.matchEnded && pick === match.winner;
                  const isWrong = match.matchEnded && pick !== match.winner && pick !== 'No Pick' && pick !== 'Hidden';
                  
                  return (
                    <div key={m.id} className="bg-slate-800/50 p-3 rounded-lg flex items-center justify-between border border-slate-700/50">
                      <div className="flex items-center gap-2">
                        {m.user.image && (
                          <img src={m.user.image} alt="" className="w-6 h-6 rounded-full border border-slate-600" />
                        )}
                        <span className="font-bold text-sm truncate max-w-[100px]">{m.user.name}</span>
                      </div>
                      <div className={`text-sm font-bold ${
                        pick === 'Hidden' ? 'text-slate-500 italic' :
                        pick === 'No Pick' ? 'text-red-500/50' :
                        isCorrect ? 'text-green-500' :
                        isWrong ? 'text-red-500' :
                        'text-white'
                      }`}>
                        {pick}
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
