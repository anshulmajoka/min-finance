import type { DisplayTransaction } from "@/lib/types";
import { formatMonthLabel } from "@/lib/money";

export type FlowTotals = {
  income: number;
  spending: number;
  net: number;
  currency: string;
};

export type MonthFlow = FlowTotals & {
  month: string;
  label: string;
};

function currencyOf(transactions: DisplayTransaction[]) {
  const currencies = new Set(
    transactions.map((tx) => tx.currency || "USD").filter(Boolean),
  );
  if (currencies.size === 1) return [...currencies][0];
  return "USD";
}

export function summarizeFlow(transactions: DisplayTransaction[]): FlowTotals {
  let income = 0;
  let spending = 0;
  for (const tx of transactions) {
    if (tx.amount < 0) income += Math.abs(tx.amount);
    else if (tx.amount > 0) spending += tx.amount;
  }
  return {
    income,
    spending,
    net: income - spending,
    currency: currencyOf(transactions),
  };
}

export function monthlyCashFlow(transactions: DisplayTransaction[]): MonthFlow[] {
  const buckets = new Map<string, DisplayTransaction[]>();
  for (const tx of transactions) {
    const month = tx.date.slice(0, 7);
    const list = buckets.get(month);
    if (list) list.push(tx);
    else buckets.set(month, [tx]);
  }

  return [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, rows]) => ({
      month,
      label: formatMonthLabel(month),
      ...summarizeFlow(rows),
    }));
}
