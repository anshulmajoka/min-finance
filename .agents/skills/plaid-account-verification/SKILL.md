---
name: plaid-account-verification
description: Verify bank accounts using Plaid Auth, micro-deposits, same-day micro-deposits, and database match. Use when the user needs account and routing numbers or ACH payment verification.
standards-version: 1.10.0
---

# Plaid Account Verification

## Trigger

Use this skill when the user:

- Needs account and routing numbers for ACH payments
- Wants to verify bank account ownership
- Is setting up micro-deposit verification
- Needs same-day micro-deposit flows
- Is implementing database match verification
- Wants to initiate ACH debits or credits

## Required Inputs

- **Verification method**: Instant Auth, micro-deposits, same-day micro-deposits, or database match
- **Use case**: ACH payments, direct deposit, account funding, payroll

## Workflow

1. **Instant Auth** - the primary path. Covers ~80% of US depository accounts. Returns account and routing numbers immediately after Link:

   ```typescript
   import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

   // 1. Create Link token with auth product
   const tokenResponse = await plaidClient.linkTokenCreate({
     user: { client_user_id: uniqueUserId },
     client_name: "My App",
     products: [Products.Auth],
     country_codes: [CountryCode.Us],
     language: "en",
   });

   // 2. After user completes Link, exchange token
   const exchangeResponse = await plaidClient.itemPublicTokenExchange({
     public_token: publicTokenFromLink,
   });

   // 3. Retrieve account and routing numbers
   const authResponse = await plaidClient.authGet({
     access_token: exchangeResponse.data.access_token,
   });

   const achNumbers = authResponse.data.numbers.ach;
   // Each entry: { account_id, account, routing, wire_routing }
   ```

2. **Micro-deposit fallback** - for institutions without Instant Auth support. Plaid deposits two small amounts (typically $0.01–$0.10) into the user's account:

   ```typescript
   // Create Link token requesting auth with micro-deposit fallback
   const tokenResponse = await plaidClient.linkTokenCreate({
     user: { client_user_id: uniqueUserId },
     client_name: "My App",
     products: [Products.Auth],
     country_codes: [CountryCode.Us],
     language: "en",
     auth: {
       automated_microdeposits_enabled: true,
     },
   });
   ```

   The user completes Link, selects their institution, and enters credentials. If Instant Auth is unavailable, Plaid initiates micro-deposits automatically. The user must return 1–3 business days later to verify the amounts.

3. **Same-day micro-deposits** - micro-deposits that arrive on the same business day (if initiated before the cutoff):

   ```typescript
   const tokenResponse = await plaidClient.linkTokenCreate({
     user: { client_user_id: uniqueUserId },
     client_name: "My App",
     products: [Products.Auth],
     country_codes: [CountryCode.Us],
     language: "en",
     auth: {
       same_day_microdeposits_enabled: true,
     },
   });
   ```

4. **Database match** - verifies account ownership by matching the account holder's identity against the institution's records, without any deposits:

   ```typescript
   const tokenResponse = await plaidClient.linkTokenCreate({
     user: { client_user_id: uniqueUserId },
     client_name: "My App",
     products: [Products.Auth],
     country_codes: [CountryCode.Us],
     language: "en",
     auth: {
       database_match_enabled: true,
     },
   });
   ```

5. **Auth number formats** - the response includes different number formats depending on the country:

   | Field | Format | Region |
   |-------|--------|--------|
   | `numbers.ach` | Account + routing + wire routing | US |
   | `numbers.eft` | Account + institution + branch | Canada |
   | `numbers.international` | IBAN + BIC | Europe |
   | `numbers.bacs` | Account + sort code | UK |

