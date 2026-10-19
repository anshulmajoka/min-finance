---
name: plaid-transaction-sync
description: Implement Plaid's /transactions/sync endpoint for cursor-based transaction pagination. Covers added/modified/removed handling, cursor persistence, deduplication, and the has_more loop. Use when the user needs to fetch or sync transactions.
standards-version: 1.10.0
---

# Plaid Transaction Sync

## Trigger

Use this skill when the user:

- Needs to fetch transactions from Plaid
- Is implementing `/transactions/sync` (the recommended approach)
- Needs to handle added, modified, and removed transactions
- Wants to understand cursor-based pagination
- Has stale transaction data and needs to refresh
- Is migrating from the legacy `/transactions/get` endpoint

## Required Inputs

- **Access token**: A valid Plaid access token for an item with the `transactions` product
- **Storage mechanism**: Where cursors and transactions are persisted (database, file, etc.)

## Workflow

1. **Understand the sync model.** `/transactions/sync` returns incremental updates since your last cursor. Each response contains:
   - `added` - new transactions
   - `modified` - updated transactions (amount, category, name changes)
   - `removed` - deleted transactions (by `transaction_id`)
   - `next_cursor` - bookmark for the next call
   - `has_more` - whether more pages remain

2. **Implement the sync loop.** Always loop until `has_more` is false:

   ```typescript
   import { PlaidApi } from "plaid";

   async function syncTransactions(
     client: PlaidApi,
     accessToken: string,
     cursor: string | undefined
   ) {
     const allAdded: Transaction[] = [];
     const allModified: Transaction[] = [];
     const allRemoved: RemovedTransaction[] = [];

     let hasMore = true;
     let nextCursor = cursor ?? "";

     while (hasMore) {
       const response = await client.transactionsSync({
         access_token: accessToken,
         cursor: nextCursor,
         count: 500, // max per page
       });

       allAdded.push(...response.data.added);
       allModified.push(...response.data.modified);
       allRemoved.push(...response.data.removed);

       hasMore = response.data.has_more;
       nextCursor = response.data.next_cursor;
     }

     return { added: allAdded, modified: allModified, removed: allRemoved, cursor: nextCursor };
   }
   ```

3. **Persist the cursor.** After processing all pages, save `next_cursor` to your database. On the next sync call, pass it back. If the cursor is lost, pass an empty string to get a full history replay.

   ```typescript
   // Save after successful processing
   await db.items.update({
     where: { item_id: itemId },
     data: { transaction_cursor: nextCursor },
   });
   ```

4. **Apply changes to your local store:**

   ```typescript
   // INSERT new transactions
   for (const txn of added) {
     await db.transactions.upsert({
       where: { plaid_transaction_id: txn.transaction_id },
       create: {
         plaid_transaction_id: txn.transaction_id,
         amount: txn.amount,
         date: txn.date,
         name: txn.name,
         merchant_name: txn.merchant_name,
         category: txn.personal_finance_category?.primary,
         detailed_category: txn.personal_finance_category?.detailed,
         pending: txn.pending,
       },
       update: { /* same fields for modified */ },
     });
   }

   // DELETE removed transactions
   for (const removed of allRemoved) {
     await db.transactions.delete({
       where: { plaid_transaction_id: removed.transaction_id },
     });
   }
   ```

5. **Handle pending transactions.** Plaid sends pending transactions that later resolve to posted. The posted version has a different `transaction_id`. Use `pending_transaction_id` on the posted transaction to link them:

   ```typescript
   if (txn.pending_transaction_id) {
     await db.transactions.delete({
       where: { plaid_transaction_id: txn.pending_transaction_id },
     });
   }
   ```

6. **Trigger syncs via webhooks.** Don't poll on a timer. Listen for `SYNC_UPDATES_AVAILABLE` webhooks:

   ```typescript
   // In your webhook handler
   if (webhookCode === "SYNC_UPDATES_AVAILABLE") {
     const item = await db.items.findUnique({ where: { item_id: itemId } });
     await syncTransactions(client, item.access_token, item.transaction_cursor);
   }
   ```

## Key References

- [/transactions/sync docs](https://plaid.com/docs/api/products/transactions/#transactionssync)
- [Transactions sync tutorial](https://plaid.com/docs/transactions/sync/)
- [Migration from /transactions/get](https://plaid.com/docs/transactions/sync/#migrating-from-transactionsget)
- [Webhook: SYNC_UPDATES_AVAILABLE](https://plaid.com/docs/api/products/transactions/#sync_updates_available)

## Example Interaction

**User:** "I need to sync bank transactions from Plaid into my Postgres database. I'm using Node.js and Prisma."

**Agent:**
1. Shows the sync loop implementation with `has_more` pagination
2. Creates a Prisma schema for transactions with `plaid_transaction_id` as unique key
3. Implements upsert logic for added/modified and delete for removed
4. Handles pending-to-posted transitions via `pending_transaction_id`
5. Sets up a webhook handler for `SYNC_UPDATES_AVAILABLE`
6. Stores the cursor in the items table
7. Notes: "Run an initial sync after connecting the item to backfill historical transactions (up to 2 years)"

## MCP Usage

| Step | MCP Tool | Description |
|------|----------|-------------|
| Run a sync | `plaid_syncTransactions` | Execute /transactions/sync with automatic cursor management |
| Force refresh | `plaid_refreshTransactions` | Trigger a transaction refresh for stale data |
| Fire test webhook | `plaid_fireSandboxWebhook` | Fire SYNC_UPDATES_AVAILABLE to test your handler |

## Common Pitfalls

1. **Not looping on `has_more`** - a single call may not return all updates. Always loop until `has_more` is false. Failing to do so causes silent data loss.
2. **Losing the cursor** - if you don't persist the cursor after processing, the next sync replays the entire history. This wastes API calls and can cause duplicate records.
3. **Ignoring `modified` transactions** - Plaid can retroactively change transaction amounts, names, and categories. If you only handle `added`, your data drifts from reality.
4. **Ignoring `removed` transactions** - banks reverse or delete transactions. If you don't process removals, your balances won't match.
5. **Polling instead of using webhooks** - calling sync on a timer wastes API quota. Use `SYNC_UPDATES_AVAILABLE` webhooks to trigger syncs.
6. **Not handling pending transitions** - a pending transaction and its posted counterpart are separate objects. Use `pending_transaction_id` to deduplicate.

## See Also

- [Plaid Webhook Handling](../plaid-webhook-handling/SKILL.md) - set up webhook handlers for sync triggers
- [Plaid Category Mapping](../plaid-category-mapping/SKILL.md) - map transaction categories to your app's taxonomy
- [Plaid Recurring Detection](../plaid-recurring-detection/SKILL.md) - identify recurring transactions
