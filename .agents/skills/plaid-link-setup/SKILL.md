---
name: plaid-link-setup
description: Integrate Plaid Link into web and mobile apps using react-plaid-link, token exchange, OAuth redirect handling, update mode, and multi-item flows. Use when the user needs to connect bank accounts via Plaid Link.
standards-version: 1.10.0
---

# Plaid Link Setup

## Trigger

Use this skill when the user:

- Wants to integrate Plaid Link into a web or mobile app
- Needs to create a Link token on the backend
- Needs to handle the public token exchange flow
- Is setting up OAuth redirect for institutional login
- Wants to use update mode to fix broken connections
- Needs multi-item Link flows (connecting multiple banks)
- Is using `react-plaid-link` or `@plaid/link-web`

## Required Inputs

- **Framework**: React, Next.js, vanilla JS, React Native, iOS, or Android
- **Backend language**: Node.js/Express, Python/Flask, Ruby, Go, or Java (for token exchange)
- **Products**: Which Plaid products to enable (transactions, auth, identity, investments, liabilities)

## Workflow

1. **Create a Link token on the server.** The client never calls Plaid directly for token creation.

   ```typescript
   import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

   const plaidClient = new PlaidApi(
     new Configuration({
       basePath: PlaidEnvironments[process.env.PLAID_ENV!],
       baseOptions: {
         headers: {
           "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
           "PLAID-SECRET": process.env.PLAID_SECRET,
         },
       },
     })
   );

   const response = await plaidClient.linkTokenCreate({
     user: { client_user_id: uniqueUserId },
     client_name: "My App",
     products: [Products.Transactions],
     country_codes: [CountryCode.Us],
     language: "en",
   });

   // Return response.data.link_token to the client
   ```

2. **Launch Link on the client.** Use `react-plaid-link` for React apps:

   ```typescript
   import { usePlaidLink } from "react-plaid-link";

   function PlaidLinkButton({ linkToken }: { linkToken: string }) {
     const { open, ready } = usePlaidLink({
       token: linkToken,
       onSuccess: (publicToken, metadata) => {
         // Send publicToken to your server for exchange
         fetch("/api/exchange-token", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ public_token: publicToken }),
         });
       },
       onExit: (error, metadata) => {
         if (error) {
           console.error("Link exit with error:", error);
         }
       },
     });

     return (
       <button onClick={() => open()} disabled={!ready}>
         Connect Bank Account
       </button>
     );
   }
   ```

3. **Exchange the public token on the server.** The public token is short-lived (30 minutes). Exchange it immediately for a permanent access token:

   ```typescript
   const exchangeResponse = await plaidClient.itemPublicTokenExchange({
     public_token: publicToken,
   });

   const accessToken = exchangeResponse.data.access_token;
   const itemId = exchangeResponse.data.item_id;

   // Store accessToken securely (encrypted, server-side only)
   ```

4. **Handle OAuth redirects** (required for many European banks and some US institutions). Add `redirect_uri` to the Link token request and configure it in the Plaid Dashboard:

   ```typescript
   const response = await plaidClient.linkTokenCreate({
     user: { client_user_id: uniqueUserId },
     client_name: "My App",
     products: [Products.Transactions],
     country_codes: [CountryCode.Us],
     language: "en",
     redirect_uri: "https://myapp.com/oauth-callback",
   });
   ```

   On the OAuth callback page, reinitialize Link with `receivedRedirectUri`:

   ```typescript
   const { open, ready } = usePlaidLink({
     token: linkToken, // Same token from before redirect
     receivedRedirectUri: window.location.href,
     onSuccess: (publicToken, metadata) => {
       // Same handler as above
     },
   });

   useEffect(() => {
     if (ready) open();
   }, [ready, open]);
   ```

5. **Update mode** for fixing broken connections (ITEM_LOGIN_REQUIRED):

   ```typescript
   const response = await plaidClient.linkTokenCreate({
     user: { client_user_id: uniqueUserId },
     client_name: "My App",
     country_codes: [CountryCode.Us],
     language: "en",
     access_token: existingAccessToken, // Triggers update mode
   });
   ```

## Key References

- [Plaid Link docs](https://plaid.com/docs/link/)
- [react-plaid-link npm](https://www.npmjs.com/package/react-plaid-link)
- [Link token create endpoint](https://plaid.com/docs/api/tokens/#linktokencreate)
- [OAuth guide](https://plaid.com/docs/link/oauth/)
- [Update mode](https://plaid.com/docs/link/update-mode/)

## Example Interaction

**User:** "I need to add Plaid Link to my Next.js app so users can connect their bank accounts for transaction data."

**Agent:**
1. Creates an API route at `/api/create-link-token` that calls `linkTokenCreate` with `Products.Transactions`
2. Creates a React component using `usePlaidLink` hook with `onSuccess` and `onExit` handlers
3. Creates an API route at `/api/exchange-token` that calls `itemPublicTokenExchange`
4. Stores the access token in the database (encrypted)
5. Notes: "Add `redirect_uri` if you need OAuth support for institutions like Chase or Capital One"

## MCP Usage

| Step | MCP Tool | Description |
|------|----------|-------------|
| Create Link token | `plaid_createLinkToken` | Create a Link token for sandbox testing without writing backend code |
| Exchange token | `plaid_exchangePublicToken` | Exchange a public token to get an access token |
| Test the connection | `plaid_getAccounts` | Verify the item works by fetching accounts |

## Common Pitfalls

1. **Creating Link tokens on the client** - the `client_id` and `secret` must never be exposed to the browser. Always create Link tokens server-side.
2. **Not handling `onExit`** - users may close Link without completing. The `onExit` callback receives error details and metadata about what step they were on.
3. **Forgetting OAuth redirect** - many institutions require OAuth. Without `redirect_uri`, users at those banks will see an error. Register your redirect URI in the Plaid Dashboard under "Allowed redirect URIs".
4. **Storing access tokens insecurely** - access tokens are permanent credentials. Store them encrypted, server-side only. Never send them to the client.
5. **Not persisting Link tokens across OAuth** - the same Link token must be reused after OAuth redirect. Store it in a session or database before redirecting.

## See Also

- [Plaid Error Handling](../plaid-error-handling/SKILL.md) - handle errors during and after Link
- [Plaid Webhook Handling](../plaid-webhook-handling/SKILL.md) - receive updates after items are connected
- [Plaid Sandbox Testing](../plaid-sandbox-testing/SKILL.md) - test Link flows in sandbox
