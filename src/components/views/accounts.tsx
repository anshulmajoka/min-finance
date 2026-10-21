"use client";

import { useState, type ReactNode } from "react";
import { PlaidLinkButton } from "@/components/plaid-link-button";
import { accountGroup, isCashGroup, isOwedGroup, type AccountGroup } from "@/lib/account-groups";
import { institutionLabel } from "@/lib/institution-label";
import { daysUntil, formatDueLabel, formatPlainMoney, formatShortDate } from "@/lib/money";
import type {
  AccountPayment,
  InstitutionSummary,
  LiabilitiesStatus,
} from "@/lib/types";
import {
  Banknote,
  CreditCard,
  Landmark,
  Loader2,
  PiggyBank,
  Search,
  Wallet,
} from "lucide-react";

type AccountsProps = {
  institutions: InstitutionSummary[];
  readyToLink: boolean;
  refreshingItemId: string | null;
  refreshingAll: boolean;
  loadingBalances: boolean;
  onConnected: () => void;
  onError: (message: string) => void;
  onDisconnect: (itemId?: string) => void;
  onRefreshInstitution: (itemId: string) => void;
  onOpenAccount: (itemId: string, accountId: string) => void;
  onPaymentConsent: (itemId: string) => void;
};

const OTHER_GROUPS = ["Loans", "Investments", "Other"] as const;
type Segment = "all" | "cash" | "credit" | "banks";

type AccountRow = {
  key: string;
  itemId: string;
  accountId: string | null;
  name: string;
  mask: string | null;
  subtype: string | null;
  group: AccountGroup;
  institution: string;
  currentBalance: number | null;
  availableBalance: number | null;
  limit: number | null;
  currency: string | null;
  payment: AccountPayment | null;
  liabilitiesStatus: LiabilitiesStatus | null;
};

