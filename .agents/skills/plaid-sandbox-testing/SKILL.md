---
name: plaid-sandbox-testing
description: Test Plaid integrations using the sandbox environment with test credentials, test institutions, custom user scenarios, and error simulation. Use when the user needs to develop or test against Plaid without real bank accounts.
standards-version: 1.10.0
---

# Plaid Sandbox Testing

## Trigger

Use this skill when the user:

- Is developing a Plaid integration and needs test data
- Wants to create sandbox items without the Link UI
- Needs to simulate specific error conditions
- Wants to test webhook handling in sandbox
- Needs to generate test transactions
- Wants to verify their integration works before going to development/production
- Needs to test OAuth redirect flows in sandbox

## Required Inputs

- **Plaid sandbox credentials**: `client_id` and sandbox `secret` (free at https://dashboard.plaid.com/signup)
- **Test scenario**: What the user wants to test (happy path, error handling, specific products)

## Workflow

1. **Sandbox credentials.** Plaid provides three environments. Sandbox requires no real bank accounts:

   | Environment | Base URL | Purpose |
   |-------------|----------|---------|
   | Sandbox | `https://sandbox.plaid.com` | Test with fake data, free, instant |
   | Development | `https://development.plaid.com` | Test with real banks, limited items |
   | Production | `https://production.plaid.com` | Live with real users |

2. **Test user credentials for Link.** Use these in the Plaid Link UI when in sandbox mode:

   | Username | Password | Behavior |
   |----------|----------|----------|
   | `user_good` | `pass_good` | Standard successful login |
   | `user_good` | `pass_good` (MFA: `1234`) | Login requiring MFA code |
   | `user_custom` | varies | Custom sandbox user (see Custom Sandbox Users below) |

3. **Create sandbox items without Link.** Skip the Link UI entirely for automated testing:

   ```typescript
   const response = await plaidClient.sandboxPublicTokenCreate({
     institution_id: "ins_109508", // First Platypus Bank
     initial_products: [Products.Transactions],
     options: {
       webhook: "https://myapp.com/api/plaid-webhook",
     },
   });

   const publicToken = response.data.public_token;

   // Exchange for access token
   const exchangeResponse = await plaidClient.itemPublicTokenExchange({
     public_token: publicToken,
   });

   const accessToken = exchangeResponse.data.access_token;
   ```

4. **Test institutions available in sandbox:**

   | Institution ID | Name | Products |
   |---------------|------|----------|
   | `ins_109508` | First Platypus Bank | All products |
   | `ins_109509` | First Gingham Credit Union | All products |
   | `ins_109510` | Houndstooth Bank | All products |
   | `ins_109511` | Tartan Bank | All products |
   | `ins_109512` | Tattersall Federal Credit Union | All products |

5. **Simulate errors.** Force specific error states on sandbox items:

   ```typescript
   // Force ITEM_LOGIN_REQUIRED error
   await plaidClient.sandboxItemResetLogin({
     access_token: accessToken,
   });

   // Now calls to this item will return ITEM_LOGIN_REQUIRED
   // Test your update mode Link flow
   ```

6. **Fire test webhooks:**

   ```typescript
   await plaidClient.sandboxItemFireWebhook({
     access_token: accessToken,
     webhook_code: "SYNC_UPDATES_AVAILABLE",
     webhook_type: "TRANSACTIONS",
   });
   ```

7. **Generate test transactions.** Fire the transaction webhook to have Plaid generate new sandbox transactions:

   ```typescript
   await plaidClient.sandboxItemFireWebhook({
     access_token: accessToken,
     webhook_code: "DEFAULT_UPDATE",
     webhook_type: "TRANSACTIONS",
   });

   // Wait a moment, then sync transactions
   const syncResponse = await plaidClient.transactionsSync({
     access_token: accessToken,
     cursor: "",
   });
   ```

8. **Set micro-deposit verification status:**

   ```typescript
   await plaidClient.sandboxItemSetVerificationStatus({
     access_token: accessToken,
     account_id: accountId,
     verification_status: "automatically_verified",
   });
   ```

## Automated Sandbox Workflow (MCP)

With the MCP server configured, you can run an end-to-end sandbox test without writing any code. The `createSandboxItem` tool auto-exchanges the public token so you get an `access_token` in one call:

1. **Create a test item:**
   > Use `plaid_createSandboxItem` with `institution_id: "ins_109508"` and `products: ["transactions"]`

   Returns `access_token`, `item_id`, and `public_token`.

2. **Verify accounts:**
   > Use `plaid_getAccounts` with the returned `access_token`

   Returns account names, types, subtypes, and balances.

3. **Fire a webhook:**
   > Use `plaid_fireSandboxWebhook` with `webhook_code: "SYNC_UPDATES_AVAILABLE"` and `webhook_type: "TRANSACTIONS"`

4. **Test error recovery:**
   > Use `plaid_resetSandboxLogin` to force `ITEM_LOGIN_REQUIRED`, then use `plaid_createLinkToken` with `access_token` to generate an update-mode Link token.

This loop lets you validate your entire integration path - item creation, data fetch, webhook handling, and error recovery - from the chat.

## Custom Sandbox Users

Use `sandboxPublicTokenCreate` with override options to simulate specific account configurations:

```typescript
const response = await plaidClient.sandboxPublicTokenCreate({
  institution_id: "ins_109508",
  initial_products: [Products.Transactions],
  options: {
    override_username: "user_custom",
    override_password: JSON.stringify({
      override_accounts: [
        {
          type: "depository",
          subtype: "checking",
          starting_balance: 5000,
          meta: { name: "Test Checking", limit: null },
        },
      ],
    }),
  },
});
```

This lets you control account types, balances, transaction patterns, and error states without changing your integration code.

## Testing OAuth in Sandbox

Sandbox supports OAuth redirect testing for institutions that require it in production:

1. Register a redirect URI in the [Plaid Dashboard](https://dashboard.plaid.com) under **API > Allowed redirect URIs**.
2. Create a Link token with `redirect_uri`:

   ```typescript
   const tokenResponse = await plaidClient.linkTokenCreate({
     user: { client_user_id: userId },
     client_name: "My App",
     products: [Products.Transactions],
     country_codes: [CountryCode.Us],
     language: "en",
     redirect_uri: "https://myapp.com/oauth-callback",
   });
   ```

3. On the callback page, reinitialize Link with `receivedRedirectUri: window.location.href`.
4. In sandbox, the OAuth flow completes instantly with `user_good` / `pass_good` - no real bank redirect occurs.

## Key References

- [Sandbox overview](https://plaid.com/docs/sandbox/)
- [Sandbox test credentials](https://plaid.com/docs/sandbox/test-credentials/)
- [Sandbox public token create](https://plaid.com/docs/api/sandbox/#sandboxpublictokencreate)
- [Sandbox item reset login](https://plaid.com/docs/api/sandbox/#sandboxitemresetlogin)
- [Sandbox item fire webhook](https://plaid.com/docs/api/sandbox/#sandboxitemfirewebhook)
- [Custom sandbox users](https://plaid.com/docs/sandbox/user-custom/)

## Example Interaction

**User:** "I want to test my Plaid transaction sync without going through the Link flow every time."

**Agent:**
1. Creates a sandbox item using `plaid_createSandboxItem` with `ins_109508` and `["transactions"]`
2. Gets the `access_token` directly from the response (auto-exchanged)
3. Calls `plaid_getAccounts` to verify the item is connected and show account details
4. Fires `SYNC_UPDATES_AVAILABLE` webhook via `plaid_fireSandboxWebhook` to generate transactions
5. Demonstrates the full sync loop processing
6. Notes: "Store this access token - sandbox items persist until manually removed"

## MCP Usage

| Step | MCP Tool | Description |
|------|----------|-------------|
| Create Link token | `plaid_createLinkToken` | Create a Link token for sandbox or update-mode testing |
| Exchange token | `plaid_exchangePublicToken` | Exchange a public token from Link for an access token |
| Create sandbox item | `plaid_createSandboxItem` | Instantly create a connected test bank account (auto-exchanges token) |
| Get accounts | `plaid_getAccounts` | Verify the item works by fetching accounts and balances |
| Reset login | `plaid_resetSandboxLogin` | Force ITEM_LOGIN_REQUIRED error for testing |
| Fire webhook | `plaid_fireSandboxWebhook` | Trigger any webhook type for testing |
| Simulate transactions | `plaid_simulateTransactions` | Generate new test transactions (coming v0.5.0) |
| Set verification | `plaid_sandboxSetVerificationStatus` | Set micro-deposit verification status (coming v0.5.0) |
| List credentials | `plaid_listSandboxCredentials` | Show available test usernames and behaviors |

## Common Pitfalls

1. **Using sandbox credentials in production** - sandbox `client_id`/`secret` only work against `sandbox.plaid.com`. The `plaid-env-safety` rule flags this.
2. **Expecting real bank data in sandbox** - sandbox returns synthetic data. Account numbers, balances, and transactions are all fake.
3. **Not testing error flows** - happy path works in sandbox by default. Use `sandboxItemResetLogin` or `plaid_resetSandboxLogin` to test error recovery.
4. **Forgetting webhook testing** - sandbox webhooks only fire when you explicitly call `sandboxItemFireWebhook`. They don't fire automatically like in production.
5. **Assuming sandbox behavior matches production** - some timing differences exist. Production transactions appear with a delay; sandbox transactions are instant.
6. **Calling exchangePublicToken after createSandboxItem** - the MCP tool auto-exchanges the token. The `access_token` is already in the response.

## See Also

- [Plaid Link Setup](../plaid-link-setup/SKILL.md) - use Link with sandbox test credentials
- [Plaid Error Handling](../plaid-error-handling/SKILL.md) - handle errors simulated in sandbox
- [Plaid Webhook Handling](../plaid-webhook-handling/SKILL.md) - process webhooks fired from sandbox
