---
name: plaid-error-handling
description: Detect, classify, and recover from Plaid API errors including ITEM_LOGIN_REQUIRED, INVALID_CREDENTIALS, INSTITUTION_NOT_RESPONDING, rate limits, and network failures. Use when the user needs to handle Plaid errors gracefully.
standards-version: 1.10.0
---

# Plaid Error Handling

## Trigger

Use this skill when the user:

- Is getting errors from Plaid API calls
- Needs to implement error handling for Plaid integration
- Wants to understand Plaid error types and recovery strategies
- Needs to handle ITEM_LOGIN_REQUIRED or other item errors
- Is debugging intermittent failures or rate limits
- Wants to build a robust error recovery system

## Required Inputs

- **Error context**: The error message, code, or behavior the user is seeing
- **Integration stage**: Whether the error occurs during Link, API calls, or webhooks

## Workflow

1. **Understand the Plaid error structure.** Every Plaid error has these fields:

   ```json
   {
     "error_type": "ITEM_ERROR",
     "error_code": "ITEM_LOGIN_REQUIRED",
     "error_message": "the login details of this item have changed...",
     "display_message": "Please update your credentials.",
     "request_id": "abc123",
     "causes": [],
     "status": 400
   }
   ```

2. **Catch and classify errors in code:**

   ```typescript
   import { PlaidError } from "plaid";

   try {
     const response = await plaidClient.transactionsSync({
       access_token: accessToken,
       cursor: cursor,
     });
   } catch (error: any) {
     if (error.response?.data) {
       const plaidError = error.response.data as PlaidError;
       await handlePlaidError(plaidError, itemId);
     } else {
       // Network error, timeout, etc.
       console.error("Network error:", error.message);
     }
   }
   ```

3. **Error types and recovery strategies:**

   | Error Type | Error Code | Cause | Recovery |
   |-----------|------------|-------|----------|
   | `ITEM_ERROR` | `ITEM_LOGIN_REQUIRED` | User changed password at bank | Launch Link in update mode |
   | `ITEM_ERROR` | `ITEM_NOT_FOUND` | Item was removed or doesn't exist | Remove from your database |
   | `ITEM_ERROR` | `ACCESS_NOT_GRANTED` | User didn't grant required permission | Re-link with correct products |
   | `INVALID_REQUEST` | `INVALID_ACCESS_TOKEN` | Token is malformed or expired | Re-link the item |
   | `INVALID_INPUT` | `INVALID_CREDENTIALS` | Wrong client_id or secret | Check environment variables |
   | `RATE_LIMIT_EXCEEDED` | `RATE_LIMIT` | Too many requests | Implement exponential backoff |
   | `API_ERROR` | `INTERNAL_SERVER_ERROR` | Plaid service issue | Retry with backoff |
   | `INSTITUTION_ERROR` | `INSTITUTION_NOT_RESPONDING` | Bank is down | Retry later, notify user |
   | `INSTITUTION_ERROR` | `INSTITUTION_DOWN` | Bank is offline | Retry later |

4. **Implement an error handler:**

   ```typescript
   async function handlePlaidError(error: PlaidError, itemId: string) {
     switch (error.error_type) {
       case "ITEM_ERROR":
         if (error.error_code === "ITEM_LOGIN_REQUIRED") {
           await db.items.update({
             where: { item_id: itemId },
             data: { status: "LOGIN_REQUIRED" },
           });
           // Notify user to re-authenticate
           await notifyUser(itemId, "Your bank connection needs to be updated.");
         }
         break;

       case "RATE_LIMIT_EXCEEDED":
         // Retry with exponential backoff
         await sleep(Math.pow(2, retryCount) * 1000);
         break;

       case "INSTITUTION_ERROR":
         // Bank is having issues - retry later
         await db.items.update({
           where: { item_id: itemId },
           data: { status: "INSTITUTION_ERROR", last_error: error.error_code },
         });
         break;

       case "API_ERROR":
         // Plaid internal error - retry
         console.error(`Plaid API error: ${error.error_code}`);
         break;
     }
   }
   ```

