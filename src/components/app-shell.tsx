"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  ChartColumn,
  Landmark,
  LayoutDashboard,
  Leaf,
  List,
  Loader2,
  MoreHorizontal,
  PiggyBank,
  RefreshCw,
  Repeat,
  Target,
} from "lucide-react";

export const APP_VIEWS = [
  {
    id: "dashboard",
    label: "Home",
    description: "What you have left this month.",
    icon: LayoutDashboard,
  },
  {
    id: "accounts",
    label: "Accounts",
    description: "Balances and the banks you have linked.",
    icon: Landmark,
  },
  {
    id: "transactions",
    label: "Activity",
    description: "Search and review what you spent.",
    icon: List,
  },
  {
    id: "cash-flow",
    label: "Cash flow",
    description: "Money in and money out, by month.",
    icon: ChartColumn,
  },
  {
    id: "budget",
    label: "Budget",
    description: "Spending limits are not set up yet.",
    icon: PiggyBank,
  },
  {
    id: "recurring",
    label: "Recurring",
    description: "Bills and subscriptions are not set up yet.",
    icon: Repeat,
  },
  {
    id: "goals",
    label: "Goals",
    description: "Savings targets are not set up yet.",
    icon: Target,
  },
] as const;

export type AppView = (typeof APP_VIEWS)[number]["id"];

const PRIMARY_IDS: AppView[] = ["dashboard", "accounts", "transactions", "cash-flow"];
const LATER_IDS: AppView[] = ["budget", "recurring", "goals"];

type AppShellProps = {
  view: AppView;
  onViewChange: (view: AppView) => void;
  onRefresh: () => void;
  refreshing: boolean;
  refreshDisabled: boolean;
  children: ReactNode;
};

export function AppShell({
  view,
  onViewChange,
  onRefresh,
  refreshing,
  refreshDisabled,
  children,
}: AppShellProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const current = APP_VIEWS.find((item) => item.id === view) ?? APP_VIEWS[0];
  const primary = APP_VIEWS.filter((item) => PRIMARY_IDS.includes(item.id));
  const later = APP_VIEWS.filter((item) => LATER_IDS.includes(item.id));
  const laterActive = LATER_IDS.includes(view);

  function select(next: AppView) {
    setMoreOpen(false);
    onViewChange(next);
  }

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--mint-ink)]">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--mint-line)] bg-white lg:flex">
        <div className="px-5 pt-6 pb-5">
          <p className="flex items-center gap-2 font-display text-2xl leading-none tracking-tight">
            <Leaf className="size-5 text-[var(--mint-forest)]" />
            Mint
          </p>
          <p className="mt-1 text-sm text-[var(--mint-muted)]">Your money, in one place</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Primary">
          {primary.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={item.id === view}
              onSelect={select}
            />
          ))}
          <p className="mt-6 px-3 text-xs font-medium tracking-wide text-[var(--mint-muted)] uppercase">
            Coming later
          </p>
          {later.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={item.id === view}
              onSelect={select}
            />
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mint-line)] bg-white/90 px-4 py-4 sm:px-8">
          <div className="min-w-0">
            <p className="font-display text-xl leading-none tracking-tight lg:hidden">Mint</p>
            <h1 className="font-display text-2xl tracking-tight sm:text-3xl">{current.label}</h1>
            <p className="mt-1 text-sm text-[var(--mint-muted)]">{current.description}</p>
          </div>
          <Button
            variant="outline"
            className="h-10 gap-2 border-[var(--mint-line)] bg-white"
            onClick={onRefresh}
            disabled={refreshDisabled}
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Update
          </Button>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--mint-line)] bg-white lg:hidden"
        aria-label="Primary"
      >
        {moreOpen ? (
          <div className="grid grid-cols-3 gap-2 border-b border-[var(--mint-line)] px-3 py-3">
            {later.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={item.id === view}
                onSelect={select}
                compact
              />
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-5">
          {primary.map((item) => (
            <TabButton
              key={item.id}
              item={item}
              active={item.id === view}
              onSelect={select}
            />
          ))}
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className={`flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium ${
              laterActive || moreOpen
                ? "text-[var(--mint-forest)]"
                : "text-[var(--mint-muted)]"
            }`}
          >
            <MoreHorizontal className="size-5" />
            More
          </button>
        </div>
      </nav>
    </div>
  );
}

function NavButton({
  item,
  active,
  onSelect,
  compact = false,
}: {
  item: (typeof APP_VIEWS)[number];
  active: boolean;
  onSelect: (view: AppView) => void;
  compact?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(item.id)}
      className={`inline-flex items-center gap-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
        compact ? "justify-center px-2 py-2" : "px-3 py-2.5"
      } ${
        active
          ? "bg-[var(--mint-foam)] text-[var(--mint-forest)]"
          : "text-[var(--mint-ink)]/80 hover:bg-[var(--mint-mist)]"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </button>
  );
}

function TabButton({
  item,
  active,
  onSelect,
}: {
  item: (typeof APP_VIEWS)[number];
  active: boolean;
  onSelect: (view: AppView) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(item.id)}
      className={`flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium ${
        active ? "text-[var(--mint-forest)]" : "text-[var(--mint-muted)]"
      }`}
    >
      <Icon className="size-5" />
      {item.label}
    </button>
  );
}