export function Accounts({
  institutions,
  readyToLink,
  refreshingItemId,
  refreshingAll,
  loadingBalances,
  onConnected,
  onError,
  onDisconnect,
  onRefreshInstitution,
  onOpenAccount,
  onPaymentConsent,
}: AccountsProps) {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [creditSort, setCreditSort] = useState<"due" | "owed">("due");
  const rows = institutions.flatMap((institution): AccountRow[] => {
    const label = institutionLabel(institution, institutions);
    if (institution.accounts.length === 0) {
      return [
        {
          key: `${institution.itemId}:empty`,
          itemId: institution.itemId,
          accountId: null,
          name: "No accounts reported",
          mask: null,
          subtype: null,
          group: "Other" as AccountGroup,
          institution: label,
          currentBalance: null,
          availableBalance: null,
          limit: null,
          currency: null,
          payment: null,
          liabilitiesStatus: institution.liabilitiesStatus,
        },
      ];
    }
    return institution.accounts.map((account) => ({
      key: `${institution.itemId}:${account.id}`,
      itemId: institution.itemId,
      accountId: account.id,
      name: account.name,
      mask: account.mask,
      subtype: account.subtype,
      group: accountGroup(account),
      institution: label,
      currentBalance: account.currentBalance,
      availableBalance: account.availableBalance,
      limit: account.limit,
      currency: account.currency,
      payment: account.payment,
      liabilitiesStatus: institution.liabilitiesStatus,
    }));
  });
  const needle = query.trim().toLowerCase();
  const visibleRows = rows.filter((row) => {
    if (!needle) return true;
    return `${row.name} ${row.institution} ${row.mask ?? ""} ${row.subtype ?? ""}`
      .toLowerCase()
      .includes(needle);
  });
  const visibleInstitutions = institutions.filter((institution) => {
    if (!needle) return true;
    const label = institutionLabel(institution, institutions);
    if (label.toLowerCase().includes(needle)) return true;
    return institution.accounts.some((account) =>
      `${account.name} ${account.mask ?? ""} ${account.subtype ?? ""}`.toLowerCase().includes(needle),
    );
  });
  const cashRows = visibleRows.filter((row) => isCashGroup(row.group) && row.accountId);
  const creditRows = [...visibleRows.filter((row) => row.group === "Credit" && row.accountId)].sort(
    (a, b) => {
      if (creditSort === "owed") {
        return (b.currentBalance ?? -1) - (a.currentBalance ?? -1);
      }
      const dueA = a.payment?.dueDate ?? "9999-99-99";
      const dueB = b.payment?.dueDate ?? "9999-99-99";
      return dueA.localeCompare(dueB) || a.name.localeCompare(b.name);
    },
  );
  const cashAccounts = rows.filter((row) => isCashGroup(row.group) && row.accountId);
  const cashTotal = groupTotal(cashAccounts, cashAmount);
  const visibleCashTotal = groupTotal(cashRows, cashAmount);
  const creditAccounts = rows.filter((row) => row.group === "Credit" && row.accountId);
  const creditTotal = groupTotal(creditAccounts);
  const visibleCreditTotal = groupTotal(creditRows);
  const cashCount = cashAccounts.length;
  const creditCount = creditAccounts.length;
  const showCash = segment === "all" || segment === "cash";
  const showCredit = segment === "all" || segment === "credit";
  const showBanks = segment === "all" || segment === "banks";
  const showOther = segment === "all";

  if (institutions.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--mint-line)] bg-white px-6 py-14 text-center shadow-[0_8px_24px_-4px_rgba(16,40,32,0.04)]">
        <p className="font-display text-2xl">No bank linked yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--mint-muted)]">
          Connect the bank you use most. You can add another one whenever you want.
        </p>
        {readyToLink ? (
          <div className="mt-6 flex justify-center">
            <PlaidLinkButton
              label="Connect a bank"
              icon="plus"
              onConnected={onConnected}
              onError={onError}
            />
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 divide-y divide-[var(--mint-line)] rounded-2xl border border-[var(--mint-line)] bg-white p-1 shadow-[0_4px_16px_-2px_rgba(16,40,32,0.04)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <SummaryStat
          label="Total cash"
          amount={cashTotal ? formatPlainMoney(cashTotal.amount, cashTotal.currency) : "—"}
          detail={`across ${plural(cashCount, "account")}`}
          icon={<Banknote className="size-5" />}
        />
        <SummaryStat
          label="Total credit debt"
          amount={creditTotal ? formatPlainMoney(creditTotal.amount, creditTotal.currency) : "—"}
          detail={`owed across ${plural(creditCount, "card")}`}
          icon={<CreditCard className="size-5" />}
        />
        <SummaryStat
          label="Connected institutions"
          amount={String(institutions.length)}
          detail={plural(institutions.length, "linked bank")}
          icon={<Landmark className="size-5" />}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-[var(--mint-line)] bg-[var(--mint-mist)] p-1"
          role="tablist"
          aria-label="Account groups"
        >
          <SegmentButton active={segment === "all"} onClick={() => setSegment("all")}>
            All accounts
          </SegmentButton>
          <SegmentButton active={segment === "cash"} onClick={() => setSegment("cash")}>
            Cash ({cashRows.length})
          </SegmentButton>
          <SegmentButton active={segment === "credit"} onClick={() => setSegment("credit")}>
            Credit cards ({creditRows.length})
          </SegmentButton>
          <SegmentButton active={segment === "banks"} onClick={() => setSegment("banks")}>
            Linked banks ({visibleInstitutions.length})
          </SegmentButton>
        </div>
        <label className="relative w-full lg:w-80">
          <span className="sr-only">Search accounts or banks</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--mint-muted)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search accounts or banks"
            className="h-10 w-full rounded-xl border border-[var(--mint-line)] bg-white pr-4 pl-10 text-sm outline-none placeholder:text-[var(--mint-muted)] focus-visible:border-[var(--mint-leaf)] focus-visible:ring-2 focus-visible:ring-[var(--mint-leaf)]/20"
          />
        </label>
      </div>

      {loadingBalances ? (
        <p className="flex items-center gap-2 text-sm text-[var(--mint-muted)]">
          <Loader2 className="size-4 animate-spin text-[var(--mint-forest)]" />
          Loading balances…
        </p>
      ) : null}

      <div className="flex flex-col gap-8">
        {showCash || showBanks ? (
          <div className="grid items-start gap-8 xl:grid-cols-12">
            {showCash ? (
              <section
                className={`rounded-2xl border border-[var(--mint-line)] bg-white p-6 shadow-[0_8px_24px_-4px_rgba(16,40,32,0.04)] ${
                  showBanks ? "xl:col-span-7" : "xl:col-span-12"
                }`}
              >
                <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-[var(--mint-line)] pb-3">
                  <div className="flex items-baseline gap-3">
                    <h2 className="font-display text-2xl">Cash</h2>
                    {visibleCashTotal ? (
                      <span className="font-display text-2xl tabular-nums">
                        {formatPlainMoney(visibleCashTotal.amount, visibleCashTotal.currency)}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-[var(--mint-muted)]">{plural(cashRows.length, "account")}</span>
                </div>
                <p className="mt-2 mb-4 text-sm text-[var(--mint-muted)]">Tap an account to see its activity.</p>
                {cashRows.length === 0 ? (
                  <p className="text-sm text-[var(--mint-muted)]">No checking or savings accounts match.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {cashRows.map((account) => (
                      <CashCard
                        key={account.key}
                        account={account}
                        onOpen={() => onOpenAccount(account.itemId, account.accountId as string)}
                      />
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {showBanks ? (
              <section
                className={`rounded-2xl border border-[var(--mint-line)] bg-white p-6 shadow-[0_8px_24px_-4px_rgba(16,40,32,0.04)] ${
                  showCash ? "xl:col-span-5" : "xl:col-span-12"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--mint-line)] pb-3">
                  <h2 className="font-display text-2xl">Linked banks</h2>
                  <span className="text-xs text-[var(--mint-muted)]">
                    {plural(visibleInstitutions.length, "institution")}
                  </span>
                </div>
                {visibleInstitutions.length === 0 ? (
                  <p className="text-sm text-[var(--mint-muted)]">No linked banks match.</p>
                ) : (
                  <ul className="divide-y divide-[var(--mint-line)]">
                    {visibleInstitutions.map((institution) => {
                      const label = institutionLabel(institution, institutions);
                      const refreshing = refreshingItemId === institution.itemId;
                      const needsDueDate =
                        institution.liabilitiesStatus !== "ready" &&
                        institution.accounts.some((account) => {
                          const group = accountGroup(account);
                          return group === "Credit" || group === "Loans";
                        });
                      const updated = institution.balancesAsOf
                        ? `Balances as of ${formatShortDate(institution.balancesAsOf.slice(0, 10))}`
                        : institution.lastSyncedAt
                          ? `Updated ${formatShortDate(institution.lastSyncedAt.slice(0, 10))}`
                          : "Not updated yet";
                      return (
                        <li
                          key={institution.itemId}
                          className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm">
                              <span className="font-semibold">{label}</span>
                              <span className="text-[var(--mint-muted)]">
                                {" "}
                                — {plural(institution.accounts.length, "account")}
                              </span>
                            </p>
                            <p className="text-xs text-[var(--mint-muted)]">{updated}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            {needsDueDate ? (
                              <PlaidLinkButton
                                compact
                                variant="ghost"
                                label="Show due date"
                                icon="landmark"
                                updateItemId={institution.itemId}
                                className="h-8 bg-transparent px-1.5 text-xs font-medium text-[var(--mint-forest)] shadow-none hover:bg-transparent hover:underline"
                                onConnected={() => onPaymentConsent(institution.itemId)}
                                onError={onError}
                              />
                            ) : null}
                            <button
                              type="button"
                              className="px-1.5 py-0.5 text-xs font-medium text-[var(--mint-forest)] hover:underline disabled:opacity-50"
                              disabled={refreshingAll || refreshingItemId !== null}
                              onClick={() => onRefreshInstitution(institution.itemId)}
                            >
                              {refreshing ? "Updating…" : "Update"}
                            </button>
                            <button
                              type="button"
                              className="px-1.5 py-0.5 text-xs text-[var(--mint-muted)] hover:text-red-700 hover:underline"
                              onClick={() => onDisconnect(institution.itemId)}
                            >
                              Disconnect
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {institutions.length > 1 && !needle ? (
                  <button
                    type="button"
                    className="mt-3 text-xs text-[var(--mint-muted)] hover:text-red-700 hover:underline"
                    onClick={() => onDisconnect()}
                  >
                    Disconnect all
                  </button>
                ) : null}
              </section>
            ) : null}
          </div>
        ) : null}

        {showCredit ? (
          <section className="rounded-2xl border border-[var(--mint-line)] bg-white p-6 shadow-[0_8px_24px_-4px_rgba(16,40,32,0.04)] sm:p-7">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mint-line)] pb-5">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-2xl">Credit cards</h2>
                {visibleCreditTotal ? (
                  <span className="text-sm tabular-nums text-[var(--mint-muted)]">
                    {formatPlainMoney(visibleCreditTotal.amount, visibleCreditTotal.currency)} owed
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-[var(--mint-muted)]">{plural(creditRows.length, "card")}</span>
                <label className="flex items-center rounded-lg border border-[var(--mint-line)] bg-[var(--mint-mist)] px-2.5 py-1 text-sm">
                  <span className="sr-only">Sort credit cards</span>
                  <select
                    value={creditSort}
                    onChange={(event) => setCreditSort(event.target.value === "owed" ? "owed" : "due")}
                    className="bg-transparent text-sm text-[var(--mint-ink)] outline-none"
                  >
                    <option value="due">Sort by due date</option>
                    <option value="owed">Sort by amount owed</option>
                  </select>
                </label>
              </div>
            </div>
            {creditRows.length === 0 ? (
              <p className="pt-4 text-sm text-[var(--mint-muted)]">No credit cards match.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--mint-line)] text-xs tracking-wider text-[var(--mint-muted)] uppercase">
                      <th className="py-3 pr-3 pl-3 font-semibold">Card</th>
                      <th className="px-3 py-3 font-semibold">Bank</th>
                      <th className="px-3 py-3 font-semibold">Due</th>
                      <th className="px-3 py-3 text-right font-semibold">Minimum</th>
                      <th className="py-3 pr-3 pl-3 text-right font-semibold">Owed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--mint-line)]">
                    {creditRows.map((account) => {
                      const due = account.payment?.dueDate ?? null;
                      const soon = due ? daysUntil(due) <= 3 : false;
                      const overdue = Boolean(account.payment?.overdue);
                      const currency = account.currency || "USD";
                      return (
                        <tr key={account.key} className="hover:bg-[var(--mint-mist)]/60">
                          <td className="py-3.5 pr-3 pl-3">
                            <button
                              type="button"
                              onClick={() => onOpenAccount(account.itemId, account.accountId as string)}
                              className="text-left font-medium hover:text-[var(--mint-forest)]"
                            >
                              {account.name}
                              {account.mask ? (
                                <span className="font-normal text-[var(--mint-muted)]"> ····{account.mask}</span>
                              ) : null}
                            </button>
                          </td>
                          <td className="px-3 py-3.5 text-[var(--mint-muted)]">{account.institution}</td>
                          <td
                            className={`px-3 py-3.5 ${
                              soon || overdue
                                ? "font-semibold text-[var(--mint-due)]"
                                : "text-[var(--mint-muted)]"
                            }`}
                          >
                            {overdue ? "Overdue" : due ? formatDueLabel(due) : "—"}
                          </td>
                          <td className="px-3 py-3.5 text-right text-[var(--mint-muted)] tabular-nums">
                            {typeof account.payment?.minimumAmount === "number"
                              ? `min ${formatPlainMoney(account.payment.minimumAmount, currency)}`
                              : "—"}
                          </td>
                          <td className="py-3.5 pr-3 pl-3 text-right font-display text-lg tabular-nums">
                            {typeof account.currentBalance === "number"
                              ? formatPlainMoney(account.currentBalance, currency)
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {showOther
          ? OTHER_GROUPS.map((group) => {
              const accounts = visibleRows.filter((row) => row.group === group && row.accountId);
              if (accounts.length === 0) return null;
              const total = groupTotal(accounts);
              return (
                <section
                  key={group}
                  className="overflow-hidden rounded-2xl border border-[var(--mint-line)] bg-white shadow-[0_8px_24px_-4px_rgba(16,40,32,0.04)]"
                >
                  <div className="flex items-baseline justify-between gap-3 border-b border-[var(--mint-line)] px-6 py-4">
                    <h2 className="font-display text-2xl">{group}</h2>
                    {total ? (
                      <p className="text-sm tabular-nums">
                        {formatPlainMoney(total.amount, total.currency)}
                        {isOwedGroup(group) ? " owed" : ""}
                      </p>
                    ) : null}
                  </div>
                  <ul>
                    {accounts.map((account) => (
                      <li key={account.key} className="border-b border-[var(--mint-line)] last:border-b-0">
                        <button
                          type="button"
                          onClick={() => onOpenAccount(account.itemId, account.accountId as string)}
                          className="flex w-full items-center justify-between gap-4 px-6 py-3 text-left hover:bg-[var(--mint-mist)]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{account.name}</p>
                            <p className="truncate text-xs text-[var(--mint-muted)]">
                              {account.institution}
                              {account.subtype ? ` · ${account.subtype}` : ""}
                              {account.mask ? ` ····${account.mask}` : ""}
                            </p>
                            <PaymentDetails account={account} group={group} />
                          </div>
                          <BalanceDetails account={account} group={group} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          : null}
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  amount,
  detail,
  icon,
}: {
  label: string;
  amount: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4">
      <div>
        <p className="text-xs tracking-wider text-[var(--mint-muted)] uppercase">{label}</p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
          <p className="font-display text-2xl tabular-nums">{amount}</p>
          <p className="text-sm text-[var(--mint-muted)]">{detail}</p>
        </div>
      </div>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--mint-mist)] text-[var(--mint-forest)]">
        {icon}
      </div>
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm transition-colors ${
        active
          ? "bg-white font-semibold text-[var(--mint-forest)] shadow-sm"
          : "text-[var(--mint-muted)] hover:text-[var(--mint-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function cashAmount(account: AccountRow) {
  if (account.group === "Checking" && typeof account.availableBalance === "number") {
    return account.availableBalance;
  }
  return account.currentBalance;
}

function CashCard({ account, onOpen }: { account: AccountRow; onOpen: () => void }) {
  const currency = account.currency || "USD";
  const checking = account.group === "Checking";
  const amount = cashAmount(account);
  const Icon = checking ? Wallet : PiggyBank;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-28 flex-col justify-between rounded-xl border border-[var(--mint-line)] bg-[var(--mint-mist)]/40 p-3.5 text-left transition-colors hover:bg-[var(--mint-mist)]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm text-[var(--mint-muted)]">
          <Icon className="size-4 shrink-0" />
          <span className="truncate">{account.institution}</span>
        </span>
        <span className="shrink-0 text-xs text-[var(--mint-muted)]">{checking ? "Available" : "Balance"}</span>
      </div>
      <div>
        <p className="line-clamp-1 text-sm font-medium">
          {account.name}
          {account.mask ? <span className="font-normal text-[var(--mint-muted)]"> ····{account.mask}</span> : null}
        </p>
        <p className="font-display text-xl tabular-nums">
          {typeof amount === "number" ? formatPlainMoney(amount, currency) : "—"}
        </p>
      </div>
    </button>
  );
}

function groupTotal(
  accounts: AccountRow[],
  amountOf: (account: AccountRow) => number | null = (account) => account.currentBalance,
) {
  const withBalance = accounts.filter(
    (account) => account.accountId && typeof amountOf(account) === "number",
  );
  if (withBalance.length === 0 || withBalance.length !== accounts.filter((account) => account.accountId).length) {
    return null;
  }
  const currencies = new Set(withBalance.map((account) => account.currency || "USD"));
  if (currencies.size !== 1) return null;
  return {
    amount: withBalance.reduce((sum, account) => sum + (amountOf(account) ?? 0), 0),
    currency: [...currencies][0],
  };
}

function PaymentDetails({ account, group }: { account: AccountRow; group: AccountGroup }) {
  const payment = account.payment;
  const currency = account.currency || "USD";
  const hasPayment = Boolean(
    payment &&
      (payment.dueDate ||
        payment.minimumAmount !== null ||
        payment.statementBalance !== null ||
        payment.lastPaymentAmount !== null ||
        payment.purchaseApr !== null ||
        payment.overdue),
  );

  if (!hasPayment) {
    if (
      (group === "Credit" || group === "Loans") &&
      account.liabilitiesStatus === "unavailable"
    ) {
      return (
        <p className="mt-2 max-w-sm text-xs leading-relaxed text-[var(--mint-muted)]">
          Use Show due date on this bank to see when the payment is due.
        </p>
      );
    }
    return null;
  }

  return (
    <div className="mt-2 space-y-0.5 text-xs leading-relaxed text-[var(--mint-muted)]">
      {payment?.overdue ? <p className="font-medium text-[var(--mint-due)]">Payment overdue</p> : null}
      {payment?.dueDate ? <p>Due {formatShortDate(payment.dueDate)}</p> : null}
      {typeof payment?.minimumAmount === "number" ? (
        <p>Minimum due {formatPlainMoney(payment.minimumAmount, currency)}</p>
      ) : null}
      {typeof payment?.statementBalance === "number" ? (
        <p>
          Statement balance {formatPlainMoney(payment.statementBalance, currency)}
          {payment.statementDate ? ` · ${formatShortDate(payment.statementDate)}` : ""}
        </p>
      ) : null}
      {typeof payment?.lastPaymentAmount === "number" ? (
        <p>
          Last payment {formatPlainMoney(payment.lastPaymentAmount, currency)}
          {payment.lastPaymentDate ? ` on ${formatShortDate(payment.lastPaymentDate)}` : ""}
        </p>
      ) : null}
      {typeof payment?.purchaseApr === "number" ? (
        <p>Purchase APR {formatApr(payment.purchaseApr)}</p>
      ) : null}
    </div>
  );
}

function formatApr(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function BalanceDetails({ account, group }: { account: AccountRow; group: AccountGroup }) {
  const currency = account.currency || "USD";
  return (
    <div className="shrink-0 text-right">
      <p className="text-sm font-medium tabular-nums">
        {typeof account.currentBalance === "number"
          ? formatPlainMoney(account.currentBalance, currency)
          : "—"}
      </p>
      <p className="text-xs text-[var(--mint-muted)]">
        {typeof account.currentBalance === "number"
          ? isOwedGroup(group)
            ? "Owed"
            : "Balance"
          : "No balance yet"}
      </p>
    </div>
  );
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
