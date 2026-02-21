import { createClient } from '@/lib/supabase/server';
import { createLeague, joinLeague } from '../actions';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PlusCircle, Users, Trophy, Code } from 'lucide-react';
import LogoutButton from '../LogoutButton';

export default async function LeaguesPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  const userId = supabaseUser?.id;
  if (!userId) redirect('/');

  const { data: dbUser } = await supabase
    .from('User')
    .select('id, name, image, leagues:Membership(id, league:League(id, name, inviteCode))')
    .eq('id', userId)
    .single();

  if (!dbUser) redirect('/');

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8 md:space-y-12">
        <header className="flex flex-col md:flex-row justify-between items-center bg-slate-900/50 p-6 rounded-2xl border border-slate-800 gap-6 md:gap-0">
          <h1 className="text-4xl font-black italic text-yellow-400 uppercase tracking-tighter text-center md:text-left">
            Your Leagues
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-500 font-bold uppercase tracking-widest">Playing as</div>
              <div className="text-white font-bold">{dbUser.name}</div>
            </div>
            {dbUser.image && (
              <img src={dbUser.image} alt={dbUser.name || ''} className="w-12 h-12 rounded-full border-2 border-yellow-400" />
            )}
            <LogoutButton />
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <PlusCircle className="text-yellow-400" size={24} />
              <h2 className="text-2xl font-bold">Create a League</h2>
            </div>
            <form action={createLeague} className="space-y-4">
              <input
                name="name"
                type="text"
                placeholder="League Name"
                required
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <button className="w-full py-2 bg-yellow-400 text-slate-950 font-bold rounded hover:bg-yellow-300 transition-colors uppercase">
                Create League
              </button>
            </form>
          </div>

          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <Code className="text-slate-400" size={24} />
              <h2 className="text-2xl font-bold">Join a League</h2>
            </div>
            <form action={joinLeague} className="space-y-4">
              <input
                name="inviteCode"
                type="text"
                placeholder="Invite Code (e.g. ABC123)"
                required
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 uppercase"
              />
              <button className="w-full py-2 bg-slate-700 text-white font-bold rounded hover:bg-slate-600 transition-colors uppercase">
                Join League
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold uppercase tracking-tight text-slate-400">My Active Leagues</h2>
          {(!dbUser.leagues || (dbUser.leagues as any[]).length === 0) ? (
            <p className="text-slate-500 italic">You haven't joined any leagues yet bru.</p>
          ) : (
            <div className="grid gap-4">
              {(dbUser.leagues as any[]).map((m: any) => (
                <Link
                  key={m.league.id}
                  href={`/leagues/${m.league.id}`}
                  className="bg-slate-900 p-6 rounded-xl border border-slate-800 hover:border-yellow-400 transition-all flex justify-between items-center group"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-800 p-3 rounded-lg group-hover:bg-yellow-400/10 transition-colors">
                      <Trophy className="text-yellow-400" size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold group-hover:text-yellow-400 transition-colors">{m.league.name}</h3>
                      <p className="text-sm text-slate-500 italic">Code: <span className="uppercase text-slate-300">{m.league.inviteCode}</span></p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-white">{m.points}</div>
                    <div className="text-xs uppercase text-slate-500 font-bold">Points</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
