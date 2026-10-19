import { PlaidLinkButton } from "@/components/plaid-link-button";
import type { DisplayTransaction, InstitutionSummary } from "@/lib/types";
import { summarizeFlow } from "@/lib/cash-flow";
import { institutionLabel } from "@/lib/institution-label";
import {
  currentMonthKey,
  formatMonthLabel,
  formatPlainMoney,
  formatShortDate,
  formatSignedMoney,
} from "@/lib/money";
import { Loader2 } from "lucide-react";

type DashboardProps = {
  transactions: DisplayTransaction[];
  institutions: InstitutionSummary[];
  connected: boolean;
  readyToLink: boolean;
  loading: boolean;
  onConnected: () => void;
  onError: (message: string) => void;
  onOpenTransactions: () => void;
  onOpenAccounts: () => void;
};

export function Dashboard({
  transactions,
  institutions,
  connected,
  readyToLink,
  loading,
  onConnected,
  onError,
  onOpenTransactions,
  onOpenAccounts,
}: DashboardProps) {
  const month = currentMonthKey();
  const monthTransactions = transactions.filter((tx) => tx.date.startsWith(month));
  const flow = summarizeFlow(monthTransactions);
  const recent = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 6);
  const compared = flow.income + flow.spending;
  const spentShare = compared === 0 ? 0 : Math.min(100, (flow.spending / compared) * 100);

  if (!connected) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl border border-[var(--mint-line)] bg-white px-6 py-10 text-center shadow-sm sm:px-10">
        <p className="text-sm font-medium text-[var(--mint-forest)]">Welcome</p>
        <h2 className="mt-2 font-display text-3xl tracking-tight">See your money in one place</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--mint-muted)]">
          Link a bank to see this month’s income, spending, and what’s left. You can add more
          banks later.
        </p>
        <ol className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm text-[var(--mint-ink)]/80">
          <li>1. Connect the bank you use most.</li>
          <li>2. Wait a moment while activity is saved.</li>
          <li>3. Check Home for what’s left this month.</li>
        </ol>
        <div className="mt-6 flex justify-center">
          {readyToLink ? (
            <PlaidLinkButton onConnected={onConnected} onError={onError} />
          ) : (
            <p className="text-sm text-[var(--mint-muted)]">
              Finish the setup checklist above, then connect a bank.
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl bg-[var(--mint-forest)] px-6 py-6 text-[#f4fff9] shadow-sm sm:px-8 sm:py-7">
        <p className="text-sm text-white/75">{formatMonthLabel(month)}</p>
        <p className="mt-4 text-sm text-white/80">Left this month</p>
        <p className="mt-1 font-display text-4xl tabular-nums sm:text-5xl">
          {formatPlainMoney(flow.net, flow.currency)}
        </p>
        {flow.net < 0 ? (
          <p className="mt-2 text-sm text-white/85">Spending is ahead of income this month.</p>
        ) : (
          <p className="mt-2 text-sm text-white/75">Income minus spending so far.</p>
        )}
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-2 rounded-full bg-white" style={{ width: `${spentShare}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs tracking-wide text-white/70 uppercase">Money in</p>
            <p className="mt-1 text-lg font-medium tabular-nums">
              {formatPlainMoney(flow.income, flow.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs tracking-wide text-white/70 uppercase">Money out</p>
            <p className="mt-1 text-lg font-medium tabular-nums">
              {formatPlainMoney(flow.spending, flow.currency)}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <section className="rounded-2xl border border-[var(--mint-line)] bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--mint-line)] px-5 py-4">
            <h2 className="font-display text-xl">Recent activity</h2>
            <button
              type="button"
              onClick={onOpenTransactions}
              className="text-sm font-medium text-[var(--mint-forest)]"
            >
              See all
            </button>
          </div>
          {loading && recent.length === 0 ? (
            <p className="flex items-center gap-2 px-5 py-10 text-sm text-[var(--mint-muted)]">
              <Loader2 className="size-4 animate-spin text-[var(--mint-forest)]" />
              Loading your activity…
            </p>
          ) : recent.length === 0 ? (
            <p className="px-5 py-10 text-sm text-[var(--mint-muted)]">
              Nothing saved yet. Use Update to check your bank for new activity.
            </p>
          ) : (
            <ul>
              {recent.map((tx) => (
                <li key={`${tx.itemId}:${tx.id}`}>
                  <button
                    type="button"
                    onClick={onOpenTransactions}
                    className="flex w-full items-center justify-between gap-4 border-b border-[var(--mint-line)] px-5 py-3 text-left last:border-b-0 hover:bg-[var(--mint-mist)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{tx.merchant || tx.name}</p>
                      <p className="truncate text-xs text-[var(--mint-muted)]">
                        {formatShortDate(tx.date)} · {tx.accountName}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-medium tabular-nums ${
                        tx.amount < 0 ? "text-[var(--mint-credit)]" : "text-[var(--mint-ink)]"
                      }`}
                    >
                      {formatSignedMoney(tx.amount, tx.currency)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--mint-line)] bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--mint-line)] px-5 py-4">
            <h2 className="font-display text-xl">Your banks</h2>
            <button
              type="button"
              onClick={onOpenAccounts}
              className="text-sm font-medium text-[var(--mint-forest)]"
            >
              Manage
            </button>
          </div>
          <ul>
            {institutions.map((institution) => (
              <li
                key={institution.itemId}
                className="border-b border-[var(--mint-line)] px-5 py-3 last:border-b-0"
              >
                <p className="text-sm font-medium">
                  {institutionLabel(institution, institutions)}
                </p>
                <p className="text-xs text-[var(--mint-muted)]">
                  {institution.accounts.length}{" "}
                  {institution.accounts.length === 1 ? "account" : "accounts"}
                  {institution.lastSyncedAt
                    ? ` · updated ${formatShortDate(institution.lastSyncedAt.slice(0, 10))}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
