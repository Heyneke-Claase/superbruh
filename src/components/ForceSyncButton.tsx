'use client';

import { useTransition } from 'react';
import { forceSync } from '@/app/actions';
import { RefreshCw } from 'lucide-react';

export default function ForceSyncButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => forceSync())}
      disabled={isPending}
      title="Sync latest match results & recalculate points"
      className={`flex items-center gap-2 text-xs font-bold uppercase px-3 py-1.5 rounded-lg border transition-all ${
        isPending
          ? 'border-yellow-400/40 text-yellow-400/40 cursor-wait'
          : 'border-slate-700 text-slate-400 hover:border-yellow-400 hover:text-yellow-400'
      }`}
    >
      <RefreshCw size={12} className={isPending ? 'animate-spin' : ''} />
      {isPending ? 'Syncing…' : 'Sync Results'}
    </button>
  );
}
