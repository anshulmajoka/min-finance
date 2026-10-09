"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PlaidLinkButton } from "@/components/plaid-link-button";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import type { DisplayTransaction, InstitutionSummary } from "@/lib/types";
import { Loader2, RefreshCw, Unplug, X } from "lucide-react";

type StatusResponse = {
  configured: boolean;
  env: string;
  products: string[];
  mongoConfigured: boolean;
  mongoOk: boolean;
  mongoError: string | null;
  connected: boolean;
  institutions: InstitutionSummary[];
};

type TransactionsResponse = {
  institutions: InstitutionSummary[];
  transactions: DisplayTransaction[];
  sync: { added: number; modified: number; removed: number } | null;
  errors: { itemId: string; institutionName: string | null; message: string }[];
  error?: string;
};

type LoadState = "boot" | "ready" | "loading" | "error";

function institutionLabel(
  institution: InstitutionSummary,
  institutions: InstitutionSummary[],
) {
  const name = institution.institutionName?.trim() || "Institution";
  const duplicates = institutions.filter(
    (item) => (item.institutionName?.trim() || "Institution") === name,
  );
  if (duplicates.length < 2) return name;
  const index = duplicates.findIndex((item) => item.itemId === institution.itemId);
  return `${name} ${index + 1}`;
}

function formatSyncNotice(sync: NonNullable<TransactionsResponse["sync"]>) {
  if (sync.added === 0 && sync.modified === 0 && sync.removed === 0) {
    return "Already up to date. Saved transactions were not downloaded again.";
  }

  const parts: string[] = [];
  if (sync.added > 0) {
    parts.push(`${sync.added} new`);
  }
  if (sync.modified > 0) {
    parts.push(`${sync.modified} updated`);
  }
  if (sync.removed > 0) {
    parts.push(`${sync.removed} removed`);
  }
  return `Synced ${parts.join(", ")}.`;
}