6. **Handling verification status webhooks:**

   ```typescript
   // VERIFICATION_EXPIRED - user didn't verify micro-deposits in time
   // AUTOMATICALLY_VERIFIED - micro-deposits verified without user input
   // DATABASE_MATCHED - database match succeeded

   app.post("/api/plaid-webhook", async (req, res) => {
     const { webhook_type, webhook_code, item_id } = req.body;

     if (webhook_type === "AUTH") {
       switch (webhook_code) {
         case "VERIFICATION_EXPIRED":
           // Prompt user to restart verification
           break;
         case "AUTOMATICALLY_VERIFIED":
           // Fetch auth numbers - account is now verified
           const authResponse = await plaidClient.authGet({
             access_token: await getAccessToken(item_id),
           });
           break;
       }
     }
   });
   ```

## Sandbox Testing

Test all verification flows in sandbox without waiting for real deposits:

```typescript
// Set verification status directly in sandbox
await plaidClient.sandboxItemSetVerificationStatus({
  access_token: accessToken,
  account_id: accountId,
  verification_status: "automatically_verified",
});

// Now authGet will return numbers for this account
const authResponse = await plaidClient.authGet({
  access_token: accessToken,
});
```

Available sandbox verification statuses: `automatically_verified`, `verification_expired`.

## Key References

- [Auth product overview](https://plaid.com/docs/auth/)
- [Auth endpoint](https://plaid.com/docs/api/products/auth/#authget)
- [Micro-deposits](https://plaid.com/docs/auth/coverage/microdeposits/)
- [Same-day micro-deposits](https://plaid.com/docs/auth/coverage/same-day-micro-deposits/)
- [Database match](https://plaid.com/docs/auth/coverage/database-match/)
- [Auth webhooks](https://plaid.com/docs/api/products/auth/#webhooks)

## Example Interaction

**User:** "I need to get account and routing numbers for ACH payments using Plaid."

**Agent:**
1. Creates a Link token with `Products.Auth` via `plaid_createLinkToken`
2. After Link completion, exchanges the public token
3. Calls `plaid_getAuthNumbers` to retrieve account and routing numbers
4. Shows how to handle the `numbers.ach` response
5. Explains micro-deposit fallback for institutions without Instant Auth
6. Notes: "Instant Auth covers ~80% of US depository accounts. Enable `automated_microdeposits_enabled` as fallback."

## MCP Usage

| Step | MCP Tool | Description |
|------|----------|-------------|
| Create sandbox item | `plaid_createSandboxItem` | Create a test item with the `auth` product |
| Get accounts | `plaid_getAccounts` | List accounts to find depository account IDs |
| Get auth numbers | `plaid_getAuthNumbers` | Retrieve account and routing numbers |
| Get balances | `plaid_getBalance` | Check real-time balances before initiating transfers |
| Set verification | `plaid_sandboxSetVerificationStatus` | Set micro-deposit verification status in sandbox (coming v0.5.0) |
| Create Link token | `plaid_createLinkToken` | Create a Link token with `auth` product for testing |

## Common Pitfalls

1. **Not handling micro-deposit fallback** - not all institutions support Instant Auth. Without `automated_microdeposits_enabled`, users at unsupported institutions see an error.
2. **Storing routing numbers in plain text** - treat account and routing numbers as PII. Encrypt at rest, restrict access, and audit usage.
3. **Ignoring verification expiration** - micro-deposits expire after 14 days. Listen for `VERIFICATION_EXPIRED` webhooks and prompt users to restart.
4. **Using auth numbers before verification completes** - for micro-deposit flows, `authGet` returns numbers only after the user verifies the amounts. Check the verification status first.
5. **Assuming all accounts have ACH numbers** - credit cards and loan accounts don't have routing numbers. Filter to `depository` accounts before calling `authGet`.
6. **Not requesting the auth product in Link** - if `auth` isn't in the `products` array during Link token creation, `authGet` will fail with `PRODUCT_NOT_READY`.

## See Also

- [Plaid Link Setup](../plaid-link-setup/SKILL.md) - connect accounts with the Auth product
- [Plaid Sandbox Testing](../plaid-sandbox-testing/SKILL.md) - test verification flows in sandbox
- [Plaid Error Handling](../plaid-error-handling/SKILL.md) - handle auth-specific errors
