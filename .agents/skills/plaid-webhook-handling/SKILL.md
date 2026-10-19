---
name: plaid-webhook-handling
description: Handle Plaid webhooks including verification, all webhook types and codes, sandbox webhook firing, retry logic, and idempotent processing. Use when the user needs to receive and process Plaid webhook events.
standards-version: 1.10.0
---

# Plaid Webhook Handling

## Trigger

Use this skill when the user:

- Needs to set up a webhook endpoint for Plaid events
- Wants to verify webhook signatures
- Needs to handle specific webhook types (transactions, item, auth, etc.)
- Wants to fire test webhooks in sandbox
- Is debugging missing or duplicate webhook events
- Needs idempotent webhook processing

## Required Inputs

- **Webhook URL**: The publicly accessible HTTPS endpoint that Plaid will POST to
- **Backend framework**: Express, Next.js API routes, Flask, FastAPI, etc.

## Workflow

1. **Register your webhook URL** when creating a Link token or updating an item:

   ```typescript
   const response = await plaidClient.linkTokenCreate({
     user: { client_user_id: uniqueUserId },
     client_name: "My App",
     products: [Products.Transactions],
     country_codes: [CountryCode.Us],
     language: "en",
     webhook: "https://myapp.com/api/plaid-webhook",
   });
   ```

2. **Create the webhook endpoint.** Plaid sends POST requests with a JSON body:

   ```typescript
   // Express example
   app.post("/api/plaid-webhook", async (req, res) => {
     const { webhook_type, webhook_code, item_id } = req.body;

     // Verify the webhook first (see step 3)

     switch (webhook_type) {
       case "TRANSACTIONS":
         await handleTransactionWebhook(webhook_code, item_id, req.body);
         break;
       case "ITEM":
         await handleItemWebhook(webhook_code, item_id, req.body);
         break;
       case "AUTH":
         await handleAuthWebhook(webhook_code, item_id, req.body);
         break;
       default:
         console.log(`Unhandled webhook type: ${webhook_type}`);
     }

     res.status(200).json({ received: true });
   });
   ```

3. **Verify webhook signatures.** Plaid signs webhooks with JWKs. Verify using the `plaid-node` library:

   ```typescript
   import { WebhookVerificationKeyGetResponse } from "plaid";
   import jwt from "jsonwebtoken";
   import jwkToPem from "jwk-to-pem";

   async function verifyWebhook(body: string, headers: Record<string, string>) {
     const signedJwt = headers["plaid-verification"];
     const decodedToken = jwt.decode(signedJwt, { complete: true });
     const kid = decodedToken?.header.kid;

     const keyResponse = await plaidClient.webhookVerificationKeyGet({
       key_id: kid!,
     });

     const key = keyResponse.data.key;
     const pem = jwkToPem(key as any);

     const verified = jwt.verify(signedJwt, pem, {
       algorithms: ["ES256"],
       maxAge: "5m",
     });

     // Compare the body hash
     const crypto = await import("crypto");
     const bodyHash = crypto
       .createHash("sha256")
       .update(body)
       .digest("hex");

     if ((verified as any).request_body_sha256 !== bodyHash) {
       throw new Error("Webhook body hash mismatch");
     }
   }
   ```

4. **Handle webhook types.** Key webhook types and codes:

   | Type | Code | Meaning |
   |------|------|---------|
   | TRANSACTIONS | SYNC_UPDATES_AVAILABLE | New/modified/removed transactions ready for sync |
   | TRANSACTIONS | RECURRING_TRANSACTIONS_UPDATE | Recurring transaction streams updated |
   | TRANSACTIONS | INITIAL_UPDATE | Historical transactions ready (deprecated, use sync) |
   | TRANSACTIONS | DEFAULT_UPDATE | New transactions available (deprecated, use sync) |
   | ITEM | ERROR | Item has an error (e.g. ITEM_LOGIN_REQUIRED) |
   | ITEM | PENDING_EXPIRATION | Access will expire in 7 days (requires reauth) |
   | ITEM | USER_PERMISSION_REVOKED | User revoked access at their bank |
   | ITEM | WEBHOOK_UPDATE_ACKNOWLEDGED | Webhook URL was updated |
   | AUTH | AUTOMATICALLY_VERIFIED | Micro-deposit verification completed |
   | AUTH | VERIFICATION_EXPIRED | Micro-deposits expired |
   | HOLDINGS | DEFAULT_UPDATE | Investment holdings updated |
   | INVESTMENTS_TRANSACTIONS | DEFAULT_UPDATE | Investment transactions updated |
   | IDENTITY | DEFAULT_UPDATE | Identity data updated |
   | LIABILITIES | DEFAULT_UPDATE | Liability data updated |

