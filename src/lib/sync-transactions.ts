import type { RemovedTransaction, Transaction } from "plaid";
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

const locks = new Map<string, Promise<unknown>>();

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
    item.userId,
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
  const accountsResponse = await client.accountsGet({
    access_token: item.accessToken,
  });
  const accounts: StoredAccount[] = accountsResponse.data.accounts.map(
    (account) => ({
      id: account.account_id,
      name: account.name || account.official_name || "Account",
      mask: account.mask,
      type: account.type,
      subtype: account.subtype,
    }),
  );
  const accountNames = new Map(
    accounts.map((account) => [account.id, account.name]),
  );

  let cursor = item.cursor;
  const startedWithoutCursor = !cursor;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let sawSyncActivity = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      let hasMore = true;
      while (hasMore) {
        const sync = await client.transactionsSync({
          access_token: item.accessToken,
          cursor: cursor ?? undefined,
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
        await updateItemSyncState(item.userId, item.itemId, {
          cursor,
          accounts,
        });
      }
      break;
    } catch (error) {
      const retry =
        attempt === 0 &&
        plaidErrorCode(error) === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION";
      if (!retry) throw error;
      const [fresh] = (await listItems(item.userId)).filter(
        (candidate) => candidate.itemId === item.itemId,
      );
      cursor = fresh?.cursor ?? cursor;
    }
  }

  if (startedWithoutCursor && !sawSyncActivity) {
    try {
      added += await backfillWithTransactionsGet(item, accountNames);
    } catch (error) {
      await updateItemSyncState(item.userId, item.itemId, {
        cursor: null,
        accounts,
      });
      throw error;
    }
  }

  await updateItemSyncState(item.userId, item.itemId, {
    cursor,
    accounts,
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
    if (item.lastSyncedAt) continue;
    if (await itemHasSavedTransactions(item.itemId)) continue;
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