export function MintApp() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [transactions, setTransactions] = useState<DisplayTransaction[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("boot");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [institutionFilter, setInstitutionFilter] = useState("all");

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/api/plaid/status");
    const data = (await response.json()) as StatusResponse;
    setStatus(data);
    return data;
  }, []);

  const loadTransactions = useCallback(async (options?: { sync?: boolean }) => {
    const sync = Boolean(options?.sync);
    if (sync) {
      setRefreshing(true);
    } else {
      setLoadState("loading");
    }
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        "/api/plaid/transactions",
        sync
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            }
          : undefined,
      );
      const data = (await response.json()) as TransactionsResponse;
      if (!response.ok) {
        throw new Error(data.error || "Could not load transactions.");
      }

      setTransactions(data.transactions ?? []);
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              connected: (data.institutions ?? []).length > 0,
              institutions: data.institutions ?? prev.institutions,
            }
          : prev,
      );
      if (data.errors?.length) {
        setError(data.errors.map((item) => item.message).join(" "));
      } else if (sync && data.sync) {
        setNotice(formatSyncNotice(data.sync));
      }
      setLoadState("ready");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load transactions.",
      );
      setLoadState("error");
    } finally {
      setRefreshing(false);
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

  const institutions = status?.institutions ?? [];

  useEffect(() => {
    if (
      institutionFilter !== "all" &&
      !institutions.some((item) => item.itemId === institutionFilter)
    ) {
      setInstitutionFilter("all");
    }
  }, [institutionFilter, institutions]);

  const visibleTransactions = useMemo(() => {
    if (institutionFilter === "all") return transactions;
    return transactions.filter((tx) => tx.itemId === institutionFilter);
  }, [institutionFilter, transactions]);

  const handleConnected = useCallback(async () => {
    const next = await refreshStatus();
    if (next.connected) {
      await loadTransactions();
    }
  }, [loadTransactions, refreshStatus]);

  const handleDisconnect = useCallback(
    async (itemId?: string) => {
      await fetch("/api/plaid/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemId ? { itemId } : {}),
      });
      setNotice(null);
      setError(null);
      if (itemId && institutionFilter === itemId) {
        setInstitutionFilter("all");
      }
      const next = await refreshStatus();
      if (next.connected) {
        await loadTransactions();
      } else {
        setTransactions([]);
        setLoadState("ready");
      }
    },
    [institutionFilter, loadTransactions, refreshStatus],
  );

  const configured = status?.configured ?? false;
  const mongoOk = status?.mongoOk ?? false;
  const connected = status?.connected ?? false;
  const booting = loadState === "boot" || status === null;
  const readyToLink = configured && mongoOk;
  const selectedInstitution =
    institutions.find((item) => item.itemId === institutionFilter) ?? null;
  const showingAll = institutionFilter === "all";

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
            Connect one or more institutions with Plaid. Transactions are saved
            in MongoDB, and you can filter the list by institution.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {booting ? (
              <Button size="lg" disabled className="mint-cta h-12 gap-2 px-6">
                <Loader2 className="size-4 animate-spin" />
                Checking setup…
              </Button>
            ) : connected ? (
              <>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 gap-2 border-[var(--mint-line)] bg-white/50"
                  onClick={() => void loadTransactions({ sync: true })}
                  disabled={!configured || loadState === "loading" || refreshing}
                >
                  {refreshing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Refresh
                </Button>
                {readyToLink ? (
                  <PlaidLinkButton
                    label="Add institution"
                    variant="outline"
                    onConnected={() => void handleConnected()}
                    onError={(message) => {
                      setError(message);
                      setLoadState("ready");
                    }}
                  />
                ) : null}
                <Button
                  size="lg"
                  variant="ghost"
                  className="h-12 gap-2 text-[var(--mint-muted)]"
                  onClick={() => void handleDisconnect()}
                >
                  <Unplug className="size-4" />
                  {institutions.length > 1 ? "Disconnect all" : "Disconnect"}
                </Button>
              </>
            ) : !readyToLink ? (
              <Button size="lg" disabled className="mint-cta h-12 px-6 opacity-70">
                Connect a bank account
              </Button>
            ) : (
              <PlaidLinkButton
                onConnected={() => void handleConnected()}
                onError={(message) => {
                  setError(message);
                  setLoadState("error");
                }}
              />
            )}
          </div>
        </header>

        {!booting && !connected && (!configured || !mongoOk) ? (
          <section className="mint-panel mint-setup mt-12 rounded-2xl p-6 sm:p-8">
            <p className="font-display text-2xl text-[var(--mint-ink)]">
              Finish setup to link a bank
            </p>
            <p className="mt-2 max-w-2xl text-[var(--mint-muted)]">
              Copy{" "}
              <code className="rounded bg-[var(--mint-foam)] px-1.5 py-0.5 text-sm">
                .env.example
              </code>{" "}
              to{" "}
              <code className="rounded bg-[var(--mint-foam)] px-1.5 py-0.5 text-sm">
                .env.local
              </code>{" "}
              and restart the dev server.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-[var(--mint-ink)]/80">
              <li>
                Plaid: <code>PLAID_CLIENT_ID</code>, <code>PLAID_SECRET</code>,{" "}
                <code>PLAID_ENV=sandbox</code>
                {configured ? " — ready" : ""}
              </li>
              <li>
                MongoDB: <code>MONGODB_URI</code> (local default is{" "}
                <code>mongodb://127.0.0.1:27017</code> outside production). Run
                MongoDB Community locally, or point the URI at Atlas.
                {mongoOk ? " — ready" : ""}
              </li>
              {!mongoOk && status?.mongoError ? (
                <li>{status.mongoError}</li>
              ) : null}
              <li>
                Sandbox test bank: choose any institution, then use{" "}
                <code>user_good</code> / <code>pass_good</code>
              </li>
            </ul>
          </section>
        ) : null}

        {readyToLink && !connected && loadState === "ready" ? (
          <section className="mint-panel mt-12 rounded-2xl px-6 py-14 text-center sm:px-8">
            <p className="font-display text-2xl text-[var(--mint-ink)]">
              No institution linked yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-[var(--mint-muted)]">
              Connect a bank to save its transactions. You can add more
              institutions later and filter the list.
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
                  {selectedInstitution
                    ? `Showing ${institutionLabel(selectedInstitution, institutions)}`
                    : institutions.length > 1
                      ? `All ${institutions.length} institutions`
                      : institutions[0]
                        ? `Synced from ${institutionLabel(institutions[0], institutions)}`
                        : "Synced from your linked institutions"}
                </p>
              </div>
              {loadState === "ready" ? (
                <p className="text-sm text-[var(--mint-muted)]">
                  {visibleTransactions.length} shown
                </p>
              ) : null}
            </div>

            {institutions.length > 1 ? (
              <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by institution">
                <button
                  type="button"
                  aria-pressed={showingAll}
                  onClick={() => setInstitutionFilter("all")}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    showingAll
                      ? "border-[var(--mint-forest)] bg-[var(--mint-forest)] text-white"
                      : "border-[var(--mint-line)] bg-white/70 text-[var(--mint-ink)]"
                  }`}
                >
                  All {transactions.length}
                </button>
                {institutions.map((institution) => {
                  const label = institutionLabel(institution, institutions);
                  const selected = institution.itemId === institutionFilter;
                  const count = transactions.filter(
                    (tx) => tx.itemId === institution.itemId,
                  ).length;
                  return (
                    <div
                      key={institution.itemId}
                      className={`inline-flex items-center rounded-full border ${
                        selected
                          ? "border-[var(--mint-forest)] bg-[var(--mint-forest)] text-white"
                          : "border-[var(--mint-line)] bg-white/70 text-[var(--mint-ink)]"
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setInstitutionFilter(institution.itemId)}
                        className="px-3 py-1.5 text-sm"
                      >
                        {label}
                        <span className={selected ? "text-white/80" : "text-[var(--mint-muted)]"}>
                          {" "}
                          {count}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Disconnect ${label}`}
                        onClick={() => void handleDisconnect(institution.itemId)}
                        className="mr-1.5 rounded-full p-1 hover:bg-black/10"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {notice ? (
              <p className="mb-4 text-sm text-[var(--mint-forest)]">{notice}</p>
            ) : null}

            {loadState === "loading" && transactions.length === 0 ? (
              <div className="mint-panel flex items-center justify-center gap-3 rounded-2xl px-6 py-16 text-[var(--mint-muted)]">
                <Loader2 className="size-5 animate-spin text-[var(--mint-forest)]" />
                Loading saved transactions…
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

            {loadState === "ready" || transactions.length > 0 ? (
              <>
                {error && loadState === "ready" ? (
                  <div className="mb-4 rounded-2xl border border-red-200/80 bg-red-50/70 px-4 py-3 text-sm text-red-900">
                    {error}
                  </div>
                ) : null}
                {loadState === "loading" && transactions.length > 0 ? null : (
                  <TransactionList
                    transactions={visibleTransactions}
                    showInstitution={showingAll && institutions.length > 1}
                    emptyTitle={
                      selectedInstitution
                        ? `No transactions for ${institutionLabel(selectedInstitution, institutions)}`
                        : "No transactions yet"
                    }
                    emptyBody={
                      selectedInstitution
                        ? "This institution is linked, but nothing is saved for it yet. Refresh to check for new activity."
                        : "Your institutions are linked, but there is no saved activity yet. Refresh to ask Plaid for changes."
                    }
                  />
                )}
              </>
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
