import { TransactionList } from "@/components/transaction-list";
import { institutionLabel } from "@/lib/institution-label";
import type { DisplayTransaction, InstitutionSummary } from "@/lib/types";
import { Loader2, X } from "lucide-react";

type TransactionsViewProps = {
  transactions: DisplayTransaction[];
  institutions: InstitutionSummary[];
  institutionFilter: string;
  accountFilter: string | null;
  onInstitutionFilter: (itemId: string) => void;
  onClearAccount: () => void;
  loading: boolean;
  ready: boolean;
};

export function TransactionsView({
  transactions,
  institutions,
  institutionFilter,
  accountFilter,
  onInstitutionFilter,
  onClearAccount,
  loading,
  ready,
}: TransactionsViewProps) {
  const showingAll = institutionFilter === "all";
  const selected =
    institutions.find((item) => item.itemId === institutionFilter) ?? null;
  const selectedAccount = accountFilter
    ? institutions.flatMap((institution) =>
        institution.accounts.map((account) => ({
          key: `${institution.itemId}:${account.id}`,
          name: account.name,
          institution: institutionLabel(institution, institutions),
        })),
      ).find((account) => account.key === accountFilter) ?? null
    : null;
  const visible = transactions.filter((tx) => {
    if (!showingAll && tx.itemId !== institutionFilter) return false;
    if (accountFilter && `${tx.itemId}:${tx.accountId}` !== accountFilter) return false;
    return true;
  });
  const missing = institutions.filter(
    (institution) => !transactions.some((tx) => tx.itemId === institution.itemId),
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-[var(--mint-muted)]">
          {selectedAccount
            ? `Showing ${selectedAccount.name} at ${selectedAccount.institution}`
            : selected
              ? `Showing ${institutionLabel(selected, institutions)}`
              : institutions.length > 1
                ? `All ${institutions.length} banks`
                : institutions[0]
                  ? `From ${institutionLabel(institutions[0], institutions)}`
                  : "Connect a bank to see activity."}
        </p>
        {ready ? (
          <p className="text-sm text-[var(--mint-muted)]">
            {visible.length} {visible.length === 1 ? "transaction" : "transactions"}
          </p>
        ) : null}
      </div>

      {selectedAccount ? (
        <div className="mb-4">
          <button
            type="button"
            onClick={onClearAccount}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mint-forest)] bg-[var(--mint-forest)] px-3 py-1.5 text-sm text-white"
          >
            {selectedAccount.name}
            <X className="size-3.5" />
            <span className="sr-only">Clear account filter</span>
          </button>
        </div>
      ) : null}

      {institutions.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by bank">
          <FilterChip
            pressed={showingAll}
            onClick={() => onInstitutionFilter("all")}
            label="All banks"
          />
          {institutions.map((institution) => {
            const label = institutionLabel(institution, institutions);
            const selectedChip = institution.itemId === institutionFilter;
            const count = transactions.filter((tx) => tx.itemId === institution.itemId).length;
            return (
              <FilterChip
                key={institution.itemId}
                pressed={selectedChip}
                onClick={() => onInstitutionFilter(institution.itemId)}
                label={`${label} · ${count}`}
              />
            );
          })}
        </div>
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
                <p key={institution.itemId} className="mb-4 text-sm text-[var(--mint-muted)]">
                  {label} is linked{accounts ? ` (${accounts})` : ""}, but there is no activity
                  saved yet. Use Update to check again.
                </p>
              );
            })
        : null}

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-[var(--mint-line)] bg-white px-6 py-16 text-[var(--mint-muted)]">
          <Loader2 className="size-5 animate-spin text-[var(--mint-forest)]" />
          Loading your activity…
        </div>
      ) : ready || transactions.length > 0 ? (
        <TransactionList
          transactions={visible}
          showInstitution={showingAll && institutions.length > 1}
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

function FilterChip({
  pressed,
  onClick,
  label,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm ${
        pressed
          ? "border-[var(--mint-forest)] bg-[var(--mint-forest)] text-white"
          : "border-[var(--mint-line)] bg-white text-[var(--mint-ink)]"
      }`}
    >
      {label}
    </button>
  );
}
