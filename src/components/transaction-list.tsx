"use client";

import { Badge } from "@/components/ui/badge";
import type { DisplayTransaction } from "@/lib/types";

type TransactionListProps = {
  transactions: DisplayTransaction[];
  showInstitution?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
};

function formatMoney(amount: number, currency: string) {
  // Plaid: positive = money leaving the account (outflow)
  const absolute = Math.abs(amount);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(absolute);

  if (amount > 0) return `−${formatted}`;
  if (amount < 0) return `+${formatted}`;
  return formatted;
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function TransactionList({
  transactions,
  showInstitution = false,
  emptyTitle = "No transactions yet",
  emptyBody = "Your bank is linked, but there is no saved activity yet. Refresh to ask Plaid for changes, or reconnect with a sandbox user that has sample history.",
}: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="mint-panel rounded-2xl px-6 py-16 text-center">
        <p className="font-display text-2xl text-[var(--mint-ink)]">{emptyTitle}</p>
        <p className="mx-auto mt-2 max-w-md text-[var(--mint-muted)]">{emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="mint-panel overflow-hidden rounded-2xl">
      <div className="hidden grid-cols-[7rem_1fr_8rem_9rem] gap-4 border-b border-[var(--mint-line)] px-5 py-3 text-xs font-medium uppercase tracking-[0.14em] text-[var(--mint-muted)] sm:grid">
        <span>Date</span>
        <span>Merchant</span>
        <span>Account</span>
        <span className="text-right">Amount</span>
      </div>
      <ul className="divide-y divide-[var(--mint-line)]">
        {transactions.map((tx, index) => (
          <li
            key={tx.id}
            className="mint-row grid gap-2 px-5 py-4 sm:grid-cols-[7rem_1fr_8rem_9rem] sm:items-center sm:gap-4"
            style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
          >
            <time
              dateTime={tx.date}
              className="text-sm text-[var(--mint-muted)]"
            >
              {formatDate(tx.date)}
            </time>
            <div className="min-w-0">
              <p className="truncate font-medium text-[var(--mint-ink)]">
                {tx.merchant || tx.name}
              </p>
              {tx.merchant && tx.merchant !== tx.name ? (
                <p className="truncate text-sm text-[var(--mint-muted)]">
                  {tx.name}
                </p>
              ) : null}
              {(showInstitution && tx.institutionName) || tx.pending ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {showInstitution && tx.institutionName ? (
                    <Badge
                      variant="secondary"
                      className="bg-[var(--mint-foam)] text-[var(--mint-forest)]"
                    >
                      {tx.institutionName}
                    </Badge>
                  ) : null}
                  {tx.pending ? (
                    <Badge
                      variant="secondary"
                      className="bg-[var(--mint-foam)] text-[var(--mint-forest)]"
                    >
                      Pending
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className="truncate text-sm text-[var(--mint-muted)]">
              {tx.accountName}
            </p>
            <p
              className={`text-right font-medium tabular-nums ${
                tx.amount < 0
                  ? "text-[var(--mint-credit)]"
                  : "text-[var(--mint-ink)]"
              }`}
            >
              {formatMoney(tx.amount, tx.currency)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
