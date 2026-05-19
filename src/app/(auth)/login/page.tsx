"use client";

import { buttonClassNames } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  async function handleGoogleSignIn() {
    const supabase = createClient();

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="min-h-screen bg-parchment">
      <div className="flex min-h-screen">
        <main className="flex w-full max-w-[560px] flex-1 flex-col px-8 py-8 sm:px-12 sm:py-10">
          <div className="mb-20">
            <Wordmark />
          </div>

          <div className="flex flex-1 items-start">
            <div className="w-full max-w-[360px]">
              <h1 className="font-display text-5xl font-black uppercase leading-[0.9] tracking-tight text-pitch sm:text-6xl">
                NURTURE YOUR LEADS.
              </h1>

              <p className="mt-5 max-w-[300px] font-body text-sm leading-6 text-dust">
                AI replies to every message. You close the deals.
              </p>

              <button
                type="button"
                className={`${buttonClassNames.primary} mt-10`}
                onClick={handleGoogleSignIn}
              >
                Continue with Google
              </button>
            </div>
          </div>
        </main>

        <div className="hidden flex-1 lg:block" />
      </div>
    </div>
  );
}
