'use client';

import { createClient } from "@/lib/supabase/client";

export default function SignInButton() {
  const supabase = createClient();

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <button
      onClick={handleLogin}
      className="w-full py-4 bg-white text-slate-950 font-bold rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-3 shadow-xl"
    >
      <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
      <span className="uppercase tracking-widest">Sign in with Google</span>
    </button>
  );
}
