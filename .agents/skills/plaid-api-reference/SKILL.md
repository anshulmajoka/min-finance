---
name: plaid-api-reference
description: Search and retrieve Plaid API endpoint documentation including parameters, authentication requirements, response shapes, and rate limits. Use when the user needs to call a Plaid API or wants to know available endpoints.
standards-version: 1.10.0
---

# Plaid API Reference

## Trigger

Use this skill when the user:

- Asks how to call a specific Plaid API endpoint
- Wants to know what Plaid APIs are available
- Needs parameter details for a Plaid endpoint
- Is looking up authentication requirements for an endpoint
- Needs to understand response shapes and error codes
- Wants rate limit information for an API call

## Required Inputs

- **Query**: The API endpoint, product, or method the user is looking for (e.g. "get transactions", "/accounts/get", "link token")

## Workflow

1. **Identify the relevant endpoint** from the user's query. Plaid organizes endpoints by product:

   | Product | Key endpoints |
   |---------|---------------|
   | Link | `/link/token/create`, `/item/public_token/exchange` |
   | Transactions | `/transactions/sync`, `/transactions/get`, `/transactions/refresh`, `/transactions/recurring/get` |
   | Auth | `/auth/get` |
   | Balance | `/accounts/balance/get` |
   | Identity | `/identity/get` |
   | Investments | `/investments/holdings/get`, `/investments/transactions/get` |
   | Liabilities | `/liabilities/get` |
   | Items | `/item/get`, `/item/remove`, `/item/webhook/update` |
   | Institutions | `/institutions/search`, `/institutions/get_by_id` |
   | Sandbox | `/sandbox/public_token/create`, `/sandbox/item/fire_webhook`, `/sandbox/item/reset_login` |

2. **Present the endpoint details.** Every Plaid endpoint uses POST. Structure the response with:

   - **URL**: `https://{environment}.plaid.com{path}`
   - **Method**: POST (all Plaid endpoints)
   - **Auth**: Either `client_id + secret` (in headers) or `access_token` (in request body)
   - **Required parameters** and **optional parameters**
   - **Response shape** (key fields)
   - **Rate limits** if applicable

3. **Provide a code example** in TypeScript using the `plaid` Node SDK:

   ```typescript
   import { PlaidApi, Configuration, PlaidEnvironments } from "plaid";

   const config = new Configuration({
     basePath: PlaidEnvironments.sandbox,
     baseOptions: {
       headers: {
         "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
         "PLAID-SECRET": process.env.PLAID_SECRET,
       },
     },
   });
   const plaidClient = new PlaidApi(config);

   // Example: /transactions/sync
   const response = await plaidClient.transactionsSync({
     access_token: accessToken,
     cursor: lastCursor ?? undefined,
     count: 100,
   });

   const { added, modified, removed, next_cursor, has_more } = response.data;
   ```

4. **Note the authentication tiers.** Different endpoints require different credentials:

   | Auth level | What you need | Example endpoints |
   |------------|---------------|-------------------|
   | Client credentials | `PLAID-CLIENT-ID` + `PLAID-SECRET` headers | `/link/token/create`, `/institutions/search`, `/sandbox/*` |
   | Access token | `access_token` in request body | `/transactions/sync`, `/accounts/get`, `/item/remove` |
   | Webhook verification | JWK from `/webhook_verification_key/get` | Incoming webhook POST validation |

5. **State rate limits** where relevant:

   | Endpoint | Limit |
   |----------|-------|
   | `/transactions/sync` | 15 requests/min per item |
   | `/transactions/get` | 15 requests/min per item |
   | `/transactions/refresh` | 2 requests/day per item |
   | `/accounts/balance/get` | Institution-dependent (live query) |
   | Most other endpoints | No published limit |

6. **Base URLs** by environment:

   | Environment | Base URL |
   |-------------|----------|
   | Sandbox | `https://sandbox.plaid.com` |
   | Development | `https://development.plaid.com` |
   | Production | `https://production.plaid.com` |

## Key References

- [Plaid API documentation](https://plaid.com/docs/api/)
- [API quickstart](https://plaid.com/docs/quickstart/)
- [Plaid Node SDK](https://github.com/plaid/plaid-node)
- [Plaid Python SDK](https://github.com/plaid/plaid-python)
- [Error reference](https://plaid.com/docs/errors/)

## Example Interaction

**User:** "What parameters does /transactions/sync accept?"

**Agent:**

1. Looks up the `/transactions/sync` endpoint
2. Shows that it requires `access_token` (string) in the request body
3. Lists optional parameters:
   - `cursor` (string) - pagination cursor from a previous response
   - `count` (integer, default 100, max 500) - number of transactions per page
   - `options.include_personal_finance_category` (boolean) - include detailed categories
   - `options.include_logo_and_counterparty_beta` (boolean) - include merchant logos
4. Describes the response shape:

   ```typescript
   interface TransactionsSyncResponse {
     added: Transaction[];
     modified: Transaction[];
     removed: RemovedTransaction[];
     next_cursor: string;
     has_more: boolean;
     request_id: string;
   }
   ```

5. Notes: rate limited to 15 requests/min per item. Loop while `has_more === true`, persisting `next_cursor` between calls.

**User:** "How do I look up an institution by routing number?"

**Agent:**

1. Points to `/institutions/search` with `options.routing_numbers`
2. Shows the code:

   ```typescript
   const response = await plaidClient.institutionsSearch({
     query: "",
     products: null,
     country_codes: [CountryCode.Us],
     options: {
       routing_numbers: ["021000021"],
       include_optional_metadata: true,
     },
   });
   ```

3. Notes: the `query` field can be empty when filtering by routing number

## MCP Usage

| Step | MCP Tool | Description |
|------|----------|-------------|
| Look up endpoint | `plaid_getApiEndpoint` | Get full documentation for any Plaid API endpoint by path or keyword |
| List products | `plaid_listProducts` | List all Plaid products with descriptions and pricing tiers |
| List webhooks | `plaid_listWebhookTypes` | Browse all webhook types and codes with payload descriptions |
| Search institutions | `plaid_searchInstitutions` | Search institutions by name, products, and country |
| Browse categories | `plaid_listCategories` | Browse the personal_finance_category taxonomy |

## Common Pitfalls

1. **Using deprecated endpoints** - `/transactions/get` is deprecated in favor of `/transactions/sync`. The sync endpoint is cursor-based and handles added, modified, and removed transactions in one call.
2. **Missing required headers** - all Plaid API requests need `PLAID-CLIENT-ID` and `PLAID-SECRET` in headers (or `client_id` and `secret` in the request body). The Node SDK handles this automatically.
3. **Wrong environment base URL** - sandbox, development, and production use different base URLs. Always set `PLAID_ENV` and build the client config from it.
4. **Ignoring `has_more`** - `/transactions/sync` paginates. If `has_more` is true, you must call again with the returned `next_cursor` to get all data.
5. **Confusing access_token auth with client credentials** - some endpoints like `/link/token/create` use client credentials, while others like `/transactions/sync` need an `access_token`. Mixing them up returns auth errors.

## See Also

- [Plaid Error Handling](../plaid-error-handling/SKILL.md) - handle API error responses
- [Plaid Link Setup](../plaid-link-setup/SKILL.md) - the starting point for most API integrations
- [Plaid Transaction Sync](../plaid-transaction-sync/SKILL.md) - the most commonly used endpoint
- [Plaid Institution Search](../plaid-institution-search/SKILL.md) - search institutions by name or routing number
