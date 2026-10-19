---
name: plaid-investment-tracking
description: Track investment holdings, securities, and transactions using the Plaid Investments product. Covers holdings retrieval, security details, cost basis, and supported brokerages.
standards-version: 1.10.0
---

# Plaid Investment Tracking

## Trigger

Use this skill when the user:

- Needs to fetch investment holdings from brokerage accounts
- Wants security details (ticker, CUSIP, ISIN, type)
- Needs investment transaction history (buys, sells, dividends)
- Is building a portfolio tracker or net worth calculator
- Wants cost basis or gain/loss calculations
- Needs to aggregate holdings across multiple brokerages

## Required Inputs

- **Access token**: A Plaid access token with the `investments` product
- **Data needed**: Holdings, securities, transactions, or all

## Workflow

1. **Connect a brokerage account.** Request the `investments` product during Link:

   ```typescript
   const tokenResponse = await plaidClient.linkTokenCreate({
     user: { client_user_id: uniqueUserId },
     client_name: "My App",
     products: [Products.Investments],
     country_codes: [CountryCode.Us],
     language: "en",
   });
   ```

2. **Fetch holdings.** Returns all current positions across accounts:

   ```typescript
   const response = await plaidClient.investmentsHoldingsGet({
     access_token: accessToken,
   });

   // response.data.holdings - array of positions
   // response.data.securities - details for each security
   // response.data.accounts - investment accounts with balances

   for (const holding of response.data.holdings) {
     const security = response.data.securities.find(
       (s) => s.security_id === holding.security_id,
     );
     console.log(
       `${security?.ticker_symbol ?? security?.name}: ` +
         `${holding.quantity} shares @ $${holding.institution_price} = $${holding.institution_value}`,
     );
   }
   ```

3. **Security types.** Each security has a `type` field:

   | Type | Description | Example |
   |------|-------------|---------|
   | `equity` | Individual stocks | AAPL, MSFT |
   | `etf` | Exchange-traded funds | SPY, VTI |
   | `mutual fund` | Mutual funds | VFIAX |
   | `fixed income` | Bonds and treasuries | US Treasury |
   | `option` | Options contracts | AAPL 150C |
   | `cryptocurrency` | Crypto holdings | BTC, ETH |
   | `cash` | Cash and money market | Settlement fund |
   | `derivative` | Derivatives | Futures, swaps |

4. **Investment transactions.** Fetch buy, sell, dividend, and fee activity:

   ```typescript
   const txResponse = await plaidClient.investmentsTransactionsGet({
     access_token: accessToken,
     start_date: "2025-01-01",
     end_date: "2026-04-01",
   });

   for (const tx of txResponse.data.investment_transactions) {
     // tx.type: "buy" | "sell" | "dividend" | "cash" | "transfer" | "fee"
     // tx.amount - positive for outflows (buys), negative for inflows (dividends)
     // tx.quantity, tx.price, tx.security_id
     console.log(`${tx.type}: ${tx.name} - $${tx.amount}`);
   }
   ```

   Pagination: if `total_investment_transactions > investment_transactions.length`, use `offset` and `count` to page through results.

5. **Portfolio aggregation.** Combine holdings across multiple items (brokerages):

   ```typescript
   const allHoldings: Map<string, { quantity: number; value: number }> = new Map();

   for (const accessToken of userAccessTokens) {
     const response = await plaidClient.investmentsHoldingsGet({
       access_token: accessToken,
     });

     for (const holding of response.data.holdings) {
       const security = response.data.securities.find(
         (s) => s.security_id === holding.security_id,
       );
       const key = security?.ticker_symbol ?? security?.security_id ?? "unknown";
       const existing = allHoldings.get(key) ?? { quantity: 0, value: 0 };
       allHoldings.set(key, {
         quantity: existing.quantity + holding.quantity,
         value: existing.value + (holding.institution_value ?? 0),
       });
     }
   }
   ```

6. **Cost basis and gain/loss.** When available, holdings include `cost_basis`:

   ```typescript
   for (const holding of response.data.holdings) {
     if (holding.cost_basis != null && holding.institution_value != null) {
       const gainLoss = holding.institution_value - holding.cost_basis;
       const pct = ((gainLoss / holding.cost_basis) * 100).toFixed(2);
       console.log(
         `Gain/Loss: $${gainLoss.toFixed(2)} (${pct}%)`,
       );
     }
   }
   ```

   Not all brokerages provide cost basis. Check for `null` before calculating.

