/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function LeaderboardPage({ params }: { params: Promise<{ id: string }> | any }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: league } = await supabase
    .from('League')
    .select('*, members:Membership(*, user:User(*))')
    .eq('id', id)
    .single();

  if (!league) redirect('/leagues');

  // Sort members by points descending manually since Supabase complex query sorting can be tricky with nested relates
  const sortedMembers = (league.members as any[] || []).sort((a, b) => b.points - a.points);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
          <Link href={`/leagues/${id}`} prefetch={true} className="text-yellow-400 hover:underline">← Back to Fixtures</Link>
          <div className="text-slate-500 font-bold uppercase tracking-widest text-sm">Leaderboard</div>
        </div>

        <header className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-black italic text-yellow-400 uppercase tracking-tighter">
            {league.name}
          </h1>
          <p className="text-slate-400 font-medium italic text-sm md:text-base">Standings of the world's best bru players</p>
        </header>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[400px]">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-4 md:px-6 py-4 uppercase text-xs font-black text-slate-400 w-16">Pos</th>
                <th className="px-4 md:px-6 py-4 uppercase text-xs font-black text-slate-400">Player</th>
                <th className="px-4 md:px-6 py-4 uppercase text-xs font-black text-slate-400 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedMembers.map((m: any, index: number) => (
                <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 md:px-6 py-4 md:py-6 font-black italic text-xl md:text-2xl text-slate-500">
                    {index + 1}
                  </td>
                  <td className="px-4 md:px-6 py-4 md:py-6">
                    <div className="flex items-center gap-3 md:gap-4">
                      {m.user.image && (
                        <img src={m.user.image} alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-slate-700" />
                      )}
                      <div className="text-lg md:text-xl font-bold truncate max-w-[150px] md:max-w-none">{m.user.name}</div>
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 md:py-6 text-right">
                    <div className="text-2xl md:text-3xl font-black text-white">{m.points}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedMembers.length === 0 && (
            <div className="p-8 md:p-12 text-center text-slate-500 italic text-sm md:text-base">No members yet. Invite some bru!</div>
          )}
        </div>
      </div>
    </div>
  );
}
