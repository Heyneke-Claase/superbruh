'use client'

import { useState } from 'react';
import { getMatchInfo } from '@/app/actions';
import { Info, X, Loader2 } from 'lucide-react';

interface MatchInfoProps {
  matchId: string;
  team1: string;
  team2: string;
}

export default function MatchInfo({ matchId, team1, team2 }: MatchInfoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<any>(null);

  const handleOpen = async () => {
    setIsOpen(true);
    if (!info) {
      setLoading(true);
      const res = await getMatchInfo(matchId);
      if (res.status === 'success') {
        setInfo(res.data);
      }
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={handleOpen}
        className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-yellow-400 group relative"
        title="View Match Details"
      >
        <Info size={20} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="font-black italic uppercase text-yellow-400 tracking-tighter">Match Details</h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
                  <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Fetching live data...</p>
                </div>
              ) : info ? (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{info.matchType} • {info.venue}</p>
                    <div className="flex items-center justify-center gap-4 text-xl font-black italic uppercase">
                      <span>{team1}</span>
                      <span className="text-slate-700 text-sm">VS</span>
                      <span>{team2}</span>
                    </div>
                    <div className="inline-block px-3 py-1 bg-yellow-400/10 text-yellow-400 rounded-full text-[10px] font-black uppercase tracking-tighter">
                      {info.status}
                    </div>
                  </div>

                  {info.score && info.score.length > 0 && (
                    <div className="grid gap-3">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">Live Scorecard</p>
                      {info.score.map((s: any, i: number) => (
                        <div key={i} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center">
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">{s.inning}</p>
                            <p className="text-2xl font-black text-white">
                              {s.r}<span className="text-slate-500 text-lg">/{s.w}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-500 uppercase">Overs</p>
                            <p className="text-lg font-bold text-slate-300">{s.o}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-[10px] font-bold text-slate-600 uppercase">
                    <span>Date: {new Date(info.dateTimeGMT).toLocaleDateString()}</span>
                    <span>ID: {matchId.substring(0, 8)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                   <p className="text-red-400 font-bold">Failed to load match info.</p>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex justify-end">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-bold text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
