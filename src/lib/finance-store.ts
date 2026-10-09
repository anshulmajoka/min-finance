import type { AnyBulkWriteOperation } from "mongodb";
import { getDb } from "@/lib/mongo";
import type { DisplayTransaction, InstitutionSummary } from "@/lib/types";

export type StoredAccount = {
  id: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
};

export type StoredItem = {
  userId: string;
  itemId: string;
  accessToken: string;
  institutionId: string | null;
  institutionName: string | null;
  cursor: string | null;
  accounts: StoredAccount[];
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt: Date | null;
};

export type StoredTransaction = {
  userId: string;
  itemId: string;
  institutionId: string | null;
  institutionName: string | null;
  transactionId: string;
  date: string;
  name: string;
  merchant: string | null;
  amount: number;
  currency: string;
  accountId: string;
  accountName: string;
  pending: boolean;
  updatedAt: Date;
};

type ItemDocument = StoredItem & { _id?: unknown };

const TRANSACTION_LIMIT = 500;

function toSummary(item: StoredItem): InstitutionSummary {
  return {
    itemId: item.itemId,
    institutionId: item.institutionId,
    institutionName: item.institutionName,
    lastSyncedAt: item.lastSyncedAt?.toISOString() ?? null,
  };
}

function toDisplay(tx: StoredTransaction): DisplayTransaction {
  return {
    id: tx.transactionId,
    date: tx.date,
    name: tx.name,
    merchant: tx.merchant,
    amount: tx.amount,
    currency: tx.currency,
    accountId: tx.accountId,
    accountName: tx.accountName,
    pending: tx.pending,
    itemId: tx.itemId,
    institutionName: tx.institutionName,
  };
}

export async function listItems(userId: string) {
  const db = await getDb();
  const items = await db
    .collection<ItemDocument>("items")
    .find({ userId })
    .sort({ createdAt: 1 })
    .toArray();

  return items.map((item) => {
    const { _id: _ignored, ...stored } = item;
    return stored;
  });
}

export async function listInstitutionSummaries(userId: string) {
  const items = await listItems(userId);
  return items.map(toSummary);
}

export async function saveLinkedItem(input: {
  userId: string;
  itemId: string;
  accessToken: string;
  institutionId: string | null;
  institutionName: string | null;
}) {
  const db = await getDb();
  const now = new Date();
  await db.collection<StoredItem>("items").updateOne(
    { userId: input.userId, itemId: input.itemId },
    {
      $set: {
        accessToken: input.accessToken,
        institutionId: input.institutionId,
        institutionName: input.institutionName,
        updatedAt: now,
      },
      $setOnInsert: {
        userId: input.userId,
        itemId: input.itemId,
        cursor: null,
        accounts: [],
        createdAt: now,
        lastSyncedAt: null,
      },
    },
    { upsert: true },
  );
}

export async function importLegacyItem(input: {
  userId: string;
  itemId: string;
  accessToken: string;
  institutionName: string | null;
}) {
  await saveLinkedItem({
    userId: input.userId,
    itemId: input.itemId,
    accessToken: input.accessToken,
    institutionId: null,
    institutionName: input.institutionName,
  });
}

export async function updateItemSyncState(
  userId: string,
  itemId: string,
  update: {
    cursor: string | null;
    accounts?: StoredAccount[];
    institutionName?: string | null;
    markSynced?: boolean;
  },
) {
  const db = await getDb();
  const set: Record<string, unknown> = {
    cursor: update.cursor,
    updatedAt: new Date(),
  };
  if (update.accounts) set.accounts = update.accounts;
  if (update.institutionName !== undefined) {
    set.institutionName = update.institutionName;
  }
  if (update.markSynced) set.lastSyncedAt = new Date();

  await db.collection<StoredItem>("items").updateOne(
    { userId, itemId },
    { $set: set },
  );
}

export async function upsertTransactions(
  transactions: StoredTransaction[],
) {
  if (transactions.length === 0) return;
  const db = await getDb();
  const operations: AnyBulkWriteOperation<StoredTransaction>[] =
    transactions.map((tx) => ({
      updateOne: {
        filter: { userId: tx.userId, transactionId: tx.transactionId },
        update: { $set: tx },
        upsert: true,
      },
    }));

  await db
    .collection<StoredTransaction>("transactions")
    .bulkWrite(operations, { ordered: false });
}

export async function deleteTransactions(
  userId: string,
  transactionIds: string[],
) {
  if (transactionIds.length === 0) return;
  const db = await getDb();
  await db.collection<StoredTransaction>("transactions").deleteMany({
    userId,
    transactionId: { $in: transactionIds },
  });
}

export async function listTransactions(userId: string, itemId?: string | null) {
  const db = await getDb();
  const filter: { userId: string; itemId?: string } = { userId };
  if (itemId) filter.itemId = itemId;

  const docs = await db
    .collection<StoredTransaction>("transactions")
    .find(filter)
    .sort({ date: -1, transactionId: -1 })
    .limit(TRANSACTION_LIMIT)
    .toArray();

  return docs.map(toDisplay);
}

export async function deleteItem(userId: string, itemId: string) {
  const db = await getDb();
  const item = await db.collection<StoredItem>("items").findOne({
    userId,
    itemId,
  });
  if (!item) return null;

  await db.collection<StoredTransaction>("transactions").deleteMany({
    userId,
    itemId,
  });
  await db.collection<StoredItem>("items").deleteOne({ userId, itemId });
  return item.accessToken;
}

export async function deleteAllItems(userId: string) {
  const db = await getDb();
  const items = await db
    .collection<StoredItem>("items")
    .find({ userId })
    .toArray();

  await db.collection<StoredTransaction>("transactions").deleteMany({ userId });
  await db.collection<StoredItem>("items").deleteMany({ userId });
  return items.map((item) => item.accessToken);
}
