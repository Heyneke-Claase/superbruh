import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignInButton from "./SignInButton";
import NameSelection from "./NameSelection";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  if (supabaseUser) {
    const { data: user } = await supabase
      .from('User')
      .select('onboarded')
      .eq('id', supabaseUser.id)
      .single();

    if (user?.onboarded) {
      redirect('/leagues');
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-4">
        <NameSelection initialName={supabaseUser.user_metadata.full_name || ''} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-md w-full space-y-12 text-center">
        <div className="space-y-4">
          <h1 className="text-7xl font-black italic tracking-tighter text-yellow-400 uppercase leading-none">
            Superbrah
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-sm">
            T20 World Cup Fantasy
          </p>
        </div>

        <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 backdrop-blur-sm space-y-8">
          <p className="text-slate-300 font-medium text-lg">
            "Better than Superbru, because it's for the brahs."
          </p>
          
          <SignInButton />
          
          <p className="text-slate-500 text-xs uppercase font-bold tracking-widest leading-loose">
            Join thousands of brahs predicting <br/> the World Cup 2026
          </p>
        </div>
      </div>
    </div>
  );
}

