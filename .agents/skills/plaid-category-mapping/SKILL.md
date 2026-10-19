---
name: plaid-category-mapping
description: Map Plaid personal finance categories to your application's taxonomy. Covers the primary/detailed hierarchy, building custom mapping layers, and common category use cases. Use when the user needs to categorize or display transaction categories.
standards-version: 1.10.0
---

# Plaid Category Mapping

## Trigger

Use this skill when the user:

- Needs to understand Plaid's transaction category system
- Wants to map Plaid categories to custom app categories
- Is building a budgeting or expense tracking feature
- Needs to display human-readable category labels
- Wants to aggregate spending by category
- Is migrating from the legacy category system to `personal_finance_category`

## Required Inputs

- **Use case**: Budgeting, expense tracking, tax prep, analytics, or custom
- **Granularity**: Whether the user needs primary (broad) or detailed (specific) categories

## Workflow

1. **Understand the category hierarchy.** Plaid uses a two-level taxonomy called `personal_finance_category`:

   | Level | Field | Example | Count |
   |-------|-------|---------|-------|
   | Primary | `personal_finance_category.primary` | `FOOD_AND_DRINK` | ~20 categories |
   | Detailed | `personal_finance_category.detailed` | `FOOD_AND_DRINK_RESTAURANTS` | ~100+ categories |
   | Confidence | `personal_finance_category.confidence_level` | `VERY_HIGH` | 3 levels |

2. **Primary categories.** The top-level groupings:

   | Primary Category | Description |
   |-----------------|-------------|
   | `INCOME` | Paychecks, interest, dividends, refunds |
   | `TRANSFER_IN` | Incoming transfers, deposits |
   | `TRANSFER_OUT` | Outgoing transfers, payments |
   | `LOAN_PAYMENTS` | Mortgage, student loan, auto loan payments |
   | `BANK_FEES` | Overdraft, ATM, maintenance fees |
   | `ENTERTAINMENT` | Movies, games, music, sports |
   | `FOOD_AND_DRINK` | Restaurants, groceries, coffee shops |
   | `GENERAL_MERCHANDISE` | Retail, clothing, electronics |
   | `HOME_IMPROVEMENT` | Hardware, furniture, contractors |
   | `MEDICAL` | Doctors, pharmacy, dental, vision |
   | `PERSONAL_CARE` | Haircuts, gym, spa |
   | `GENERAL_SERVICES` | Legal, accounting, consulting |
   | `GOVERNMENT_AND_NON_PROFIT` | Taxes, fines, donations |
   | `TRANSPORTATION` | Gas, parking, rideshare, public transit |
   | `TRAVEL` | Flights, hotels, car rental |
   | `RENT_AND_UTILITIES` | Rent, electric, water, internet, phone |

3. **Access categories on transactions.** The `personal_finance_category` field is available on every transaction from `/transactions/sync`:

   ```typescript
   const { added } = await syncTransactions(client, accessToken, cursor);

   for (const txn of added) {
     const primary = txn.personal_finance_category?.primary;
     const detailed = txn.personal_finance_category?.detailed;
     const confidence = txn.personal_finance_category?.confidence_level;

     console.log(`${txn.name}: ${primary} / ${detailed} (${confidence})`);
     // "Starbucks: FOOD_AND_DRINK / FOOD_AND_DRINK_COFFEE (VERY_HIGH)"
   }
   ```

4. **Build a custom mapping layer.** Map Plaid categories to your app's categories:

   ```typescript
   const CATEGORY_MAP: Record<string, string> = {
     FOOD_AND_DRINK: "Food",
     FOOD_AND_DRINK_RESTAURANTS: "Dining Out",
     FOOD_AND_DRINK_GROCERIES: "Groceries",
     FOOD_AND_DRINK_COFFEE: "Coffee",
     TRANSPORTATION: "Transport",
     TRANSPORTATION_GAS: "Gas",
     TRANSPORTATION_PARKING: "Parking",
     RENT_AND_UTILITIES: "Bills",
     ENTERTAINMENT: "Fun",
     GENERAL_MERCHANDISE: "Shopping",
     INCOME: "Income",
     TRANSFER_IN: "Transfer",
     TRANSFER_OUT: "Transfer",
   };

   function mapCategory(txn: Transaction): string {
     const detailed = txn.personal_finance_category?.detailed;
     const primary = txn.personal_finance_category?.primary;

     // Try detailed first, fall back to primary
     return CATEGORY_MAP[detailed ?? ""] ??
            CATEGORY_MAP[primary ?? ""] ??
            "Other";
   }
   ```

5. **Aggregate spending by category:**

   ```typescript
   function summarizeByCategory(transactions: Transaction[]) {
     const totals: Record<string, number> = {};

     for (const txn of transactions) {
       if (txn.amount > 0) { // Plaid: positive = money out
         const category = mapCategory(txn);
         totals[category] = (totals[category] ?? 0) + txn.amount;
       }
     }

     return Object.entries(totals)
       .sort(([, a], [, b]) => b - a)
       .map(([category, total]) => ({ category, total: total.toFixed(2) }));
   }
   ```

6. **Handle confidence levels.** Plaid provides a confidence score for each category:

   | Level | Meaning |
   |-------|---------|
   | `VERY_HIGH` | Near-certain match (merchant recognized) |
   | `HIGH` | Strong match based on transaction data |
   | `LOW` | Best guess, may be inaccurate |

   For low-confidence categories, consider letting users manually recategorize.

## Key References

- [Personal finance categories](https://plaid.com/docs/api/products/transactions/#transactions-sync-response-added-personal-finance-category)
- [Category taxonomy CSV](https://plaid.com/documents/transactions-personal-finance-category-taxonomy.csv)
- [Legacy to PFC migration](https://plaid.com/docs/api/products/transactions/#transactions-sync-response-added-category)

## Example Interaction

**User:** "I'm building a budgeting app. How do I show spending by category using Plaid transaction data?"

**Agent:**
1. Explains the `personal_finance_category` field on transactions
2. Shows the primary category list and how detailed categories nest under them
3. Builds a custom mapping from Plaid categories to the app's budget categories
4. Creates an aggregation function that sums spending per category
5. Notes: "Plaid amounts are positive for debits (money out) and negative for credits (money in)"

## MCP Usage

| Step | MCP Tool | Description |
|------|----------|-------------|
| Browse categories | `plaid_listCategories` | Browse the full personal_finance_category taxonomy |
| Fetch transactions | `plaid_syncTransactions` | Get transactions with category data included |

## Common Pitfalls

1. **Using the legacy `category` field** - the old `category` array (e.g. `["Food and Drink", "Restaurants"]`) is deprecated. Use `personal_finance_category` instead.
2. **Assuming categories are always present** - `personal_finance_category` can be null for some transactions (especially pending). Always handle the null case.
3. **Confusing amount sign** - in Plaid, positive amounts are debits (money leaving the account). Income and refunds are negative. This is the opposite of what most users expect.
4. **Hardcoding the category list** - Plaid occasionally adds new categories. Fetch the taxonomy dynamically or have a fallback "Other" category.
5. **Ignoring confidence levels** - low-confidence categories are often wrong. Let users override them.

## See Also

- [Plaid Transaction Sync](../plaid-transaction-sync/SKILL.md) - fetch transactions that include category data
- [Plaid Recurring Detection](../plaid-recurring-detection/SKILL.md) - identify recurring transactions by category
- [Plaid API Reference](../plaid-api-reference/SKILL.md) - look up category field specifications
