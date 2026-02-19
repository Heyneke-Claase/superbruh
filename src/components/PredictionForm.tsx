'use client';

import { predictMatch } from '@/app/actions';
import { useState, useTransition } from 'react';
import { Lock } from 'lucide-react';

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
  const [isLocked, setIsLocked] = useState(!!currentPrediction);

  const handlePredict = (winner: string) => {
    if (matchStarted || isLocked) return;
    setSelected(winner);
  };

  const handleLock = () => {
    if (!selected || isLocked || matchStarted) return;
    setIsLocked(true);
    startTransition(async () => {
      await predictMatch(matchId, selected);
    });
  };

  return (
    <div className="flex flex-col gap-2 relative">
      <div className="flex justify-between items-center mb-1">
        <div className="text-xs text-slate-500 font-bold uppercase">Pick your winner</div>
        <button 
          onClick={handleLock}
          disabled={!selected || isLocked || matchStarted || isPending}
          className={`p-1.5 rounded-md transition-all ${
            isLocked 
              ? 'bg-yellow-400/20 text-yellow-400' 
              : selected 
                ? 'bg-yellow-400 text-slate-950 hover:bg-yellow-300' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
          title={isLocked ? "Prediction locked" : "Lock in prediction"}
        >
          <Lock size={14} />
        </button>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => handlePredict(team1)}
          disabled={matchStarted || isLocked || isPending}
          className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all border-2 ${
            selected === team1 
              ? 'bg-yellow-400 border-yellow-400 text-slate-950' 
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-yellow-400'
          } ${(matchStarted || isLocked) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {team1}
        </button>
        <button
          onClick={() => handlePredict(team2)}
          disabled={matchStarted || isLocked || isPending}
          className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all border-2 ${
            selected === team2 
              ? 'bg-yellow-400 border-yellow-400 text-slate-950' 
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-yellow-400'
          } ${(matchStarted || isLocked) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {team2}
        </button>
      </div>
    </div>
  );
}
