"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ChartColumn,
  ChartPie,
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
  Bell,
  LogOut,
  User,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

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
    id: "analytics",
    label: "Analytics",
    description: "Spending by category and tag.",
    icon: ChartPie,
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

const SIDEBAR_PRIMARY_IDS: AppView[] = [
  "dashboard",
  "accounts",
  "transactions",
  "cash-flow",
  "analytics",
];
const MOBILE_TAB_IDS: AppView[] = ["dashboard", "accounts", "transactions", "analytics"];
const LATER_IDS: AppView[] = ["budget", "recurring", "goals"];
const MORE_IDS: AppView[] = ["cash-flow", ...LATER_IDS];

type AppShellProps = {
  view: AppView;
  onViewChange: (view: AppView) => void;
  onRefresh: () => void;
  refreshing: boolean;
  refreshDisabled: boolean;
  headerActions?: ReactNode;
  children: ReactNode;
};

export function AppShell({
  view,
  onViewChange,
  onRefresh,
  refreshing,
  refreshDisabled,
  headerActions,
  children,
}: AppShellProps) {
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const current = APP_VIEWS.find((item) => item.id === view) ?? APP_VIEWS[0];
  const sidebarPrimary = APP_VIEWS.filter((item) => SIDEBAR_PRIMARY_IDS.includes(item.id));
  const later = APP_VIEWS.filter((item) => LATER_IDS.includes(item.id));
  const mobileTabs = APP_VIEWS.filter((item) => MOBILE_TAB_IDS.includes(item.id));
  const moreItems = APP_VIEWS.filter((item) => MORE_IDS.includes(item.id));
  const moreActive = MORE_IDS.includes(view);

  function select(next: AppView) {
    setMoreOpen(false);
    onViewChange(next);
  }

  async function signOut() {
    const result = await authClient.signOut();
    if (!result.error) {
      router.replace("/login");
      router.refresh();
    }
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
          {sidebarPrimary.map((item) => (
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

      <div className="flex min-w-0 flex-1 flex-col pb-24 lg:pb-0">
        <header className="sticky top-0 z-30 border-b border-[var(--mint-line)]/60 bg-[var(--background)]/85 px-5 py-3 backdrop-blur-xl lg:static lg:border-b lg:border-[var(--mint-line)] lg:bg-white/90 lg:px-8 lg:py-4 lg:backdrop-blur-none">
          <div className="flex items-center justify-between gap-3 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-full bg-[var(--mint-forest)] text-white">
                <Leaf className="size-4" />
              </div>
              <div className="leading-none">
                <p className="font-display text-xl tracking-tight text-[var(--mint-forest)]">Mint</p>
                <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--mint-muted)] uppercase">
                  Finance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Notifications"
                className="flex size-11 items-center justify-center rounded-full text-[var(--mint-muted)] transition-colors hover:bg-[var(--mint-mist)]"
              >
                <Bell className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Sign out"
                onClick={() => void signOut()}
                className="ml-1 flex size-8 items-center justify-center rounded-full bg-[var(--mint-forest)] text-white"
              >
                <User className="size-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-start justify-between gap-3 lg:mt-0 lg:flex-wrap lg:items-center">
            <div className="min-w-0">
              <p className="mb-1 hidden font-display text-xl leading-none tracking-tight lg:block">
                Mint
              </p>
              <h1 className="font-display text-[28px] leading-[34px] tracking-tight text-[var(--mint-forest)] lg:text-3xl lg:text-[var(--mint-ink)]">
                {current.label}
              </h1>
              <p className="mt-0.5 text-[13px] leading-5 text-[var(--mint-muted)] lg:mt-1 lg:text-sm">
                {current.description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                aria-label="Refresh activity"
                onClick={onRefresh}
                disabled={refreshDisabled}
                className="flex size-10 items-center justify-center rounded-full bg-white text-[var(--mint-forest)] shadow-sm transition-transform active:scale-95 disabled:opacity-50 lg:hidden"
              >
                {refreshing ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <RefreshCw className="size-5" />
                )}
              </button>
              <Button
                variant="outline"
                className="hidden h-10 gap-2 border-[var(--mint-line)] bg-white text-[var(--mint-forest)] lg:inline-flex"
                onClick={() => void signOut()}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
              <Button
                variant="outline"
                className="hidden h-10 gap-2 border-[var(--mint-line)] bg-white text-[var(--mint-forest)] lg:inline-flex"
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
              {headerActions}
            </div>
          </div>
        </header>

        <main className="flex-1 px-5 py-4 sm:px-8 sm:py-8 lg:px-8">{children}</main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--mint-line)]/50 bg-[var(--background)]/85 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl lg:hidden"
        aria-label="Primary"
      >
        {moreOpen ? (
          <div className="grid grid-cols-2 gap-2 border-b border-[var(--mint-line)] px-3 py-3 sm:grid-cols-4">
            {moreItems.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={item.id === view}
                onSelect={select}
                compact
              />
            ))}
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-[var(--mint-ink)]/80 hover:bg-[var(--mint-mist)]"
            >
              <LogOut className="size-4 shrink-0" />
              Sign out
            </button>
          </div>
        ) : null}
        <div className="flex h-20 items-center justify-around px-2">
          {mobileTabs.map((item) => (
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
            className={`flex min-h-11 min-w-14 flex-col items-center justify-center gap-1 text-[11px] tracking-wide ${
              moreActive || moreOpen
                ? "font-semibold text-[var(--mint-forest)]"
                : "text-[var(--mint-muted)]"
            }`}
          >
            <MoreHorizontal className="size-[22px]" />
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
      className={`relative flex min-h-11 min-w-14 flex-col items-center justify-center gap-1 text-center text-[11px] tracking-wide ${
        active
          ? "font-semibold text-[var(--mint-forest)]"
          : "text-[var(--mint-muted)]"
      }`}
    >
      {active ? (
        <span className="absolute top-0 h-0.5 w-6 rounded-full bg-[var(--mint-forest)]" />
      ) : null}
      <Icon className="size-[22px]" />
      {item.label}
    </button>
  );
}
