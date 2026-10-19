import type { ReactNode } from "react";
import { PlaidLinkButton } from "@/components/plaid-link-button";
import { accountGroup, isCashGroup } from "@/lib/account-groups";
import { summarizeFlow } from "@/lib/cash-flow";
import { institutionLabel } from "@/lib/institution-label";
import {
  currentMonthKey,
  daysUntil,
  formatDueLabel,
  formatMonthLabel,
  formatPlainMoney,
  formatShortDate,
  formatSignedMoney,
} from "@/lib/money";
import type { DisplayTransaction, InstitutionSummary } from "@/lib/types";
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
  onOpenAccount: (itemId: string, accountId: string) => void;
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
  onOpenAccount,
}: DashboardProps) {
  const month = currentMonthKey();
  const monthTransactions = transactions.filter((tx) => tx.date.startsWith(month));
  const flow = summarizeFlow(monthTransactions);
  const recent = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 6);
  const compared = flow.income + flow.spending;
  const spentShare = compared === 0 ? 0 : Math.min(100, (flow.spending / compared) * 100);

  const rows = institutions.flatMap((institution) =>
    institution.accounts.map((account) => ({
      ...account,
      itemId: institution.itemId,
      institution: institutionLabel(institution, institutions),
      group: accountGroup(account),
    })),
  );
  const cash = rows.filter((row) => isCashGroup(row.group));
  const cards = rows.filter((row) => row.group === "Credit");
  const cashTotal = sameCurrencyTotal(cash.map((row) => row.currentBalance), cash[0]?.currency);
  const owedTotal = sameCurrencyTotal(cards.map((row) => row.currentBalance), cards[0]?.currency);
  const upcoming = cards
    .filter((row) => row.payment?.dueDate)
    .sort((a, b) => (a.payment?.dueDate ?? "").localeCompare(b.payment?.dueDate ?? ""));
  const nextDue = upcoming[0];
  const bankNames = institutions.map((institution) => institutionLabel(institution, institutions));

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
      <section className="rounded-xl bg-[var(--mint-forest)] px-6 py-6 text-[#f4fff9] sm:px-8 sm:py-7">
        <p className="text-xs tracking-[0.14em] text-white/75 uppercase">
          {formatMonthLabel(month)}
        </p>
        <p className="mt-4 text-sm text-white/80">Left this month</p>
        <p className="mt-1 font-display text-5xl tabular-nums">
          {formatPlainMoney(flow.net, flow.currency)}
        </p>
        <p className="mt-2 text-sm text-white/75">
          {flow.net < 0 ? "Spending is ahead of income this month." : "Income minus spending so far."}
        </p>
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/20">
          <div className="h-1.5 rounded-full bg-white" style={{ width: `${spentShare}%` }} />
        </div>
        <p className="mt-3 text-sm text-white/85">
          Money in {formatPlainMoney(flow.income, flow.currency)}
          <span className="mx-3 text-white/40">·</span>
          Money out {formatPlainMoney(flow.spending, flow.currency)}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Cash"
          value={
            cashTotal
              ? `${formatPlainMoney(cashTotal.amount, cashTotal.currency)} across ${cash.length} ${cash.length === 1 ? "account" : "accounts"}`
              : cash.length
                ? `${cash.length} ${cash.length === 1 ? "account" : "accounts"}`
                : "No cash accounts"
          }
          hint={cashHint(cash)}
          onOpen={onOpenAccounts}
        />
        <SummaryCard
          label="Credit cards"
          value={
            owedTotal
              ? `${formatPlainMoney(owedTotal.amount, owedTotal.currency)} owed across ${cards.length} ${cards.length === 1 ? "card" : "cards"}`
              : cards.length
                ? `${cards.length} ${cards.length === 1 ? "card" : "cards"}`
                : "No cards linked"
          }
          hint={
            nextDue?.payment?.dueDate
              ? `Next due ${formatDueLabel(nextDue.payment.dueDate)}, ${nextDue.name}${
                  typeof nextDue.payment.minimumAmount === "number"
                    ? `, ${formatPlainMoney(nextDue.payment.minimumAmount, nextDue.currency || "USD")}`
                    : ""
                }.`
              : cards.length
                ? "Due dates show after they load."
                : "Cards you link will be totaled here."
          }
          onOpen={onOpenAccounts}
        />
        <SummaryCard
          label="Banks"
          value={`${institutions.length} linked`}
          hint={bankNames.length ? joinNames(bankNames) : "No banks yet."}
          onOpen={onOpenAccounts}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <section className="rounded-xl border border-[var(--mint-line)] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--mint-line)] px-5 py-4">
            <h2 className="font-display text-xl">Recent activity</h2>
            <TextLink onClick={onOpenTransactions}>See all</TextLink>
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

        <section className="rounded-xl border border-[var(--mint-line)] bg-white">
          <div className="border-b border-[var(--mint-line)] px-5 py-4">
            <h2 className="font-display text-xl">Payments coming up</h2>
          </div>
          {upcoming.length === 0 ? (
            <p className="px-5 py-8 text-sm text-[var(--mint-muted)]">
              {cards.length
                ? "No due dates yet. Open Accounts and use Show due date on a bank."
                : "Credit card payments will show up here."}
            </p>
          ) : (
            <ul>
              {upcoming.slice(0, 3).map((card) => (
                <li key={`${card.itemId}:${card.id}`}>
                  <button
                    type="button"
                    onClick={() => onOpenAccount(card.itemId, card.id)}
                    className="flex w-full items-center justify-between gap-3 border-b border-[var(--mint-line)] px-5 py-3 text-left last:border-b-0 hover:bg-[var(--mint-mist)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{card.name}</p>
                      <p
                        className={`text-xs ${
                          card.payment?.dueDate && daysUntil(card.payment.dueDate) <= 3
                            ? "text-[var(--mint-due)]"
                            : "text-[var(--mint-muted)]"
                        }`}
                      >
                        due {card.payment?.dueDate ? formatDueLabel(card.payment.dueDate) : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm tabular-nums text-[var(--mint-muted)]">
                      {typeof card.payment?.minimumAmount === "number"
                        ? `min ${formatPlainMoney(card.payment.minimumAmount, card.currency || "USD")}`
                        : "min —"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {cards.length > 0 ? (
            <div className="px-5 py-3">
              <TextLink onClick={onOpenAccounts}>
                All {cards.length} {cards.length === 1 ? "card" : "cards"}
              </TextLink>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function sameCurrencyTotal(amounts: (number | null)[], currency: string | null | undefined) {
  if (amounts.length === 0 || amounts.some((amount) => typeof amount !== "number")) return null;
  return {
    amount: amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0),
    currency: currency || "USD",
  };
}

function cashHint(cash: { group: string }[]) {
  const checking = cash.filter((row) => row.group === "Checking").length;
  const savings = cash.filter((row) => row.group === "Savings").length;
  if (checking === 0 && savings === 0) return "Checking and savings will be counted here.";
  return `${checking} checking, ${savings} savings.`;
}

function joinNames(names: string[]) {
  if (names.length <= 4) return `${names.join(", ")}.`;
  return `${names.slice(0, 3).join(", ")}, +${names.length - 3} more.`;
}

function SummaryCard({
  label,
  value,
  hint,
  onOpen,
}: {
  label: string;
  value: string;
  hint: string;
  onOpen: () => void;
}) {
  return (
    <article className="flex flex-col rounded-xl border border-[var(--mint-line)] bg-white px-5 py-4">
      <p className="text-xs tracking-[0.14em] text-[var(--mint-muted)] uppercase">{label}</p>
      <p className="mt-2 font-display text-2xl leading-snug">{value}</p>
      <p className="mt-1 text-sm text-[var(--mint-muted)]">{hint}</p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-4 text-left text-sm font-medium text-[var(--mint-forest)]"
      >
        See accounts
      </button>
    </article>
  );
}

function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-sm font-medium text-[var(--mint-forest)]">
      {children}
    </button>
  );
}
