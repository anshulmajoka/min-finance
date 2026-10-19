---
name: plaid-recurring-detection
description: Detect recurring transactions using the /transactions/recurring endpoint. Covers frequency detection, subscription identification, and recurring stream management.
standards-version: 1.10.0
---

# Plaid Recurring Detection

## Trigger

Use this skill when the user:

- Needs to identify recurring transactions (subscriptions, bills, income)
- Wants to detect subscription payments automatically
- Is building a subscription tracker or bill reminder
- Needs to separate recurring from one-time transactions
- Wants to predict upcoming charges
- Needs to classify income streams (paychecks, deposits)

## Required Inputs

- **Access token**: A Plaid access token with the `transactions` product
- **Account IDs**: Optionally scope to specific accounts (all accounts used if omitted)

## Workflow

1. **Ensure sufficient transaction history.** Recurring detection requires at least 60 days of synced transactions to produce reliable results. New items should wait for a full sync before calling this endpoint.

2. **Fetch recurring streams.** Returns both inflow and outflow recurring transactions:

   ```typescript
   const response = await plaidClient.transactionsRecurringGet({
     access_token: accessToken,
     account_ids: accountIds, // optional - omit for all accounts
   });

   // Outflow streams: subscriptions, bills, loan payments
   for (const stream of response.data.outflow_streams) {
     console.log(
       `${stream.merchant_name ?? stream.description}: ` +
         `$${stream.average_amount.amount} ${stream.frequency} ` +
         `(${stream.status}) - next: ${stream.predicted_next_date}`,
     );
   }

   // Inflow streams: paychecks, regular deposits
   for (const stream of response.data.inflow_streams) {
     console.log(
       `Income: ${stream.description}: ` +
         `$${Math.abs(Number(stream.average_amount.amount))} ${stream.frequency}`,
     );
   }
   ```

3. **Stream properties.** Each recurring stream contains:

   | Field | Description |
   |-------|-------------|
   | `stream_id` | Stable identifier for the stream |
   | `merchant_name` | Detected merchant (may be null) |
   | `description` | Raw transaction description |
   | `average_amount` | Average amount across occurrences |
   | `last_amount` | Most recent transaction amount |
   | `frequency` | `WEEKLY`, `BIWEEKLY`, `SEMI_MONTHLY`, `MONTHLY`, `ANNUALLY`, `UNKNOWN` |
   | `status` | `MATURE`, `EARLY_DETECTION`, `TOMBSTONED`, `UNKNOWN` |
   | `predicted_next_date` | When the next occurrence is expected |
   | `last_date` | Date of the most recent occurrence |
   | `first_date` | Date of the earliest detected occurrence |
   | `transaction_ids` | IDs of transactions in this stream |
   | `category` | Plaid category for the transactions |
   | `is_active` | Whether the stream is currently active |

4. **Stream status lifecycle.**

   ```
   EARLY_DETECTION → MATURE → TOMBSTONED
        ↓                        ↓
     (< 3 occurrences)    (cancelled/stopped)
   ```

   | Status | Meaning | Show to User? |
   |--------|---------|---------------|
   | `MATURE` | Established pattern (3+ occurrences) | Yes |
   | `EARLY_DETECTION` | New pattern (< 3 occurrences) | Optionally, with caveat |
   | `TOMBSTONED` | Stream stopped or cancelled | Only in "cancelled" section |
   | `UNKNOWN` | Insufficient data to classify | No |

5. **Frequency types.** How Plaid classifies recurrence:

   | Frequency | Typical Use Case |
   |-----------|-----------------|
   | `WEEKLY` | Weekly subscriptions, gym payments |
   | `BIWEEKLY` | Paychecks (every 2 weeks) |
   | `SEMI_MONTHLY` | Paychecks (1st and 15th) |
   | `MONTHLY` | Subscriptions, rent, utilities, loan payments |
   | `ANNUALLY` | Annual subscriptions, insurance premiums |
   | `UNKNOWN` | Irregular pattern |

