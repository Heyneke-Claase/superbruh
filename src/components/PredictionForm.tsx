'use client';

import { predictMatch } from '@/app/actions';
import { useState, useTransition } from 'react';
import { Lock } from 'lucide-react';

const MARGINS = ['Narrow', 'Comfortable', 'Easy', 'Thrashing'];

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
  const initialTeam = currentPrediction?.split('|')[0] || '';
  const initialMargin = currentPrediction?.split('|')[1] || '';

  const [selectedTeam, setSelectedTeam] = useState(initialTeam);
  const [selectedMargin, setSelectedMargin] = useState(initialMargin);
  const [isPending, startTransition] = useTransition();
  const [isLocked, setIsLocked] = useState(!!currentPrediction);

  const handlePredictTeam = (winner: string) => {
    if (matchStarted || isLocked) return;
    setSelectedTeam(winner);
  };

  const handlePredictMargin = (margin: string) => {
    if (matchStarted || isLocked) return;
    setSelectedMargin(margin);
  };

  const handleLock = () => {
    if (!selectedTeam || !selectedMargin || isLocked || matchStarted) return;
    setIsLocked(true);
    startTransition(async () => {
      await predictMatch(matchId, `${selectedTeam}|${selectedMargin}`);
    });
  };

  return (
    <div className="flex flex-col gap-3 relative">
      <div className="flex justify-between items-center mb-1">
        <div className="text-xs text-slate-500 font-bold uppercase">Pick your winner & margin</div>
        <button 
          onClick={handleLock}
          disabled={!selectedTeam || !selectedMargin || isLocked || matchStarted || isPending}
          className={`p-1.5 rounded-md transition-all ${
            isLocked 
              ? 'bg-yellow-400/20 text-yellow-400' 
              : (selectedTeam && selectedMargin)
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
          onClick={() => handlePredictTeam(team1)}
          disabled={matchStarted || isLocked || isPending}
          className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all border-2 ${
            selectedTeam === team1 
              ? 'bg-yellow-400 border-yellow-400 text-slate-950' 
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-yellow-400'
          } ${(matchStarted || isLocked) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {team1}
        </button>
        <button
          onClick={() => handlePredictTeam(team2)}
          disabled={matchStarted || isLocked || isPending}
          className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all border-2 ${
            selectedTeam === team2 
              ? 'bg-yellow-400 border-yellow-400 text-slate-950' 
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-yellow-400'
          } ${(matchStarted || isLocked) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {team2}
        </button>
      </div>
      
      {selectedTeam && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
          {MARGINS.map(margin => (
            <button
              key={margin}
              onClick={() => handlePredictMargin(margin)}
              disabled={matchStarted || isLocked || isPending}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-all border-2 ${
                selectedMargin === margin 
                  ? 'bg-yellow-400 border-yellow-400 text-slate-950' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-yellow-400'
              } ${(matchStarted || isLocked) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {margin}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
