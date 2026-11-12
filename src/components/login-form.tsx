"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Leaf, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const values = new FormData(event.currentTarget);
    try {
      const result = await authClient.signIn.email({
        email: String(values.get("email") ?? "").trim(),
        password: String(values.get("password") ?? ""),
        rememberMe: true,
      });
      if (result.error) {
        setError("The email or password is incorrect. Please try again.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Sign in is temporarily unavailable. Please try again shortly.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mint-safe-page relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="mint-atmosphere absolute inset-0" aria-hidden="true" />
      <div className="mint-orbit pointer-events-none" aria-hidden="true" />
      <section className="mint-hero relative w-full max-w-md rounded-3xl border border-[var(--mint-line)] bg-white/90 p-8 shadow-xl shadow-emerald-950/10 backdrop-blur sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[var(--mint-foam)] text-[var(--mint-forest)]">
            <Leaf className="size-5" />
          </span>
          <div>
            <p className="font-display text-3xl leading-none tracking-tight">Mint</p>
            <p className="mt-1 text-sm text-[var(--mint-muted)]">Your money, in one place</p>
          </div>
        </div>
        <h1 className="font-display text-3xl tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-[var(--mint-muted)]">Sign in to continue to your dashboard.</p>
        <form className="mt-7 space-y-5" onSubmit={submit}>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required maxLength={254}
              className="h-11 w-full rounded-xl border border-[var(--mint-line)] bg-white px-3 text-sm outline-none focus:border-[var(--mint-forest)] focus:ring-2 focus:ring-[var(--mint-foam)]" />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required minLength={12} maxLength={128}
              className="h-11 w-full rounded-xl border border-[var(--mint-line)] bg-white px-3 text-sm outline-none focus:border-[var(--mint-forest)] focus:ring-2 focus:ring-[var(--mint-foam)]" />
          </div>
          {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
          <Button type="submit" disabled={pending} className="mint-cta h-11 w-full rounded-xl">
            {pending ? <><LoaderCircle className="size-4 animate-spin" /> Signing in…</> : "Sign in"}
          </Button>
        </form>
      </section>
    </main>
  );
}