5. **Handle ITEM_LOGIN_REQUIRED with update mode.** This is the most common production error. When a user changes their bank password, Plaid can't access the account:

   ```typescript
   // Create a Link token in update mode
   const response = await plaidClient.linkTokenCreate({
     user: { client_user_id: userId },
     client_name: "My App",
     country_codes: [CountryCode.Us],
     language: "en",
     access_token: brokenAccessToken, // Triggers update mode
   });

   // Launch Link with this token - user re-authenticates
   // On success, the item is fixed automatically
   ```

6. **Implement retry with backoff:**

   ```typescript
   async function callWithRetry<T>(
     fn: () => Promise<T>,
     maxRetries = 3
   ): Promise<T> {
     for (let attempt = 0; attempt <= maxRetries; attempt++) {
       try {
         return await fn();
       } catch (error: any) {
         const plaidError = error.response?.data;
         const retryable =
           plaidError?.error_type === "RATE_LIMIT_EXCEEDED" ||
           plaidError?.error_type === "API_ERROR" ||
           plaidError?.error_type === "INSTITUTION_ERROR";

         if (!retryable || attempt === maxRetries) throw error;

         const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
         await new Promise((resolve) => setTimeout(resolve, delay));
       }
     }
     throw new Error("Unreachable");
   }
   ```

7. **Monitor errors via webhooks.** Plaid sends `ITEM/ERROR` webhooks when items break:

   ```typescript
   if (webhook_type === "ITEM" && webhook_code === "ERROR") {
     const { error } = req.body;
     await handlePlaidError(error, item_id);
   }
   ```

## Key References

- [Error overview](https://plaid.com/docs/errors/)
- [Error types reference](https://plaid.com/docs/errors/item/)
- [Rate limits](https://plaid.com/docs/errors/rate-limit-exceeded/)
- [Institution errors](https://plaid.com/docs/errors/institution/)
- [Update mode](https://plaid.com/docs/link/update-mode/)

## Example Interaction

**User:** "I'm getting ITEM_LOGIN_REQUIRED errors for some of my users. How do I fix this?"

**Agent:**
1. Explains that the user changed their bank password or MFA setup
2. Shows how to detect the error via API calls and ITEM/ERROR webhooks
3. Implements update mode: create a Link token with the broken `access_token`
4. Shows how to notify users and track item health status
5. Demonstrates sandbox simulation using `sandboxItemResetLogin`
6. Notes: "About 10-20% of items will need re-authentication over a year. Build update mode into your UX from day one."

## MCP Usage

| Step | MCP Tool | Description |
|------|----------|-------------|
| Check item health | `plaid_getItemStatus` | Get last successful/failed update timestamps |
| Simulate error | `plaid_resetSandboxLogin` | Force ITEM_LOGIN_REQUIRED in sandbox |
| Inspect token | `plaid_inspectAccessToken` | Decode access token metadata for debugging |

## Common Pitfalls

1. **Not handling errors at all** - bare Plaid API calls without try/catch crash your app. The `plaid-error-handling` rule flags this.
2. **Treating all errors the same** - `ITEM_LOGIN_REQUIRED` needs user action; `RATE_LIMIT_EXCEEDED` needs a retry; `INSTITUTION_DOWN` needs patience. Each error type requires a different strategy.
3. **Not monitoring item health** - items can break silently. Poll `item/get` periodically or rely on `ITEM/ERROR` webhooks to detect problems.
4. **Retrying non-retryable errors** - retrying `ITEM_LOGIN_REQUIRED` wastes API calls. Only retry `RATE_LIMIT_EXCEEDED`, `API_ERROR`, and `INSTITUTION_ERROR`.
5. **Exposing Plaid error details to users** - show `display_message` (user-friendly) instead of `error_message` (technical). Never expose `request_id` or error codes to end users.

## See Also

- [Plaid Link Setup](../plaid-link-setup/SKILL.md) - update mode for fixing ITEM_LOGIN_REQUIRED
- [Plaid Webhook Handling](../plaid-webhook-handling/SKILL.md) - receive error notifications via webhooks
- [Plaid Sandbox Testing](../plaid-sandbox-testing/SKILL.md) - simulate errors in sandbox
