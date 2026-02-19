'use client';

import { useState } from 'react';
import { updateName } from './actions';

export default function NameSelection({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);

  return (
    <div className="max-w-md w-full space-y-8 text-center bg-slate-900 p-8 rounded-2xl border border-slate-800">
      <div>
        <h2 className="text-3xl font-black italic text-yellow-400 uppercase tracking-tighter">
          What's your name bru?
        </h2>
        <p className="text-slate-400 mt-2 font-bold uppercase tracking-widest text-xs">
          This will show on the leaderboard
        </p>
      </div>
      
      <form action={async (formData) => {
        await updateName(formData);
        window.location.href = '/leagues';
      }} className="space-y-4">
        <input
          name="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name..."
          required
          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white text-center font-bold text-xl"
        />
        <button
          type="submit"
          className="w-full py-3 bg-yellow-400 text-slate-950 font-bold rounded-lg hover:bg-yellow-300 transition-colors uppercase tracking-widest"
        >
          Save & See Fixtures
        </button>
      </form>
    </div>
  );
}
