"use client";

import { Badge } from "@/components/ui/badge";
import type { DisplayTransaction } from "@/lib/types";

type TransactionListProps = {
  transactions: DisplayTransaction[];
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

export function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="mint-panel rounded-2xl px-6 py-16 text-center">
        <p className="font-display text-2xl text-[var(--mint-ink)]">
          No transactions yet
        </p>
        <p className="mt-2 text-[var(--mint-muted)]">
          Your bank is linked, but Plaid has not returned any activity for this
          account yet. Try refreshing in a moment, or reconnect with a sandbox
          user that has sample history.
        </p>
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
              {tx.pending ? (
                <Badge
                  variant="secondary"
                  className="mt-1 bg-[var(--mint-foam)] text-[var(--mint-forest)]"
                >
                  Pending
                </Badge>
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
