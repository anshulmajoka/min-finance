import type { DisplayTransaction } from "@/lib/types";

export type AnalyticsPeriod = "month" | "quarter" | "all";

export type CategoryTotal = {
  key: string;
  label: string;
  total: number;
  count: number;
};

export type AnalyticsSummary = {
  currency: string;
  spending: CategoryTotal[];
  income: CategoryTotal[];
  tags: CategoryTotal[];
  uncategorized: number;
  uncategorizedCount: number;
};

function currencyOf(transactions: DisplayTransaction[]) {
  const currencies = new Set(
    transactions.map((tx) => tx.currency || "USD").filter(Boolean),
  );
  if (currencies.size === 1) return [...currencies][0];
  return "USD";
}

function monthKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-01`;
}

export function filterByPeriod(
  transactions: DisplayTransaction[],
  period: AnalyticsPeriod,
  now = new Date(),
) {
  if (period === "all") return transactions;
  const start = new Date(now.getFullYear(), now.getMonth() - (period === "quarter" ? 2 : 0), 1);
  const key = monthKey(start);
  return transactions.filter((tx) => tx.date >= key);
}

function isTransfer(tx: DisplayTransaction) {
  return tx.categoryGroup === "transfer";
}

function addTotal(map: Map<string, CategoryTotal>, key: string, label: string, amount: number) {
  const current = map.get(key);
  if (current) {
    current.total += amount;
    current.count += 1;
    return;
  }
  map.set(key, { key, label, total: amount, count: 1 });
}

function sorted(map: Map<string, CategoryTotal>) {
  return [...map.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

export function summarizeAnalytics(transactions: DisplayTransaction[]): AnalyticsSummary {
  const spending = new Map<string, CategoryTotal>();
  const income = new Map<string, CategoryTotal>();
  const tags = new Map<string, CategoryTotal>();
  let uncategorized = 0;
  let uncategorizedCount = 0;

  for (const tx of transactions) {
    if (isTransfer(tx)) continue;
    if (tx.amount > 0) {
      if (tx.categorySource === "none") {
        uncategorized += tx.amount;
        uncategorizedCount += 1;
      }
      const label = tx.categoryName ?? "Uncategorized";
      addTotal(spending, tx.categoryId ?? "none", label, tx.amount);
      for (const tag of tx.tags) {
        addTotal(tags, tag.toLowerCase(), tag, tx.amount);
      }
    } else if (tx.amount < 0) {
      const label = tx.categoryName ?? "Uncategorized";
      addTotal(income, tx.categoryId ?? "none", label, Math.abs(tx.amount));
    }
  }

  return {
    currency: currencyOf(transactions),
    spending: sorted(spending),
    income: sorted(income),
    tags: sorted(tags),
    uncategorized,
    uncategorizedCount,
  };
}
