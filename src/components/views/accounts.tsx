import { PlaidLinkButton } from "@/components/plaid-link-button";
import { Button } from "@/components/ui/button";
import { institutionLabel } from "@/lib/institution-label";
import { formatPlainMoney, formatShortDate } from "@/lib/money";
import type {
  AccountPayment,
  InstitutionAccount,
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

const GROUPS = ["Checking", "Savings", "Credit", "Loans", "Investments", "Other"] as const;

type AccountGroup = (typeof GROUPS)[number];

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

function groupFor(account: Pick<InstitutionAccount, "type" | "subtype">): AccountGroup {
  const kind = (account.type ?? "").toLowerCase();
  const subtype = (account.subtype ?? "").toLowerCase();
  if (subtype.includes("check")) return "Checking";
  if (subtype.includes("sav") || subtype.includes("money market") || subtype === "cd") {
    return "Savings";
  }
  if (kind === "credit" || subtype.includes("credit")) return "Credit";
  if (
    kind === "loan" ||
    subtype.includes("loan") ||
    subtype.includes("mortgage") ||
    subtype.includes("student")
  ) {
    return "Loans";
  }
  if (
    kind === "investment" ||
    kind === "brokerage" ||
    subtype.includes("brokerage") ||
    subtype.includes("ira") ||
    subtype.includes("401")
  ) {
    return "Investments";
  }
  return "Other";
}

function owedGroup(group: AccountGroup) {
  return group === "Credit" || group === "Loans";
}

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
      group: groupFor(account),
      institution: label,
      currentBalance: account.currentBalance,
      availableBalance: account.availableBalance,
      limit: account.limit,
      currency: account.currency,
      payment: account.payment,
      liabilitiesStatus: institution.liabilitiesStatus,
    }));
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
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
          <p className="-mt-2 text-sm text-[var(--mint-muted)]">
            Tap an account to see its activity. To remove a bank, use Disconnect below.
          </p>
          <section className="overflow-hidden rounded-2xl border border-[var(--mint-line)] bg-white shadow-sm">
            {GROUPS.map((group) => {
              const accounts = rows.filter((row) => row.group === group);
              if (accounts.length === 0) return null;
              const total = groupTotal(accounts);
              return (
                <div key={group}>
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--mint-line)] bg-[var(--mint-mist)] px-5 py-2">
                    <h2 className="text-xs font-medium tracking-wide text-[var(--mint-muted)] uppercase">
                      {group}
                    </h2>
                    {total ? (
                      <p className="text-xs font-medium tabular-nums text-[var(--mint-ink)]">
                        {formatPlainMoney(total.amount, total.currency)}
                        {owedGroup(group) ? " owed" : ""}
                      </p>
                    ) : null}
                  </div>
                  <ul>
                    {accounts.map((account) => (
                      <li
                        key={account.key}
                        className="border-b border-[var(--mint-line)] last:border-b-0"
                      >
                        {account.accountId ? (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenAccount(account.itemId, account.accountId as string)
                            }
                            className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left hover:bg-[var(--mint-mist)]"
                          >
                            <AccountDetails account={account} group={group} />
                            <BalanceDetails account={account} group={group} />
                          </button>
                        ) : (
                          <div className="flex items-center justify-between gap-4 px-5 py-3">
                            <AccountDetails account={account} group={group} />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>

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
                        const group = groupFor(account);
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
          ? owedGroup(group)
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
