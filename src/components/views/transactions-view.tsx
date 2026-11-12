"use client";

import { useEffect, useState } from "react";
import { TransactionList } from "@/components/transaction-list";
import type { RuleDraft } from "@/components/rule-form";
import { institutionLabel } from "@/lib/institution-label";
import type { Category, DisplayTransaction, InstitutionSummary } from "@/lib/types";
import { Loader2 } from "lucide-react";

type TransactionsViewProps = {
  transactions: DisplayTransaction[];
  institutions: InstitutionSummary[];
  institutionFilter: string;
  accountFilter: string | null;
  onInstitutionFilter: (itemId: string) => void;
  onAccountFilter: (key: string | null) => void;
  onClearAccount: () => void;
  loading: boolean;
  ready: boolean;
  onLabeled: () => void;
  onSaveAsRule: (draft: RuleDraft) => void;
};

type DirectionFilter = "all" | "expenses" | "income";

const fieldClass =
  "h-10 rounded-lg border border-[var(--mint-line)] bg-white px-2.5 text-sm text-[var(--mint-ink)] outline-none focus-visible:border-[var(--mint-leaf)] focus-visible:ring-3 focus-visible:ring-[var(--mint-leaf)]/30";

function chipClass(active: boolean) {
  return `shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide shadow-sm transition-colors ${
    active
      ? "bg-[var(--mint-forest)] text-white"
      : "bg-white text-[var(--mint-muted)] hover:text-[var(--mint-forest)]"
  }`;
}

