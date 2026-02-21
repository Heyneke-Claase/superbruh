/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function LeaderboardPage({ params }: { params: Promise<{ id: string }> | any }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: league } = await supabase
    .from('League')
    .select('id, name, members:Membership(id, userId, points, user:User(id, name, image))')
    .eq('id', id)
    .single();

  if (!league) redirect('/leagues');

  const sortedMembers = (league.members as any[] || []).sort((a: any, b: any) => b.points - a.points);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
          <Link href={`/leagues/${id}`} prefetch={true} className="text-yellow-400 hover:underline">← Back to Fixtures</Link>
          <div className="flex gap-2 w-full md:w-auto">
            <Link href={`/leagues/${id}/picks`} prefetch={true} className="bg-slate-800 px-4 py-2 rounded-lg font-bold hover:bg-slate-700 flex-1 text-center">All Picks</Link>
            <div className="bg-slate-800 px-4 py-2 rounded-lg font-bold text-slate-400 flex-1 text-center cursor-default">Leaderboard</div>
          </div>
        </div>

        <header className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black italic text-yellow-400 uppercase tracking-tighter break-words">
            {league.name}
          </h1>
          <p className="text-slate-400 font-medium italic text-sm md:text-base">Standings of the world's best bru players</p>
        </header>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-3 md:px-6 py-4 uppercase text-[10px] md:text-xs font-black text-slate-400 w-12 md:w-16">Pos</th>
                <th className="px-3 md:px-6 py-4 uppercase text-[10px] md:text-xs font-black text-slate-400">Player</th>
                <th className="px-3 md:px-6 py-4 uppercase text-[10px] md:text-xs font-black text-slate-400 text-right">
                  <span className="hidden md:inline">Points</span>
                  <span className="md:hidden">Pts</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedMembers.map((m: any, index: number) => (
                <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-3 md:px-6 py-4 md:py-6 font-black italic text-lg md:text-2xl text-slate-500">
                    {index + 1}
                  </td>
                  <td className="px-3 md:px-6 py-4 md:py-6">
                    <div className="flex items-center gap-2 md:gap-4">
                      {m.user.image && (
                        <img src={m.user.image} alt="" className="w-7 h-7 md:w-10 md:h-10 rounded-full border border-slate-700 object-cover" />
                      )}
                      <div className="text-base md:text-xl font-bold truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">{m.user.name}</div>
                    </div>
                  </td>
                  <td className="px-3 md:px-6 py-4 md:py-6 text-right">
                    <div className="text-xl md:text-3xl font-black text-white">{m.points}</div>
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