5. **Implement retry-safe processing.** Plaid retries failed webhooks. Use idempotency keys:

   ```typescript
   async function handleTransactionWebhook(code: string, itemId: string, body: any) {
     if (code === "SYNC_UPDATES_AVAILABLE") {
       const item = await db.items.findUnique({ where: { item_id: itemId } });
       if (!item) return;
       await syncTransactions(plaidClient, item.access_token, item.transaction_cursor);
     }
   }
   ```

6. **Fire test webhooks in sandbox:**

   ```typescript
   await plaidClient.sandboxItemFireWebhook({
     access_token: sandboxAccessToken,
     webhook_code: "SYNC_UPDATES_AVAILABLE",
     webhook_type: "TRANSACTIONS",
   });
   ```

## Key References

- [Webhook overview](https://plaid.com/docs/api/webhooks/)
- [Webhook verification](https://plaid.com/docs/api/webhooks/webhook-verification/)
- [Transaction webhooks](https://plaid.com/docs/api/products/transactions/#webhooks)
- [Item webhooks](https://plaid.com/docs/api/items/#webhooks)
- [Sandbox webhook firing](https://plaid.com/docs/api/sandbox/#sandboxitemfirewebhook)

## Example Interaction

**User:** "I need to set up webhook handling for Plaid in my Express app. I want to know when new transactions are available and when an item has an error."

**Agent:**
1. Creates POST route at `/api/plaid-webhook`
2. Implements signature verification using `plaid-verification` header and JWK
3. Adds handlers for `TRANSACTIONS/SYNC_UPDATES_AVAILABLE` and `ITEM/ERROR`
4. Shows how to fire test webhooks in sandbox
5. Notes: "Use a tool like ngrok for local development so Plaid can reach your endpoint"

## MCP Usage

| Step | MCP Tool | Description |
|------|----------|-------------|
| Fire test webhook | `plaid_fireSandboxWebhook` | Fire any webhook type for a sandbox item |
| Verify signature | `plaid_verifyWebhookSignature` | Verify a webhook payload signature offline |
| List webhook types | `plaid_listWebhookTypes` | Browse all webhook types with payload shapes |
| Update webhook URL | `plaid_updateItemWebhook` | Change the webhook URL for an existing item |

## Common Pitfalls

1. **Not verifying webhook signatures** - without verification, anyone can POST fake events to your endpoint. Always verify the `plaid-verification` header.
2. **Returning non-200 status codes** - Plaid retries on non-2xx responses. If your handler throws before responding, you'll get duplicate events.
3. **Processing webhooks synchronously** - respond 200 immediately, then process asynchronously. Long-running handlers cause timeouts and retries.
4. **Hardcoding the webhook URL** - use environment variables. Sandbox and production use different URLs.
5. **Missing the ITEM ERROR webhook** - when an item breaks (e.g. password changed), Plaid sends `ITEM/ERROR`. If you don't handle it, users see stale data with no warning.

## See Also

- [Plaid Transaction Sync](../plaid-transaction-sync/SKILL.md) - process transactions after SYNC_UPDATES_AVAILABLE
- [Plaid Error Handling](../plaid-error-handling/SKILL.md) - handle errors surfaced via ITEM/ERROR webhooks
- [Plaid Sandbox Testing](../plaid-sandbox-testing/SKILL.md) - fire test webhooks for development
