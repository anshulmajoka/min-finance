import type {
  AccountBase,
  CreditCardLiability,
  LiabilitiesObject,
  LineOfCreditLiability,
  LoanLiability,
  MortgageLiability,
  RemovedTransaction,
  StudentLoan,
  Transaction,
} from "plaid";
import type { AccountPayment, LiabilitiesStatus } from "@/lib/types";
import {
  deleteTransactions,
  itemHasSavedTransactions,
  listItems,
  updateItemSyncState,
  upsertTransactions,
  type StoredAccount,
  type StoredItem,
  type StoredTransaction,
} from "@/lib/finance-store";
import { getPlaidClient, plaidErrorCode, plaidErrorMessage } from "@/lib/plaid";

export type SyncStats = {
  itemId: string;
  institutionName: string | null;
  added: number;
  modified: number;
  removed: number;
};

const globalForSync = globalThis as unknown as {
  mintPlaidSyncLocks?: Map<string, Promise<unknown>>;
};
const locks = globalForSync.mintPlaidSyncLocks ?? new Map<string, Promise<unknown>>();
globalForSync.mintPlaidSyncLocks = locks;

const MUTATION_ERROR = "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION";
const MAX_MUTATION_RETRIES = 5;

function withItemLock<T>(itemId: string, task: () => Promise<T>) {
  const previous = locks.get(itemId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(task);
  locks.set(
    itemId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapAccount(account: AccountBase): StoredAccount {
  return {
    id: account.account_id,
    name: account.name || account.official_name || "Account",
    mask: account.mask,
    type: String(account.type),
    subtype: account.subtype ? String(account.subtype) : null,
    currentBalance: account.balances.current,
    availableBalance: account.balances.available,
    limit: account.balances.limit,
    currency:
      account.balances.iso_currency_code ||
      account.balances.unofficial_currency_code ||
      "USD",
  };
}

function blankPayment(): AccountPayment {
  return {
    dueDate: null,
    minimumAmount: null,
    statementBalance: null,
    statementDate: null,
    lastPaymentAmount: null,
    lastPaymentDate: null,
    overdue: null,
    purchaseApr: null,
  };
}

function paymentOrNull(payment: AccountPayment) {
  const present = Object.values(payment).some((value) => value !== null);
  return present ? payment : null;
}

function creditPayment(card: CreditCardLiability) {
  const purchase = card.aprs.find((apr) => apr.apr_type === "purchase_apr");
  return paymentOrNull({
    dueDate: card.next_payment_due_date,
    minimumAmount: card.minimum_payment_amount,
    statementBalance: card.last_statement_balance,
    statementDate: card.last_statement_issue_date,
    lastPaymentAmount: card.last_payment_amount,
    lastPaymentDate: card.last_payment_date,
    overdue: card.is_overdue,
    purchaseApr: purchase?.apr_percentage ?? null,
  });
}

function studentPayment(loan: StudentLoan) {
  return paymentOrNull({
    ...blankPayment(),
    dueDate: loan.next_payment_due_date,
    minimumAmount: loan.minimum_payment_amount,
    statementBalance: loan.last_statement_balance ?? null,
    statementDate: loan.last_statement_issue_date,
    lastPaymentAmount: loan.last_payment_amount,
    lastPaymentDate: loan.last_payment_date,
  });
}

function closedEndLoanPayment(loan: LoanLiability) {
  return paymentOrNull({
    ...blankPayment(),
    dueDate: loan.next_payment_due_date,
    minimumAmount: loan.next_payment_amount,
    lastPaymentAmount: loan.last_payment_amount,
    lastPaymentDate: loan.last_payment_date,
  });
}

function lineOfCreditPayment(loan: LineOfCreditLiability) {
  return paymentOrNull({
    ...blankPayment(),
    dueDate: loan.next_payment_due_date,
    minimumAmount: loan.next_payment_amount ?? loan.minimum_payment_amount,
    statementBalance: loan.last_statement_balance,
    statementDate: loan.last_statement_issue_date,
    lastPaymentAmount: loan.last_payment_amount,
    lastPaymentDate: loan.last_payment_date,
    overdue: typeof loan.past_due_amount === "number" ? loan.past_due_amount > 0 : null,
  });
}

function mortgagePayment(loan: MortgageLiability) {
  return paymentOrNull({
    ...blankPayment(),
    dueDate: loan.next_payment_due_date,
    minimumAmount: loan.next_monthly_payment,
    overdue: typeof loan.past_due_amount === "number" ? loan.past_due_amount > 0 : null,
  });
}

function paymentsByAccount(liabilities: LiabilitiesObject) {
  const payments = new Map<string, AccountPayment>();
  const remember = (accountId: string | null, payment: AccountPayment | null) => {
    if (accountId && payment) payments.set(accountId, payment);
  };
  for (const card of liabilities.credit ?? []) remember(card.account_id, creditPayment(card));
  for (const loan of liabilities.student ?? []) remember(loan.account_id, studentPayment(loan));
  for (const loan of liabilities.loan ?? []) remember(loan.account_id, closedEndLoanPayment(loan));
  for (const loan of liabilities.line_of_credit ?? []) {
    remember(loan.account_id, lineOfCreditPayment(loan));
  }
  for (const loan of liabilities.mortgage ?? []) {
    remember(loan.account_id, mortgagePayment(loan));
  }
  return payments;
}

async function fetchAccounts(accessToken: string) {
  const client = getPlaidClient();
  const accountsResponse = await client.accountsGet({
    access_token: accessToken,
  });
  const accounts = accountsResponse.data.accounts.map(mapAccount);
  let liabilitiesStatus: LiabilitiesStatus = "unavailable";
  try {
    const liabilities = await client.liabilitiesGet({ access_token: accessToken });
    const payments = paymentsByAccount(liabilities.data.liabilities);
    liabilitiesStatus = "ready";
    return {
      accounts: accounts.map((account) => ({
        ...account,
        payment: payments.get(account.id) ?? null,
      })),
      liabilitiesStatus,
    };
  } catch {
    return {
      accounts: accounts.map((account) => ({ ...account, payment: null })),
      liabilitiesStatus,
    };
  }
}

function mapTransaction(
  item: StoredItem,
  tx: Transaction,
  accountNames: Map<string, string>,
): StoredTransaction {
  return {
    userId: item.userId,
    itemId: item.itemId,
    institutionId: item.institutionId,
    institutionName: item.institutionName,
    transactionId: tx.transaction_id,
    date: tx.date,
    name: tx.name,
    merchant: tx.merchant_name ?? null,
    amount: tx.amount,
    currency: tx.iso_currency_code || tx.unofficial_currency_code || "USD",
    accountId: tx.account_id,
    accountName: accountNames.get(tx.account_id) || "Account",
    pending: tx.pending,
    updatedAt: new Date(),
  };
}

async function applyPage(
  item: StoredItem,
  accountNames: Map<string, string>,
  added: Transaction[],
  modified: Transaction[],
  removed: RemovedTransaction[],
) {
  const upserts = [...added, ...modified].map((tx) =>
    mapTransaction(item, tx, accountNames),
  );
  await upsertTransactions(upserts);
  await deleteTransactions(
    item.itemId,
    removed.map((tx) => tx.transaction_id),
  );
}

async function backfillWithTransactionsGet(
  item: StoredItem,
  accountNames: Map<string, string>,
) {
  const client = getPlaidClient();
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 90);
  const format = (date: Date) => date.toISOString().slice(0, 10);

  const collected: Transaction[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total && collected.length < 500) {
    const response = await client.transactionsGet({
      access_token: item.accessToken,
      start_date: format(start),
      end_date: format(end),
      options: { count: 100, offset },
    });
    collected.push(...response.data.transactions);
    total = response.data.total_transactions;
    offset += response.data.transactions.length;
    if (response.data.transactions.length === 0) break;
  }

  await upsertTransactions(
    collected.map((tx) => mapTransaction(item, tx, accountNames)),
  );
  return collected.length;
}

async function syncItemUnlocked(item: StoredItem): Promise<SyncStats> {
  const client = getPlaidClient();
  const { accounts, liabilitiesStatus } = await fetchAccounts(item.accessToken);
  const accountNames = new Map(
    accounts.map((account) => [account.id, account.name]),
  );

  const [stored] = (await listItems(item.userId)).filter(
    (candidate) => candidate.itemId === item.itemId,
  );
  const savedCursor = stored?.cursor ?? item.cursor;
  let cursor = savedCursor;
  const startedWithoutCursor = !savedCursor;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let sawSyncActivity = false;

  for (let attempt = 0; attempt < MAX_MUTATION_RETRIES; attempt += 1) {
    added = 0;
    modified = 0;
    removed = 0;
    sawSyncActivity = false;
    try {
      let hasMore = true;
      while (hasMore) {
        const sync = await client.transactionsSync({
          access_token: item.accessToken,
          cursor: cursor ?? undefined,
          count: 500,
        });
        await applyPage(
          item,
          accountNames,
          sync.data.added,
          sync.data.modified,
          sync.data.removed,
        );
        added += sync.data.added.length;
        modified += sync.data.modified.length;
        removed += sync.data.removed.length;
        if (
          sync.data.added.length > 0 ||
          sync.data.modified.length > 0 ||
          sync.data.removed.length > 0
        ) {
          sawSyncActivity = true;
        }
        cursor = sync.data.next_cursor;
        hasMore = sync.data.has_more;
      }
      break;
    } catch (error) {
      const retry =
        attempt < MAX_MUTATION_RETRIES - 1 &&
        plaidErrorCode(error) === MUTATION_ERROR;
      if (!retry) throw error;
      // This cursor is from a pagination that did not finish. Plaid will keep
      // rejecting it, so the next attempt starts from the last completed update.
      cursor = null;
      await delay(300 * (attempt + 1));
    }
  }

  if (startedWithoutCursor && !sawSyncActivity) {
    try {
      added += await backfillWithTransactionsGet(item, accountNames);
    } catch (error) {
      await updateItemSyncState(item.userId, item.itemId, {
        cursor: null,
        accounts,
        liabilitiesStatus,
      });
      throw error;
    }
  }

  await updateItemSyncState(item.userId, item.itemId, {
    cursor,
    accounts,
    liabilitiesStatus,
    markSynced: true,
  });

  return {
    itemId: item.itemId,
    institutionName: item.institutionName,
    added,
    modified,
    removed,
  };
}

export function syncItem(item: StoredItem) {
  return withItemLock(item.itemId, () => syncItemUnlocked(item));
}

export async function refreshBalances(userId: string, itemId?: string | null) {
  const items = await listItems(userId);
  const selected = itemId ? items.filter((item) => item.itemId === itemId) : items;
  const errors: { itemId: string; institutionName: string | null; message: string }[] =
    [];

  for (const item of selected) {
    try {
      await withItemLock(item.itemId, async () => {
        const { accounts, liabilitiesStatus } = await fetchAccounts(item.accessToken);
        const [fresh] = (await listItems(userId)).filter(
          (candidate) => candidate.itemId === item.itemId,
        );
        await updateItemSyncState(userId, item.itemId, {
          cursor: fresh?.cursor ?? item.cursor,
          accounts,
          liabilitiesStatus,
        });
      });
    } catch (error) {
      errors.push({
        itemId: item.itemId,
        institutionName: item.institutionName,
        message: plaidErrorMessage(error, "Failed to refresh balances."),
      });
    }
  }

  return errors;
}

export async function syncItems(
  userId: string,
  mode: "missing" | "incremental",
  itemId?: string | null,
) {
  const items = await listItems(userId);
  const selected = itemId
    ? items.filter((item) => item.itemId === itemId)
    : items;
  const targets: StoredItem[] = [];
  for (const item of selected) {
    if (mode === "incremental") {
      targets.push(item);
      continue;
    }
    if (
      item.lastSyncedAt &&
      (await itemHasSavedTransactions(item.itemId))
    ) {
      continue;
    }
    targets.push(item);
  }

  const synced: SyncStats[] = [];
  const errors: { itemId: string; institutionName: string | null; message: string }[] =
    [];

  for (const item of targets) {
    try {
      synced.push(await syncItem(item));
    } catch (error) {
      errors.push({
        itemId: item.itemId,
        institutionName: item.institutionName,
        message: plaidErrorMessage(error, "Failed to sync transactions."),
      });
    }
  }

  const totals = synced.reduce(
    (sum, stats) => ({
      added: sum.added + stats.added,
      modified: sum.modified + stats.modified,
      removed: sum.removed + stats.removed,
    }),
    { added: 0, modified: 0, removed: 0 },
  );

  return { synced, errors, totals, attempted: targets.length > 0 };
}
