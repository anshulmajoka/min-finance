import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Car,
  Coffee,
  CreditCard,
  Fuel,
  Landmark,
  Plane,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  Waves,
} from "lucide-react";
import { currentDayKey } from "@/lib/money";
import type { DisplayTransaction } from "@/lib/types";

export function isIncomeTransaction(tx: DisplayTransaction) {
  return tx.amount < 0;
}

export function transactionIcon(tx: DisplayTransaction): LucideIcon {
  const haystack = [
    tx.categoryName,
    tx.plaidCategoryPrimary,
    tx.plaidCategoryDetailed,
    tx.merchant,
    tx.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/grocer|supermarket|whole foods|market/.test(haystack)) return ShoppingCart;
  if (/travel|airline|flight|delta|united|air/.test(haystack)) return Plane;
  if (/gas|fuel|transport|shell|exxon|chevron/.test(haystack)) return Fuel;
  if (/income|payroll|paycheck|deposit|salary|wage/.test(haystack)) return Landmark;
  if (/subscription|spotify|netflix|music|stream|audio/.test(haystack)) return Waves;
  if (/shop|amazon|retail|mall|store/.test(haystack)) return ShoppingBag;
  if (/transfer|vault|savings|move/.test(haystack)) return ArrowLeftRight;
  if (/uber|lyft|taxi|rideshare|transit|car/.test(haystack)) return Car;
  if (/coffee|cafe|starbucks/.test(haystack)) return Coffee;
  if (/dining|restaurant|food|eat/.test(haystack)) return Utensils;
  if (/payment|card|credit/.test(haystack)) return CreditCard;
  return Receipt;
}

export function formatActivityDateLabel(date: string, now = new Date()) {
  const today = currentDayKey(now);
  const parsed = new Date(`${date}T12:00:00`);
  const short = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parsed);
  if (date === today) return `Today · ${short}`;
  return short;
}

export function groupTransactionsByDate(transactions: DisplayTransaction[]) {
  const groups: { date: string; label: string; items: DisplayTransaction[] }[] = [];
  const index = new Map<string, number>();

  for (const tx of transactions) {
    const existing = index.get(tx.date);
    if (existing === undefined) {
      index.set(tx.date, groups.length);
      groups.push({
        date: tx.date,
        label: formatActivityDateLabel(tx.date),
        items: [tx],
      });
    } else {
      groups[existing].items.push(tx);
    }
  }

  return groups;
}
