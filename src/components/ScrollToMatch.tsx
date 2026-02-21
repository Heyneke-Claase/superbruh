'use client';

import { useEffect } from 'react';

export default function ScrollToMatch({ matchId }: { matchId: string }) {
  useEffect(() => {
    if (matchId) {
      const element = document.getElementById(`match-${matchId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [matchId]);

  return null;
}