6. **Build a subscription tracker.** Example filtering for active monthly subscriptions:

   ```typescript
   const subscriptions = response.data.outflow_streams.filter(
     (s) =>
       s.status === "MATURE" &&
       s.frequency === "MONTHLY" &&
       s.is_active,
   );

   const monthlyTotal = subscriptions.reduce(
     (sum, s) => sum + Math.abs(Number(s.average_amount.amount)),
     0,
   );

   console.log(`Active subscriptions: ${subscriptions.length}`);
   console.log(`Monthly total: $${monthlyTotal.toFixed(2)}`);

   for (const sub of subscriptions) {
     console.log(
       `  ${sub.merchant_name ?? sub.description}: ` +
         `$${Math.abs(Number(sub.average_amount.amount)).toFixed(2)} - ` +
         `next: ${sub.predicted_next_date}`,
     );
   }
   ```

7. **Income detection.** Inflow streams identify regular income sources:

   ```typescript
   const paychecks = response.data.inflow_streams.filter(
     (s) =>
       s.status === "MATURE" &&
       (s.frequency === "BIWEEKLY" || s.frequency === "SEMI_MONTHLY"),
   );

   for (const paycheck of paychecks) {
     const annualEstimate =
       Math.abs(Number(paycheck.average_amount.amount)) *
       (paycheck.frequency === "BIWEEKLY" ? 26 : 24);
     console.log(
       `${paycheck.description}: ~$${annualEstimate.toFixed(0)}/year`,
     );
   }
   ```

## Sandbox Testing

Sandbox items return synthetic recurring patterns when enough transaction history exists. Use `plaid_createSandboxItem` and then `plaid_simulateTransactions` to generate test data before calling `plaid_getRecurring`:

```typescript
// 1. Create sandbox item
// 2. Fire webhook to generate transactions
// 3. Wait for sync, then fetch recurring streams
```

The default sandbox institution (`ins_109508`) includes synthetic recurring transactions.

## Key References

- [Recurring transactions](https://plaid.com/docs/api/products/transactions/#transactionsrecurringget)
- [Recurring transaction streams](https://plaid.com/docs/transactions/recurring/)
- [Transaction stream schema](https://plaid.com/docs/api/products/transactions/#transactionstream)

## Example Interaction

**User:** "I want to show users their active subscriptions detected from bank transactions."

**Agent:**
1. Creates a sandbox item with `transactions` product via `plaid_createSandboxItem`
2. Fires simulated transactions via `plaid_simulateTransactions`
3. Syncs transaction history via `plaid_syncTransactions`
4. Calls `plaid_getRecurring` to detect outflow streams
5. Filters for `MATURE` + `MONTHLY` + `is_active` streams
6. Displays subscription list with merchant name, amount, frequency, and next expected date
7. Notes: "Recurring detection requires 60+ days of transaction history for best results"

## MCP Usage

| Step | MCP Tool | Description |
|------|----------|-------------|
| Create sandbox item | `plaid_createSandboxItem` | Create a test item with `transactions` product |
| Simulate transactions | `plaid_simulateTransactions` | Fire webhook to generate sandbox transaction data |
| Sync transactions | `plaid_syncTransactions` | Ensure transaction history is available |
| Refresh transactions | `plaid_refreshTransactions` | Force a transaction data refresh |
| Get recurring | `plaid_getRecurring` | Fetch inflow and outflow recurring streams |
| Get item status | `plaid_getItemStatus` | Check item health and product availability |

## Common Pitfalls

1. **Calling too early** - recurring detection needs 60+ days of history. New items may return empty results or only `EARLY_DETECTION` streams.
2. **Showing tombstoned streams as active** - `TOMBSTONED` means the subscription was cancelled. Filter by `status === "MATURE"` and `is_active === true` for current subscriptions.
3. **Not refreshing periodically** - recurring streams update as new transactions arrive. Sync transactions before fetching recurring data for the latest results.
4. **Ignoring amount variations** - subscriptions may have slight amount changes (tax adjustments, price increases). Use `average_amount` for display and `last_amount` for the most recent charge.
5. **Not providing account_ids** - omitting `account_ids` returns streams for all accounts. For account-specific views, always pass the relevant IDs.
6. **Confusing frequency with schedule** - `BIWEEKLY` (every 2 weeks) and `SEMI_MONTHLY` (1st and 15th) are different. Paychecks can be either depending on the employer.

## See Also

- [Plaid Transaction Sync](../plaid-transaction-sync/SKILL.md) - sync transaction data before recurring detection
- [Plaid Category Mapping](../plaid-category-mapping/SKILL.md) - categorize recurring transactions
- [Plaid Sandbox Testing](../plaid-sandbox-testing/SKILL.md) - test with synthetic recurring data
