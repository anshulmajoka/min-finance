"use client";

import { useState } from "react";
import { PlaidLinkButton } from "@/components/plaid-link-button";
import { Button } from "@/components/ui/button";
import { accountGroup, isCashGroup, isOwedGroup, type AccountGroup } from "@/lib/account-groups";
import { institutionLabel } from "@/lib/institution-label";
import { daysUntil, formatDueLabel, formatPlainMoney, formatShortDate } from "@/lib/money";
import type {
  AccountPayment,
  InstitutionSummary,
  LiabilitiesStatus,
} from "@/lib/types";
import { Loader2, RefreshCw, Unplug } from "lucide-react";

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
  const cashTotal = groupTotal(cashRows);
  const creditTotal = groupTotal(creditRows);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        {institutions.length > 0 ? (
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search accounts or banks</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search accounts or banks"
              className="h-10 w-full rounded-lg border border-[var(--mint-line)] bg-white px-3 text-sm outline-none placeholder:text-[var(--mint-muted)] focus-visible:border-[var(--mint-leaf)] focus-visible:ring-3 focus-visible:ring-[var(--mint-leaf)]/30"
            />
          </label>
        ) : null}
        {readyToLink ? (
          <PlaidLinkButton
            label={institutions.length > 0 ? "Add a bank" : "Connect a bank"}
            onConnected={onConnected}
            onError={onError}
          />
        ) : null}
        {institutions.length > 1 ? (
          <Button variant="ghost" className="h-10 gap-2" onClick={() => onDisconnect()}>
            <Unplug className="size-4" />
            Disconnect all
          </Button>
        ) : null}
        {loadingBalances ? (
          <p className="flex items-center gap-2 text-sm text-[var(--mint-muted)]">
            <Loader2 className="size-4 animate-spin text-[var(--mint-forest)]" />
            Loading balances…
          </p>
        ) : null}
      </div>

      {institutions.length === 0 ? (
        <section className="rounded-2xl border border-[var(--mint-line)] bg-white px-6 py-14 text-center shadow-sm">
          <p className="font-display text-2xl">No bank linked yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--mint-muted)]">
            Connect the bank you use most. You can add another one whenever you want.
          </p>
        </section>
      ) : (
        <>
          <section className="overflow-hidden rounded-xl border border-[var(--mint-line)] bg-white">
            <div className="flex items-end justify-between gap-3 border-b border-[var(--mint-line)] px-5 py-4">
              <div>
                <h2 className="font-display text-xl">
                  Cash
                  {cashTotal ? (
                    <span className="ml-3 text-[var(--mint-ink)]">
                      {formatPlainMoney(cashTotal.amount, cashTotal.currency)}
                    </span>
                  ) : null}
                </h2>
                <p className="mt-1 text-sm text-[var(--mint-muted)]">
                  Tap an account to see its activity.
                </p>
              </div>
            </div>
            {cashRows.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[var(--mint-muted)]">No checking or savings accounts match.</p>
            ) : (
              <ul>
                {cashRows.map((account) => (
                  <li key={account.key} className="border-b border-[var(--mint-line)] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onOpenAccount(account.itemId, account.accountId as string)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left hover:bg-[var(--mint-mist)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {account.name}
                          {account.mask ? <span className="text-[var(--mint-muted)]"> ····{account.mask}</span> : null}
                        </p>
                        <p className="truncate text-xs text-[var(--mint-muted)]">{account.institution}</p>
                      </div>
                      <BalanceDetails account={account} group={account.group} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-[var(--mint-line)] bg-white">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--mint-line)] px-5 py-4">
              <div>
                <h2 className="font-display text-xl">
                  Credit cards
                  {creditTotal ? (
                    <span className="ml-3">
                      {formatPlainMoney(creditTotal.amount, creditTotal.currency)} owed
                    </span>
                  ) : null}
                </h2>
                <p className="mt-1 text-sm text-[var(--mint-muted)]">{creditRows.length} cards</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--mint-muted)]">
                Sort
                <select
                  value={creditSort}
                  onChange={(event) => setCreditSort(event.target.value === "owed" ? "owed" : "due")}
                  className="h-10 rounded-lg border border-[var(--mint-line)] bg-white px-2.5 text-sm text-[var(--mint-ink)]"
                >
                  <option value="due">Due date</option>
                  <option value="owed">Amount owed</option>
                </select>
              </label>
            </div>
            {creditRows.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[var(--mint-muted)]">No credit cards match.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--mint-line)] text-left text-xs tracking-[0.12em] text-[var(--mint-muted)] uppercase">
                      <th className="px-5 py-2 font-medium">Card</th>
                      <th className="px-3 py-2 font-medium">Bank</th>
                      <th className="px-3 py-2 font-medium">Due</th>
                      <th className="px-3 py-2 font-medium">Minimum</th>
                      <th className="px-5 py-2 text-right font-medium">Owed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditRows.map((account) => {
                      const due = account.payment?.dueDate ?? null;
                      const soon = due ? daysUntil(due) <= 3 : false;
                      const currency = account.currency || "USD";
                      return (
                        <tr key={account.key} className="border-b border-[var(--mint-line)] last:border-b-0">
                          <td className="px-5 py-3">
                            <button
                              type="button"
                              onClick={() => onOpenAccount(account.itemId, account.accountId as string)}
                              className="text-left font-medium hover:text-[var(--mint-forest)]"
                            >
                              {account.name}
                              {account.mask ? <span className="text-[var(--mint-muted)]"> ····{account.mask}</span> : null}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-[var(--mint-muted)]">{account.institution}</td>
                          <td className={`px-3 py-3 ${soon ? "text-[var(--mint-due)]" : "text-[var(--mint-muted)]"}`}>
                            {due ? formatDueLabel(due) : "—"}
                          </td>
                          <td className="px-3 py-3 tabular-nums text-[var(--mint-muted)]">
                            {typeof account.payment?.minimumAmount === "number"
                              ? formatPlainMoney(account.payment.minimumAmount, currency)
                              : "—"}
                          </td>
                          <td className="px-5 py-3 text-right font-medium tabular-nums">
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

          {OTHER_GROUPS.map((group) => {
            const accounts = visibleRows.filter((row) => row.group === group && row.accountId);
            if (accounts.length === 0) return null;
            const total = groupTotal(accounts);
            return (
              <section key={group} className="overflow-hidden rounded-xl border border-[var(--mint-line)] bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--mint-line)] px-5 py-4">
                  <h2 className="font-display text-xl">{group}</h2>
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
                        className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left hover:bg-[var(--mint-mist)]"
                      >
                        <AccountDetails account={account} group={group} />
                        <BalanceDetails account={account} group={group} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <section className="rounded-2xl border border-[var(--mint-line)] bg-white shadow-sm">
            <h2 className="border-b border-[var(--mint-line)] px-5 py-4 font-display text-xl">
              Linked banks
            </h2>
            <ul>
              {institutions.map((institution) => {
                const label = institutionLabel(institution, institutions);
                const refreshing = refreshingItemId === institution.itemId;
                return (
                  <li
                    key={institution.itemId}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mint-line)] px-5 py-3 last:border-b-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-[var(--mint-muted)]">
                        {institution.balancesAsOf
                          ? `Balances as of ${formatShortDate(institution.balancesAsOf.slice(0, 10))}`
                          : institution.lastSyncedAt
                            ? `Updated ${formatShortDate(institution.lastSyncedAt.slice(0, 10))}`
                            : "Not updated yet"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {institution.liabilitiesStatus !== "ready" &&
                      institution.accounts.some((account) => {
                        const group = accountGroup(account);
                        return group === "Credit" || group === "Loans";
                      }) ? (
                        <PlaidLinkButton
                          compact
                          variant="outline"
                          label="Show due date"
                          updateItemId={institution.itemId}
                          onConnected={() => onPaymentConsent(institution.itemId)}
                          onError={onError}
                        />
                      ) : null}
                      <Button
                        variant="ghost"
                        className="h-9 gap-2"
                        disabled={refreshingAll || refreshingItemId !== null}
                        onClick={() => onRefreshInstitution(institution.itemId)}
                      >
                        {refreshing ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                        Update
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-9 gap-2 text-[var(--mint-muted)]"
                        onClick={() => onDisconnect(institution.itemId)}
                      >
                        <Unplug className="size-4" />
                        Disconnect
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function groupTotal(accounts: AccountRow[]) {
  const withBalance = accounts.filter(
    (account) => account.accountId && typeof account.currentBalance === "number",
  );
  if (withBalance.length !== accounts.filter((account) => account.accountId).length) {
    return null;
  }
  const currencies = new Set(withBalance.map((account) => account.currency || "USD"));
  if (currencies.size !== 1) return null;
  return {
    amount: withBalance.reduce((sum, account) => sum + (account.currentBalance ?? 0), 0),
    currency: [...currencies][0],
  };
}

function AccountDetails({ account, group }: { account: AccountRow; group: AccountGroup }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium">{account.name}</p>
      <p className="truncate text-xs text-[var(--mint-muted)]">
        {account.institution}
        {account.subtype ? ` · ${account.subtype}` : ""}
        {account.mask ? ` ····${account.mask}` : ""}
      </p>
      <PaymentDetails account={account} group={group} />
    </div>
  );
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
      {payment?.overdue ? <p className="font-medium text-red-700">Payment overdue</p> : null}
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
      {typeof account.availableBalance === "number" ? (
        <p className="text-xs tabular-nums text-[var(--mint-muted)]">
          Available {formatPlainMoney(account.availableBalance, currency)}
        </p>
      ) : null}
      {typeof account.limit === "number" ? (
        <p className="text-xs tabular-nums text-[var(--mint-muted)]">
          Limit {formatPlainMoney(account.limit, currency)}
        </p>
      ) : null}
    </div>
  );
}
