"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const signIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div className="ucj">
      <div className="ucj-login">
        <div className="ucj-login-card">
          <div className="ucj-mark grotesk">Use Case Catalog<span className="dot">.</span></div>
          <p>Your product work, captured the day it happens and indexed so you can pull the right story years later.</p>
          <button className="ucj-btn ucj-google grotesk" onClick={signIn}>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
