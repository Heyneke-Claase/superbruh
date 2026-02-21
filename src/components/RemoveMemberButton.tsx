'use client';

import { removeMember } from '@/app/actions';
import { UserMinus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export default function RemoveMemberButton({ leagueId, userId, userName }: { leagueId: string, userId: string, userName: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleRemove = () => {
    if (confirm(`Are you sure you want to remove ${userName} from this league?`)) {
      startTransition(async () => {
        try {
          await removeMember(leagueId, userId);
          router.refresh();
        } catch (error: any) {
          alert(error.message);
        }
      });
    }
  };

  return (
    <button
      onClick={handleRemove}
      disabled={isPending}
      className="p-1 hover:bg-red-500/20 text-slate-500 hover:text-red-500 rounded-md transition-colors"
      title={`Remove ${userName}`}
    >
      <UserMinus size={14} />
    </button>
  );
}