## Supported Brokerages

Major brokerages supported by Plaid Investments (sandbox uses `ins_109508` and similar test institutions):

| Brokerage | Instant Data | Cost Basis |
|-----------|-------------|------------|
| Fidelity | Yes | Yes |
| Charles Schwab | Yes | Yes |
| Vanguard | Yes | Partial |
| E*TRADE | Yes | Yes |
| TD Ameritrade | Yes | Yes |
| Robinhood | Yes | Yes |
| Coinbase | Yes | No |
| Wealthfront | Yes | Yes |
| Betterment | Yes | Yes |

Coverage varies. Use `plaid_searchInstitutions` with `products: ["investments"]` to check availability.

## Sandbox Testing

Sandbox institutions return synthetic investment data:

```typescript
// Create a sandbox item with investments product
const createResponse = await plaidClient.sandboxPublicTokenCreate({
  institution_id: "ins_109508",
  initial_products: [Products.Investments],
});

// Exchange and fetch holdings
const exchangeResponse = await plaidClient.itemPublicTokenExchange({
  public_token: createResponse.data.public_token,
});

const holdingsResponse = await plaidClient.investmentsHoldingsGet({
  access_token: exchangeResponse.data.access_token,
});
// Returns synthetic holdings with various security types
```

## Key References

- [Investments product overview](https://plaid.com/docs/investments/)
- [Holdings endpoint](https://plaid.com/docs/api/products/investments/#investmentsholdingsget)
- [Investment transactions](https://plaid.com/docs/api/products/investments/#investmentstransactionsget)
- [Security schema](https://plaid.com/docs/api/products/investments/#security)
- [Supported institutions](https://plaid.com/docs/investments/coverage/)

## Example Interaction

**User:** "I want to show users their total investment portfolio across all connected brokerage accounts."

**Agent:**
1. Creates a sandbox item with `investments` product via `plaid_createSandboxItem`
2. Fetches holdings with `plaid_getInvestmentHoldings`
3. Groups holdings by security type (equity, ETF, mutual fund)
4. Calculates total portfolio value by summing `institution_value`
5. Shows allocation breakdown by asset class
6. Notes: "Investment data refreshes once per day in production. Use webhooks to know when new data is available."

## MCP Usage

| Step | MCP Tool | Description |
|------|----------|-------------|
| Create sandbox item | `plaid_createSandboxItem` | Create a test item with `investments` product |
| Get accounts | `plaid_getAccounts` | List investment accounts with balances |
| Get holdings | `plaid_getInvestmentHoldings` | Fetch holdings and securities |
| Get balances | `plaid_getBalance` | Real-time balance check for investment accounts |
| Search institutions | `plaid_searchInstitutions` | Find brokerages supporting investments |
| Create Link token | `plaid_createLinkToken` | Create Link token with `investments` product |

## Common Pitfalls

1. **Assuming real-time data** - investment holdings update once daily, not in real-time. The `HOLDINGS: DEFAULT_UPDATE` webhook fires when new data is available.
2. **Ignoring security type** - different security types need different display logic. Options have strike prices and expiration dates; crypto has different decimal precision.
3. **Missing cost basis** - not all brokerages provide cost basis. Always check for `null` before calculating gain/loss.
4. **Not handling pagination** - `investmentsTransactionsGet` may not return all transactions in one call. Check `total_investment_transactions` and paginate with `offset`.
5. **Treating amount signs inconsistently** - in investment transactions, positive `amount` means money left the account (buy), negative means money entered (dividend, sell proceeds).
6. **Forgetting cash positions** - holdings include a `cash` security type representing uninvested cash in the brokerage account. Include it in total value calculations.

## See Also

- [Plaid Link Setup](../plaid-link-setup/SKILL.md) - connect brokerage accounts
- [Plaid Account Verification](../plaid-account-verification/SKILL.md) - verify investment account ownership
- [Plaid Sandbox Testing](../plaid-sandbox-testing/SKILL.md) - test with synthetic investment data
