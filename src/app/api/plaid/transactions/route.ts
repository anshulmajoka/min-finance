import { NextResponse } from "next/server";
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid";
import {
  getPlaidSession,
  setPlaidCursor,
} from "@/lib/session";
import type { Transaction, RemovedTransaction } from "plaid";
import type { DisplayTransaction } from "@/lib/types";

export async function GET() {
  if (!isPlaidConfigured()) {
    return NextResponse.json(
      { error: "Plaid is not configured." },
      { status: 503 },
    );
  }

  const session = await getPlaidSession();
  if (!session.accessToken) {
    return NextResponse.json(
      { error: "No bank account connected. Link an account first." },
      { status: 401 },
    );
  }

  try {
    const client = getPlaidClient();

    const accountsResponse = await client.accountsGet({
      access_token: session.accessToken,
    });
    const accountMap = new Map(
      accountsResponse.data.accounts.map((account) => [
        account.account_id,
        account.name || account.official_name || "Account",
      ]),
    );

    const added: Transaction[] = [];
    const modified: Transaction[] = [];
    const removed: RemovedTransaction[] = [];
    let cursor = session.cursor ?? undefined;
    let hasMore = true;

    while (hasMore) {
      const sync = await client.transactionsSync({
        access_token: session.accessToken,
        cursor,
      });
      added.push(...sync.data.added);
      modified.push(...sync.data.modified);
      removed.push(...sync.data.removed);
      hasMore = sync.data.has_more;
      cursor = sync.data.next_cursor;
    }

    if (cursor) {
      await setPlaidCursor(cursor);
    }

    // For a fresh connect, added holds the history. Rebuild a simple view
    // from added + modified, dropping removed ids.
    const byId = new Map<string, Transaction>();
    for (const tx of [...added, ...modified]) {
      byId.set(tx.transaction_id, tx);
    }
    for (const tx of removed) {
      byId.delete(tx.transaction_id);
    }

    // If sync returned nothing (already-synced item), do a one-shot full pull
    // via transactionsGet for a usable demo list.
    let source = Array.from(byId.values());
    if (source.length === 0) {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 90);
      const format = (d: Date) => d.toISOString().slice(0, 10);
      const getResponse = await client.transactionsGet({
        access_token: session.accessToken,
        start_date: format(start),
        end_date: format(end),
        options: { count: 100, offset: 0 },
      });
      source = getResponse.data.transactions;
    }

    const transactions: DisplayTransaction[] = source
      .map((tx) => ({
        id: tx.transaction_id,
        date: tx.date,
        name: tx.name,
        merchant: tx.merchant_name ?? null,
        amount: tx.amount,
        currency: tx.iso_currency_code || tx.unofficial_currency_code || "USD",
        accountId: tx.account_id,
        accountName: accountMap.get(tx.account_id) || "Account",
        pending: tx.pending,
      }))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    return NextResponse.json({
      institutionName: session.institutionName,
      accounts: accountsResponse.data.accounts.map((account) => ({
        id: account.account_id,
        name: account.name || account.official_name || "Account",
        mask: account.mask,
        type: account.type,
        subtype: account.subtype,
      })),
      transactions,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch transactions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
