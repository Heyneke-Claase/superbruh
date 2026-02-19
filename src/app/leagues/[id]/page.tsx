/* eslint-disable @typescript-eslint/no-explicit-any */
import { syncMatches } from '@/lib/matchService';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import PredictionForm from '@/components/PredictionForm';
import { createClient } from '@/lib/supabase/server';

export default async function LeagueDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!userId) redirect('/');

  // Sync matches to ensure we have latest data
  await syncMatches();

  const { data: league } = await supabase
    .from('League')
    .select('*, members:Membership(*, user:User(*))')
    .eq('id', id)
    .single();

  if (!league) redirect('/leagues');

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
          <Link href="/leagues" className="text-yellow-400 hover:underline">← Back to Leagues</Link>
          <Link href={`/leagues/${id}/leaderboard`} className="bg-slate-800 px-4 py-2 rounded-lg font-bold hover:bg-slate-700 w-full md:w-auto text-center">Leaderboard</Link>
        </div>

        <header className="space-y-2 text-center md:text-left">
          <h1 className="text-4xl font-black italic text-yellow-400 uppercase tracking-tighter">
            {league.name}
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">
            Invite Code: <span className="text-slate-300">{league.inviteCode}</span>
          </p>
        </header>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold uppercase text-slate-400 border-b border-slate-800 pb-2">Upcoming Fixtures</h2>
          <div className="grid gap-4">
            {(matches || []).filter((m: any) => !m.matchEnded).map((match: any) => (
              <div key={match.id} className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex-1 text-center md:text-left">
                  <div className="text-xs text-slate-500 font-bold uppercase mb-2">
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
                    <span className="text-xl font-bold">{match.team1}</span>
                    <span className="text-slate-600 font-black italic">VS</span>
                    <span className="text-xl font-bold">{match.team2}</span>
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
                      <div className="text-xl font-bold">{match.team1} vs {match.team2}</div>
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
