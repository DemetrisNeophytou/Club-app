"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";

// Login (email OTP) → /dashboard. Signed-in visitors skip straight there.
export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  const sendCode = async () => {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setBusy(false);
    if (error) setMessage(t.common.error);
    else {
      setCodeSent(true);
      setMessage(t.auth.codeSent);
    }
  };

  const verify = async () => {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) setMessage(t.common.error);
    else router.replace("/dashboard");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="font-display text-4xl font-black tracking-[0.3em]">
          PORTAL <span className="text-copper">VENUES</span>
        </h1>
        <p className="mt-2 text-dim">{t.venues.tagline}</p>
      </div>

      <form
        className="w-full max-w-sm rounded-2xl border border-line bg-deep p-6"
        onSubmit={(e) => {
          e.preventDefault();
          (codeSent ? verify : sendCode)();
        }}
      >
        <label className="mb-2 block text-sm text-dim">{t.auth.emailPlaceholder}</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-xl border border-line bg-card px-4 py-3 text-bone outline-none focus:border-copper"
          autoComplete="email"
          required
        />
        {codeSent && (
          <>
            <label className="mb-2 block text-sm text-dim">{t.auth.codePlaceholder}</label>
            <input
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mb-4 w-full rounded-xl border border-line bg-card px-4 py-3 font-mono text-bone outline-none focus:border-copper"
              required
            />
          </>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-copper py-3 font-display font-bold text-abyss transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {codeSent ? t.auth.verify : t.auth.sendCode}
        </button>
        {message && <p className="mt-3 text-center text-sm text-seaglass">{message}</p>}
      </form>
    </main>
  );
}
