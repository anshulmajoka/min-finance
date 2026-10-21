"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell, type AppView } from "@/components/app-shell";
import { Accounts } from "@/components/views/accounts";
import { CashFlow } from "@/components/views/cash-flow";
import { ComingSoon } from "@/components/views/coming-soon";
import { Dashboard } from "@/components/views/dashboard";
import { TransactionsView } from "@/components/views/transactions-view";
import { Analytics } from "@/components/views/analytics";
import type { RuleDraft } from "@/components/rule-form";
import { PlaidLinkButton } from "@/components/plaid-link-button";
import { Button } from "@/components/ui/button";
import type { DisplayTransaction, InstitutionSummary } from "@/lib/types";
import { Loader2 } from "lucide-react";

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

function SetupItem({
  ready,
  label,
  detail,
}: {
  ready: boolean;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
          ready
            ? "bg-[var(--mint-foam)] text-[var(--mint-forest)]"
            : "bg-[var(--mint-mist)] text-[var(--mint-muted)]"
        }`}
      >
        {ready ? "Ready" : "Needed"}
      </span>
      <span>
        <span className="font-medium">{label}</span>
        <span className="mt-0.5 block text-[var(--mint-muted)]">{detail}</span>
      </span>
    </li>
  );
}

function formatSyncNotice(sync: NonNullable<TransactionsResponse["sync"]>) {
  if (sync.added === 0 && sync.modified === 0 && sync.removed === 0) {
    return "Already up to date.";
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
  return `Updated: ${parts.join(", ")}.`;
}

export function MintApp() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [transactions, setTransactions] = useState<DisplayTransaction[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("boot");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [institutionFilter, setInstitutionFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [view, setView] = useState<AppView>("dashboard");
  const [ruleDraft, setRuleDraft] = useState<{ token: number; rule: RuleDraft } | null>(null);
  const ruleToken = useRef(0);
  const [refreshingItemId, setRefreshingItemId] = useState<string | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const balanceAttempt = useRef(false);
  const loadRequest = useRef(0);

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/api/plaid/status", { cache: "no-store" });
    const data = (await response.json()) as StatusResponse;
    setStatus(data);
    return data;
  }, []);

  const loadTransactions = useCallback(async (options?: { sync?: boolean; itemId?: string }) => {
    const sync = Boolean(options?.sync);
    const itemId = options?.itemId ?? null;
    if (sync) {
      setRefreshing(true);
      setRefreshingItemId(itemId);
    } else {
      setLoadState("loading");
    }
    const requestId = ++loadRequest.current;
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        "/api/plaid/transactions",
        sync
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(itemId ? { itemId } : {}),
              cache: "no-store",
            }
          : { cache: "no-store" },
      );
      const data = (await response.json()) as TransactionsResponse;
      if (requestId !== loadRequest.current) return;
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
      if (requestId !== loadRequest.current) return;
      setError(
        err instanceof Error ? err.message : "Could not load transactions.",
      );
      setLoadState("error");
    } finally {
      if (requestId === loadRequest.current) {
        setRefreshing(false);
        setRefreshingItemId(null);
      }
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

  const handleConnected = useCallback(async () => {
    const next = await refreshStatus();
    if (next.connected) {
      await loadTransactions({ sync: true });
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
      if (!itemId || institutionFilter === itemId) {
        setInstitutionFilter("all");
      }
      if (!itemId || (accountFilter && accountFilter.startsWith(`${itemId}:`))) {
        setAccountFilter(null);
      }
      const next = await refreshStatus();
      if (next.connected) {
        await loadTransactions();
      } else {
        setTransactions([]);
        setLoadState("ready");
      }
    },
    [accountFilter, institutionFilter, loadTransactions, refreshStatus],
  );

  const refreshInstitutionBalances = useCallback(async (itemId?: string) => {
    setLoadingBalances(true);
    setError(null);
    try {
      const response = await fetch("/api/plaid/balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemId ? { itemId } : {}),
        cache: "no-store",
      });
      const data = (await response.json()) as {
        institutions?: InstitutionSummary[];
        errors?: { message: string }[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not load balances.");
      }
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load balances.");
    } finally {
      setLoadingBalances(false);
    }
  }, []);

  useEffect(() => {
    if (view !== "accounts" || !status?.configured || !status.connected) return;
    if (balanceAttempt.current || loadingBalances) return;
    if (
      status.institutions.every(
        (institution) => institution.balancesAsOf && institution.liabilitiesStatus,
      )
    ) {
      return;
    }
    balanceAttempt.current = true;
    void refreshInstitutionBalances();
  }, [loadingBalances, refreshInstitutionBalances, status, view]);

  const selectInstitution = useCallback((itemId: string) => {
    setInstitutionFilter(itemId);
    setAccountFilter((current) => {
      if (!current || itemId === "all") return current;
      return current.startsWith(`${itemId}:`) ? current : null;
    });
  }, []);

  const configured = status?.configured ?? false;
  const mongoOk = status?.mongoOk ?? false;
  const connected = status?.connected ?? false;
  const booting = loadState === "boot" || status === null;
  const readyToLink = configured && mongoOk;
  const transactionsReady = loadState === "ready" || transactions.length > 0;
  const transactionsLoading = loadState === "loading" && transactions.length === 0;

  return (
    <AppShell
      view={view}
      onViewChange={setView}
      onRefresh={() => void loadTransactions({ sync: true })}
      refreshing={refreshing}
      refreshDisabled={!connected || !configured || booting || refreshing}
      headerActions={
        !booting && view === "accounts" && readyToLink ? (
          <PlaidLinkButton
            label={connected ? "Add a bank" : "Connect a bank"}
            icon="plus"
            className="mint-cta h-10 gap-2 px-4 text-sm font-medium shadow-sm"
            onConnected={() => void handleConnected()}
            onError={(message) => {
              setError(message);
              setLoadState("ready");
            }}
          />
        ) : null
      }
    >
      {booting ? (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--mint-line)] bg-white px-6 py-10 text-sm text-[var(--mint-muted)]">
          <Loader2 className="size-4 animate-spin text-[var(--mint-forest)]" />
          Checking setup…
        </div>
      ) : null}

      {!booting && (!configured || !mongoOk) ? (
        <section className="mb-6 rounded-2xl border border-[var(--mint-line)] bg-white p-6 shadow-sm">
          <p className="font-display text-2xl">One setup step left</p>
          <p className="mt-2 max-w-2xl text-sm text-[var(--mint-muted)]">
            Copy <code className="rounded bg-[var(--mint-foam)] px-1.5 py-0.5">.env.example</code>{" "}
            to <code className="rounded bg-[var(--mint-foam)] px-1.5 py-0.5">.env.local</code>, then
            restart the dev server.
          </p>
          <ul className="mt-5 space-y-3 text-sm">
            <SetupItem
              ready={configured}
              label="Bank connection"
              detail="PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV=sandbox"
            />
            <SetupItem
              ready={mongoOk}
              label="Saved activity"
              detail="MONGODB_URI. Local default is mongodb://127.0.0.1:27017 outside production."
            />
          </ul>
          {!mongoOk && status?.mongoError ? (
            <p className="mt-3 text-sm text-red-800">{status.mongoError}</p>
          ) : null}
          <p className="mt-4 text-sm text-[var(--mint-muted)]">
            Trying the sandbox? Pick any bank, then sign in with{" "}
            <code className="rounded bg-[var(--mint-foam)] px-1.5 py-0.5">user_good</code> /{" "}
            <code className="rounded bg-[var(--mint-foam)] px-1.5 py-0.5">pass_good</code>.
          </p>
        </section>
      ) : null}

      {notice ? (
        <p className="mb-4 text-sm text-[var(--mint-forest)]">{notice}</p>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200/80 bg-red-50/70 px-4 py-3 text-sm text-red-900">
          <p>{error}</p>
          {loadState === "error" ? (
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => void loadTransactions()}
            >
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}

      {!booting && view === "dashboard" ? (
        <Dashboard
          transactions={transactions}
          institutions={institutions}
          connected={connected}
          readyToLink={readyToLink}
          loading={transactionsLoading}
          onConnected={() => void handleConnected()}
          onError={(message) => {
            setError(message);
            setLoadState("ready");
          }}
          onOpenTransactions={() => setView("transactions")}
          onOpenAccounts={() => setView("accounts")}
          onOpenAccount={(itemId, accountId) => {
            setInstitutionFilter(itemId);
            setAccountFilter(`${itemId}:${accountId}`);
            setView("transactions");
          }}
        />
      ) : null}

      {!booting && view === "accounts" ? (
        <Accounts
          institutions={institutions}
          readyToLink={readyToLink}
          refreshingItemId={refreshingItemId}
          refreshingAll={refreshing && refreshingItemId === null}
          loadingBalances={loadingBalances}
          onConnected={() => void handleConnected()}
          onError={(message) => {
            setError(message);
            setLoadState("ready");
          }}
          onDisconnect={(itemId) => void handleDisconnect(itemId)}
          onRefreshInstitution={(itemId) => void loadTransactions({ sync: true, itemId })}
          onPaymentConsent={(itemId) => void refreshInstitutionBalances(itemId)}
          onOpenAccount={(itemId, accountId) => {
            setInstitutionFilter(itemId);
            setAccountFilter(`${itemId}:${accountId}`);
            setView("transactions");
          }}
        />
      ) : null}

      {!booting && view === "transactions" ? (
        <TransactionsView
          transactions={transactions}
          institutions={institutions}
          institutionFilter={institutionFilter}
          accountFilter={accountFilter}
          onInstitutionFilter={selectInstitution}
          onAccountFilter={(key) => {
            if (!key) {
              setAccountFilter(null);
              return;
            }
            const match = institutions.find((item) => key.startsWith(`${item.itemId}:`));
            if (match) setInstitutionFilter(match.itemId);
            setAccountFilter(key);
          }}
          onClearAccount={() => setAccountFilter(null)}
          loading={transactionsLoading}
          ready={transactionsReady}
          onLabeled={() => void loadTransactions()}
          onSaveAsRule={(draft) => {
            ruleToken.current += 1;
            setRuleDraft({ token: ruleToken.current, rule: draft });
            setView("analytics");
          }}
        />
      ) : null}

      {!booting && view === "cash-flow" ? <CashFlow transactions={transactions} /> : null}

      {!booting && view === "analytics" ? (
        <Analytics
          transactions={transactions}
          institutions={institutions}
          draft={ruleDraft}
          onChanged={() => void loadTransactions()}
        />
      ) : null}

      {!booting && (view === "budget" || view === "recurring" || view === "goals") ? (
        <ComingSoon view={view} />
      ) : null}
    </AppShell>
  );
}