export function TransactionsView({
  transactions,
  institutions,
  institutionFilter,
  accountFilter,
  onInstitutionFilter,
  onAccountFilter,
  onClearAccount,
  loading,
  ready,
  onLabeled,
  onSaveAsRule,
}: TransactionsViewProps) {
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const [categories, setCategories] = useState<Category[]>([]);
  const showingAll = institutionFilter === "all";
  const selected = institutions.find((item) => item.itemId === institutionFilter) ?? null;
  const accountOptions = institutions.flatMap((institution) =>
    institution.accounts.map((account) => ({
      key: `${institution.itemId}:${account.id}`,
      name: account.name,
      itemId: institution.itemId,
      institution: institutionLabel(institution, institutions),
    })),
  );
  const selectedAccount = accountFilter
    ? accountOptions.find((account) => account.key === accountFilter) ?? null
    : null;
  const visible = transactions.filter((tx) => {
    if (!showingAll && tx.itemId !== institutionFilter) return false;
    if (accountFilter && `${tx.itemId}:${tx.accountId}` !== accountFilter) return false;
    if (directionFilter === "expenses" && !(tx.amount > 0)) return false;
    if (directionFilter === "income" && !(tx.amount < 0)) return false;
    return true;
  });
  const accountChoices = accountOptions.filter((account) => {
    if (!showingAll && account.itemId !== institutionFilter) return false;
    return true;
  });
  const missing = institutions.filter(
    (institution) => !transactions.some((tx) => tx.itemId === institution.itemId),
  );
  const bankPhrase = selected
    ? institutionLabel(selected, institutions)
    : institutions.length
      ? `all ${institutions.length} ${institutions.length === 1 ? "bank" : "banks"}`
      : "no banks";

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/categories", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { categories?: Category[] };
        if (!cancelled) setCategories(data.categories ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function selectBank(itemId: string) {
    onInstitutionFilter(itemId);
    if (itemId === "all") return;
    if (accountFilter && !accountFilter.startsWith(`${itemId}:`)) {
      onClearAccount();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-5 overflow-x-auto px-5 lg:hidden">
        <div className="flex w-max items-center gap-2 py-0.5">
          <button
            type="button"
            className={chipClass(directionFilter === "all" && showingAll && !accountFilter)}
            onClick={() => {
              setDirectionFilter("all");
              selectBank("all");
              onClearAccount();
            }}
          >
            All
          </button>
          <button
            type="button"
            className={chipClass(directionFilter === "expenses")}
            onClick={() => setDirectionFilter("expenses")}
          >
            Expenses
          </button>
          <button
            type="button"
            className={chipClass(directionFilter === "income")}
            onClick={() => setDirectionFilter("income")}
          >
            Income
          </button>
          <span className="mx-1 h-4 w-px bg-[var(--mint-line)]" aria-hidden />
          <button
            type="button"
            className={`${chipClass(showingAll)} inline-flex items-center gap-1`}
            onClick={() => {
              selectBank("all");
              onClearAccount();
            }}
          >
            <span>All banks</span>
            {institutions.length > 0 ? (
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-[var(--mint-foam)] text-[10px] font-bold text-[var(--mint-muted)]">
                {institutions.length}
              </span>
            ) : null}
          </button>
          {institutions.map((institution) => {
            const label = institutionLabel(institution, institutions);
            return (
              <button
                key={institution.itemId}
                type="button"
                className={chipClass(institutionFilter === institution.itemId)}
                onClick={() => selectBank(institution.itemId)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden flex-col gap-3 lg:flex lg:flex-row lg:items-center">
        <label className="min-w-0 lg:w-48">
          <span className="sr-only">Bank</span>
          <select
            value={institutionFilter}
            onChange={(event) => onInstitutionFilter(event.target.value)}
            className={`${fieldClass} w-full`}
          >
            <option value="all">All banks</option>
            {institutions.map((institution) => (
              <option key={institution.itemId} value={institution.itemId}>
                {institutionLabel(institution, institutions)}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 lg:w-36">
          <span className="sr-only">Direction</span>
          <select
            value={directionFilter}
            onChange={(event) => setDirectionFilter(event.target.value as DirectionFilter)}
            className={`${fieldClass} w-full`}
          >
            <option value="all">All</option>
            <option value="expenses">Expenses</option>
            <option value="income">Income</option>
          </select>
        </label>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Account</span>
          <select
            value={accountFilter ?? ""}
            onChange={(event) => onAccountFilter(event.target.value || null)}
            className={`${fieldClass} w-full`}
          >
            <option value="">All accounts</option>
            {accountChoices.map((account) => (
              <option key={account.key} value={account.key}>
                {account.name} · {account.institution}
              </option>
            ))}
          </select>
        </label>
      </div>

      {ready ? (
        <p className="hidden text-sm text-[var(--mint-muted)] lg:block">
          Showing {bankPhrase} · {visible.length}{" "}
          {visible.length === 1 ? "transaction" : "transactions"}
          {selectedAccount ? ` · ${selectedAccount.name}` : ""}
        </p>
      ) : null}

      {ready
        ? missing
            .filter((institution) => showingAll || institution.itemId === institutionFilter)
            .map((institution) => {
              const accounts = institution.accounts
                .map((account) => account.name)
                .filter(Boolean)
                .join(", ");
              const label = institutionLabel(institution, institutions);
              return (
                <p key={institution.itemId} className="text-sm text-[var(--mint-muted)]">
                  {label} is linked{accounts ? ` (${accounts})` : ""}, but there is no activity
                  saved yet. Use Update to check again.
                </p>
              );
            })
        : null}

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-[var(--mint-line)] bg-white px-6 py-16 text-[var(--mint-muted)]">
          <Loader2 className="size-5 animate-spin text-[var(--mint-forest)]" />
          Loading your activity…
        </div>
      ) : ready || transactions.length > 0 ? (
        <TransactionList
          transactions={visible}
          categories={categories}
          showInstitution={showingAll && institutions.length > 1 && !selectedAccount}
          hideAccountFilter
          onLabeled={onLabeled}
          onSaveAsRule={onSaveAsRule}
          emptyTitle={
            selectedAccount
              ? `No transactions for ${selectedAccount.name}`
              : selected
                ? `No transactions for ${institutionLabel(selected, institutions)}`
                : "No transactions yet"
          }
          emptyBody={
            selectedAccount
              ? "This account is linked, but nothing is saved for it yet. Use Update to check for new activity."
              : selected
                ? "This bank is linked, but nothing is saved for it yet. Use Update to check for new activity."
                : institutions.length === 0
                  ? "Connect a bank on Accounts, then use Update."
                  : "Your banks are linked, but there is no activity yet. Use Update to check for new transactions."
          }
        />
      ) : null}
    </div>
  );
}
