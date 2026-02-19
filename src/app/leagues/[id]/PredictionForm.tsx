'use client';

import { predictMatch } from '../../actions';
import { useState, useTransition } from 'react';

export default function PredictionForm({ 
  matchId, 
  team1, 
  team2, 
  currentPrediction,
  matchStarted
}: { 
  matchId: string, 
  team1: string, 
  team2: string, 
  currentPrediction?: string,
  matchStarted: boolean
}) {
  const [selected, setSelected] = useState(currentPrediction);
  const [isPending, startTransition] = useTransition();

  const handlePredict = (winner: string) => {
    if (matchStarted) return;
    setSelected(winner);
    startTransition(async () => {
      await predictMatch(matchId, winner);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-slate-500 font-bold uppercase text-center mb-1">Pick your winner</div>
      <div className="flex gap-2">
        <button
          onClick={() => handlePredict(team1)}
          disabled={matchStarted || isPending}
          className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all border-2 ${
            selected === team1 
              ? 'bg-yellow-400 border-yellow-400 text-slate-950' 
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-yellow-400'
          } ${matchStarted ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {team1}
        </button>
        <button
          onClick={() => handlePredict(team2)}
          disabled={matchStarted || isPending}
          className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all border-2 ${
            selected === team2 
              ? 'bg-yellow-400 border-yellow-400 text-slate-950' 
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-yellow-400'
          } ${matchStarted ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {team2}
        </button>
      </div>
      {matchStarted && <div className="text-[10px] text-red-500 uppercase font-black text-center mt-1 italic tracking-widest">Locked</div>}
    </div>
  );
}
