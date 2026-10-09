"use client";

import { useCallback, useEffect, useState } from "react";
import { PlaidLinkButton } from "@/components/plaid-link-button";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import type { DisplayTransaction } from "@/lib/types";
import { Loader2, RefreshCw, Unplug } from "lucide-react";

type StatusResponse = {
  configured: boolean;
  env: string;
  products: string[];
  connected: boolean;
  institutionName: string | null;
};

type LoadState = "boot" | "ready" | "loading" | "error";

export function MintApp() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [transactions, setTransactions] = useState<DisplayTransaction[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("boot");
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/api/plaid/status");
    const data = (await response.json()) as StatusResponse;
    setStatus(data);
    return data;
  }, []);

  const loadTransactions = useCallback(async () => {
    setLoadState("loading");
    setError(null);
    try {
      const response = await fetch("/api/plaid/transactions");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load transactions.");
      }
      setTransactions(data.transactions ?? []);
      setLoadState("ready");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load transactions.",
      );
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const next = await refreshStatus();
        if (cancelled) return;
        if (next.connected) {
          await loadTransactions();
        } else {
          setLoadState("ready");
        }
      } catch {
        if (!cancelled) {
          setError("Could not reach the Mint Finance API.");
          setLoadState("error");
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [loadTransactions, refreshStatus]);

  const handleConnected = useCallback(
    async (institutionName: string | null) => {
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              connected: true,
              institutionName,
            }
          : prev,
      );
      await loadTransactions();
    },
    [loadTransactions],
  );

  const handleDisconnect = useCallback(async () => {
    await fetch("/api/plaid/disconnect", { method: "POST" });
    setTransactions([]);
    setError(null);
    setLoadState("ready");
    await refreshStatus();
  }, [refreshStatus]);

  const configured = status?.configured ?? false;
  const connected = status?.connected ?? false;
  const booting = loadState === "boot" || status === null;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="mint-atmosphere" aria-hidden="true" />
      <div className="mint-orbit" aria-hidden="true" />

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-col px-6 pb-20 pt-10 sm:px-8 sm:pt-16">
        <header className="mint-hero">
          <p className="font-display text-5xl leading-none tracking-tight text-[var(--mint-ink)] sm:text-7xl">
            Mint Finance
          </p>
          <h1 className="mt-5 max-w-xl text-xl leading-snug text-[var(--mint-ink)]/85 sm:text-2xl">
            See your bank activity in one quiet place.
          </h1>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-[var(--mint-muted)]">
            Connect a checking or credit account with Plaid, then review recent
            transactions by date, merchant, amount, and account.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {booting ? (
              <Button size="lg" disabled className="mint-cta h-12 gap-2 px-6">
                <Loader2 className="size-4 animate-spin" />
                Checking setup…
              </Button>
            ) : !configured ? (
              <Button size="lg" disabled className="mint-cta h-12 px-6 opacity-70">
                Connect a bank account
              </Button>
            ) : connected ? (
              <>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 gap-2 border-[var(--mint-line)] bg-white/50"
                  onClick={() => void loadTransactions()}
                  disabled={loadState === "loading"}
                >
                  {loadState === "loading" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Refresh
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="h-12 gap-2 text-[var(--mint-muted)]"
                  onClick={() => void handleDisconnect()}
                >
                  <Unplug className="size-4" />
                  Disconnect
                </Button>
              </>
            ) : (
              <PlaidLinkButton
                onConnected={(name) => void handleConnected(name)}
                onError={(message) => {
                  setError(message);
                  setLoadState("error");
                }}
              />
            )}
          </div>
        </header>

        {!booting && !configured ? (
          <section className="mint-panel mint-setup mt-12 rounded-2xl p-6 sm:p-8">
            <p className="font-display text-2xl text-[var(--mint-ink)]">
              Add Plaid sandbox keys to continue
            </p>
            <p className="mt-2 max-w-2xl text-[var(--mint-muted)]">
              Mint Finance is running, but live bank linking needs credentials
              from the Plaid Dashboard. Copy{" "}
              <code className="rounded bg-[var(--mint-foam)] px-1.5 py-0.5 text-sm">
                .env.example
              </code>{" "}
              to{" "}
              <code className="rounded bg-[var(--mint-foam)] px-1.5 py-0.5 text-sm">
                .env.local
              </code>
              , paste your sandbox client ID and secret, then restart the dev
              server.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-[var(--mint-ink)]/80">
              <li>
                Required:{" "}
                <code>PLAID_CLIENT_ID</code>, <code>PLAID_SECRET</code>,{" "}
                <code>PLAID_ENV=sandbox</code>
              </li>
              <li>
                Optional: <code>PLAID_PRODUCTS=transactions</code>,{" "}
                <code>NEXT_PUBLIC_PLAID_ENV=sandbox</code>
              </li>
              <li>
                Sandbox test bank: choose any institution, then use{" "}
                <code>user_good</code> / <code>pass_good</code>
              </li>
            </ul>
          </section>
        ) : null}

        {configured && !connected && loadState === "ready" ? (
          <section className="mint-panel mt-12 rounded-2xl px-6 py-14 text-center sm:px-8">
            <p className="font-display text-2xl text-[var(--mint-ink)]">
              No account linked yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-[var(--mint-muted)]">
              When you connect a bank, recent transactions appear here as a
              simple list—date, merchant, amount, and account.
            </p>
          </section>
        ) : null}

        {connected ? (
          <section className="mt-12">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl text-[var(--mint-ink)]">
                  Transactions
                </h2>
                <p className="mt-1 text-sm text-[var(--mint-muted)]">
                  {status?.institutionName
                    ? `Synced from ${status.institutionName}`
                    : "Synced from your linked institution"}
                </p>
              </div>
              {loadState === "ready" ? (
                <p className="text-sm text-[var(--mint-muted)]">
                  {transactions.length} shown
                </p>
              ) : null}
            </div>

            {loadState === "loading" ? (
              <div className="mint-panel flex items-center justify-center gap-3 rounded-2xl px-6 py-16 text-[var(--mint-muted)]">
                <Loader2 className="size-5 animate-spin text-[var(--mint-forest)]" />
                Pulling the latest transactions from Plaid…
              </div>
            ) : null}

            {loadState === "error" && error ? (
              <div className="mint-panel rounded-2xl border border-red-200/80 bg-red-50/70 px-6 py-8 text-red-900">
                <p className="font-medium">Something went wrong</p>
                <p className="mt-1 text-sm text-red-800/90">{error}</p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => void loadTransactions()}
                >
                  Try again
                </Button>
              </div>
            ) : null}

            {loadState === "ready" ? (
              <TransactionList transactions={transactions} />
            ) : null}
          </section>
        ) : null}

        {!connected && loadState === "error" && error ? (
          <div className="mint-panel mt-10 rounded-2xl border border-red-200/80 bg-red-50/70 px-6 py-6 text-red-900">
            <p className="font-medium">Could not continue</p>
            <p className="mt-1 text-sm text-red-800/90">{error}</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
