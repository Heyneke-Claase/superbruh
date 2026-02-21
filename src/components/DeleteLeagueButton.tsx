'use client';

import { deleteLeague } from '@/app/actions';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export default function DeleteLeagueButton({ leagueId, leagueName }: { leagueId: string, leagueName: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete the league "${leagueName}"? This action cannot be undone.`)) {
      startTransition(async () => {
        try {
          await deleteLeague(leagueId);
        } catch (error: any) {
          alert(error.message);
        }
      });
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 border border-red-500/20"
      title="Delete League"
    >
      <Trash2 size={18} />
      <span className="hidden md:inline">Delete League</span>
    </button>
  );
}
