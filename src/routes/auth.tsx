import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Clinic sign in | Dr. Care Implant Clinic" },
      {
        name: "description",
        content:
          "Sign in to create, save and reopen personalized dental treatment plans for Dr. Care Implant Clinic patients.",
      },
      { property: "og:title", content: "Clinic sign in | Dr. Care Implant Clinic" },
      {
        property: "og:description",
        content: "Secure access for clinic staff to saved patient treatment plans.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search['next'] === "string" ? (search['next'] as string) : "/",
  }),
  component: AuthPage,
});

function safePath(path: string) {
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // "Forgot password" request form (send the reset email).
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Set-new-password form, shown once the user lands back here from the
  // reset-password email link (Supabase fires a PASSWORD_RECOVERY event and
  // signs them into a temporary recovery session).
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  // Read inside the auth listener so it never sees a stale closure value —
  // the listener is attached once on mount, but recoveryMode can flip after that.
  const recoveryModeRef = useRef(false);
  useEffect(() => {
    recoveryModeRef.current = recoveryMode;
  }, [recoveryMode]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        recoveryModeRef.current = true;
        setRecoveryMode(true);
        return;
      }
      // Don't navigate away mid-recovery just because Supabase also reports
      // a normal session for the recovery token.
      if (session && !recoveryModeRef.current) void navigate({ to: safePath(next) });
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session && !recoveryModeRef.current) void navigate({ to: safePath(next) });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMessage("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const sendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setMessage("Enter your email above first, then request the reset link.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMessage("Password updated. Redirecting…");
      setRecoveryMode(false);
      void navigate({ to: safePath(next) });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setMessage("");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setMessage("Google sign-in failed. Please try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    void navigate({ to: safePath(next) });
  };

  // ---- Set a new password (after clicking the emailed reset link) ----
  if (recoveryMode) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-xl">
          <h1 className="text-xl font-bold text-primary">Set a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose a new password for your account.</p>

          <form onSubmit={updatePassword} className="mt-5 space-y-3">
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min. 8 characters)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground hover:brightness-110 transition disabled:opacity-50"
            >
              Update password
            </button>
          </form>

          {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
        </div>
      </div>
    );
  }

  // ---- Request the reset email ----
  if (resetMode) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-xl">
          <h1 className="text-xl font-bold text-primary">Reset your password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your account email and we'll send you a link to set a new password.
          </p>

          {resetSent ? (
            <p className="mt-5 text-sm text-foreground">
              Check <span className="font-semibold">{email}</span> for the reset link, then come back here.
            </p>
          ) : (
            <form onSubmit={sendResetEmail} className="mt-5 space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@clinic.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground hover:brightness-110 transition disabled:opacity-50"
              >
                Send reset link
              </button>
            </form>
          )}

          {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}

          <button
            onClick={() => {
              setResetMode(false);
              setResetSent(false);
              setMessage("");
            }}
            className="mt-4 text-sm text-primary font-semibold hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  // ---- Normal sign in / sign up ----
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-xl">
        <h1 className="text-xl font-bold text-primary">Clinic sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saved patient treatment plans are private to the clinic team. Sign in to save and reopen
          them.
        </p>

        <button
          onClick={() => void google()}
          disabled={busy}
          className="mt-5 w-full rounded-lg border border-border py-2.5 font-semibold hover:bg-muted transition disabled:opacity-50"
        >
          Continue with Google
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@clinic.com"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min. 8 characters)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          {mode === "signin" && (
            <button
              type="button"
              onClick={() => {
                setResetMode(true);
                setMessage("");
              }}
              className="text-xs text-primary font-semibold hover:underline"
            >
              Forgot password?
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground hover:brightness-110 transition disabled:opacity-50"
          >
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 text-sm text-primary font-semibold hover:underline"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>

        <button
          onClick={() => void navigate({ to: "/" })}
          className="mt-4 block text-xs text-muted-foreground hover:underline"
        >
          Back to the treatment plan
        </button>
      </div>
    </div>
  );
}
