---
name: plaid-nextjs-integration
description: Integrate Plaid into Next.js apps with App Router API routes, middleware auth, server-side token exchange, and webhook route handlers. Use when the user is building a Next.js app with Plaid.
standards-version: 1.10.0
---

# Plaid Next.js Integration

## Trigger

Use this skill when the user:

- Is building a Next.js app with Plaid integration
- Needs App Router API routes for Plaid endpoints
- Wants middleware authentication for Plaid routes
- Is setting up server-side token exchange
- Needs webhook route handlers in Next.js
- Wants server actions for Plaid operations

## Required Inputs

- **Next.js version**: 13+ with App Router (Pages Router patterns noted where different)
- **Auth solution**: NextAuth, Clerk, Auth0, or custom session
- **Products**: Which Plaid products to integrate

## Workflow

1. **Server-only Plaid client.** Create a shared module that never ships to the browser:

   ```typescript
   // lib/plaid.ts
   import "server-only";
   import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

   const config = new Configuration({
     basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
     baseOptions: {
       headers: {
         "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
         "PLAID-SECRET": process.env.PLAID_SECRET!,
       },
     },
   });

   export const plaidClient = new PlaidApi(config);
   ```

   The `"server-only"` import causes a build error if this file is ever imported from a client component.

2. **Create Link token route.** App Router route handler:

   ```typescript
   // app/api/plaid/create-link-token/route.ts
   import { NextResponse } from "next/server";
   import { plaidClient } from "@/lib/plaid";
   import { Products, CountryCode } from "plaid";
   import { getServerSession } from "@/lib/auth"; // your auth solution

   export const runtime = "nodejs"; // Plaid SDK requires Node, not Edge

   export async function POST(request: Request) {
     const session = await getServerSession();
     if (!session?.user?.id) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
     }

     const response = await plaidClient.linkTokenCreate({
       user: { client_user_id: session.user.id },
       client_name: "My App",
       products: [Products.Transactions],
       country_codes: [CountryCode.Us],
       language: "en",
       redirect_uri: process.env.PLAID_REDIRECT_URI,
     });

     return NextResponse.json({ link_token: response.data.link_token });
   }
   ```

3. **Exchange token route.** Convert the public token to an access token and store it:

   ```typescript
   // app/api/plaid/exchange-token/route.ts
   import { NextResponse } from "next/server";
   import { plaidClient } from "@/lib/plaid";
   import { getServerSession } from "@/lib/auth";
   import { db } from "@/lib/db";
   import { encrypt } from "@/lib/crypto";

   export const runtime = "nodejs";

   export async function POST(request: Request) {
     const session = await getServerSession();
     if (!session?.user?.id) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
     }

     const { public_token } = await request.json();
     if (!public_token) {
       return NextResponse.json({ error: "Missing public_token" }, { status: 400 });
     }

     const response = await plaidClient.itemPublicTokenExchange({
       public_token,
     });

     await db.plaidItem.create({
       data: {
         userId: session.user.id,
         itemId: response.data.item_id,
         accessToken: encrypt(response.data.access_token),
       },
     });

     return NextResponse.json({ item_id: response.data.item_id });
   }
   ```

4. **Webhook route handler.** Receive and verify Plaid webhooks:

   ```typescript
   // app/api/plaid/webhook/route.ts
   import { NextResponse } from "next/server";
   import { createHash } from "crypto";
   import { plaidClient } from "@/lib/plaid";

   export const runtime = "nodejs";

   export async function POST(request: Request) {
     const body = await request.text();
     const verification = request.headers.get("plaid-verification");

     if (!verification) {
       return NextResponse.json({ error: "Missing verification" }, { status: 400 });
     }

     // Verify the webhook signature
     const [headerB64, claimsB64] = verification.split(".");
     const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
     const claims = JSON.parse(Buffer.from(claimsB64, "base64url").toString());

     const bodyHash = createHash("sha256").update(body).digest("hex");
     if (claims.request_body_sha256 !== bodyHash) {
       return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
     }

     const payload = JSON.parse(body);

     switch (payload.webhook_type) {
       case "TRANSACTIONS":
         await handleTransactionWebhook(payload);
         break;
       case "ITEM":
         await handleItemWebhook(payload);
         break;
     }

     return NextResponse.json({ received: true });
   }

   async function handleTransactionWebhook(payload: any) {
     if (payload.webhook_code === "SYNC_UPDATES_AVAILABLE") {
       // Trigger a transaction sync for this item
     }
   }

   async function handleItemWebhook(payload: any) {
     if (payload.webhook_code === "ERROR") {
       // Mark item as needing reconnection
     }
   }
   ```

5. **Middleware auth for Plaid routes.** Protect all `/api/plaid/*` routes:

   ```typescript
   // middleware.ts
   import { NextResponse } from "next/server";
   import type { NextRequest } from "next/server";
   import { getToken } from "next-auth/jwt";

   export async function middleware(request: NextRequest) {
     // Skip webhook route (authenticated by Plaid signature, not user session)
     if (request.nextUrl.pathname === "/api/plaid/webhook") {
       return NextResponse.next();
     }

     const token = await getToken({ req: request });
     if (!token) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
     }

     return NextResponse.next();
   }

   export const config = {
     matcher: "/api/plaid/:path*",
   };
   ```

6. **Server action for transaction sync.** Fetch data without a dedicated API route:

   ```typescript
   // app/actions/plaid.ts
   "use server";
   import { plaidClient } from "@/lib/plaid";
   import { getServerSession } from "@/lib/auth";
   import { db } from "@/lib/db";
   import { decrypt } from "@/lib/crypto";

   export async function syncTransactions(itemId: string) {
     const session = await getServerSession();
     if (!session?.user?.id) throw new Error("Unauthorized");

     const item = await db.plaidItem.findUnique({
       where: { itemId, userId: session.user.id },
     });
     if (!item) throw new Error("Item not found");

     const accessToken = decrypt(item.accessToken);
     let cursor = item.transactionCursor ?? undefined;
     let hasMore = true;

     while (hasMore) {
       const response = await plaidClient.transactionsSync({
         access_token: accessToken,
         cursor,
       });

       // Process added, modified, removed transactions
       await db.transaction.createMany({
         data: response.data.added.map((tx) => ({
           plaidItemId: item.id,
           transactionId: tx.transaction_id,
           amount: tx.amount,
           name: tx.name,
           date: tx.date,
           category: tx.personal_finance_category?.primary,
         })),
         skipDuplicates: true,
       });

       cursor = response.data.next_cursor;
       hasMore = response.data.has_more;
     }

     await db.plaidItem.update({
       where: { itemId },
       data: { transactionCursor: cursor },
     });

     return { synced: true };
   }
   ```

7. **Edge runtime caveat.** The Plaid Node SDK uses Node.js APIs (`http`, `https`, `crypto`). Every route that imports `lib/plaid.ts` must set:

   ```typescript
   export const runtime = "nodejs";
   ```

   Without this, Vercel may deploy the route to Edge, which will fail at runtime.

## File Structure

```
app/
  api/
    plaid/
      create-link-token/route.ts
      exchange-token/route.ts
      webhook/route.ts
  actions/
    plaid.ts
lib/
  plaid.ts           # server-only Plaid client
  auth.ts            # your auth helpers
  crypto.ts          # encrypt/decrypt for access tokens
  db.ts              # database client
middleware.ts        # auth guard for /api/plaid/*
```

## Key References

- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Plaid quickstart](https://github.com/plaid/quickstart)
- [server-only package](https://www.npmjs.com/package/server-only)

## Example Interaction

**User:** "Set up Plaid API routes in my Next.js App Router project with authentication."

**Agent:**
1. Creates `lib/plaid.ts` with server-only client configuration
2. Creates `app/api/plaid/create-link-token/route.ts` with session auth
3. Creates `app/api/plaid/exchange-token/route.ts` with encrypted token storage
4. Creates `app/api/plaid/webhook/route.ts` with signature verification
5. Adds middleware to protect all Plaid routes except the webhook endpoint
6. Notes: "Add `export const runtime = 'nodejs'` to every route - the Plaid SDK does not run in Edge"

## MCP Usage

| Step | MCP Tool | Description |
|------|----------|-------------|
| Create Link token | `plaid_createLinkToken` | Compare your route output against MCP output |
| Create sandbox item | `plaid_createSandboxItem` | Skip the Link UI during backend testing |
| Sync transactions | `plaid_syncTransactions` | Verify sync logic matches MCP results |
| Update webhook | `plaid_updateItemWebhook` | Point webhooks to your ngrok/tunnel URL |
| Verify webhook | `plaid_verifyWebhookSignature` | Test signature verification logic |
| Fire webhook | `plaid_fireSandboxWebhook` | Trigger test webhooks to your route |

## Common Pitfalls

1. **Using Edge runtime** - the Plaid Node SDK requires `runtime = "nodejs"`. Without it, routes deployed to Vercel Edge will crash on `require('http')`.
2. **Importing `lib/plaid.ts` in client components** - the `"server-only"` import prevents this at build time. If you skip that import, Plaid credentials leak into the client bundle.
3. **Missing webhook route** - Next.js needs an explicit `POST` handler exported from a route file. Plaid webhooks will 404 without it.
4. **No auth on webhook route** - the webhook route is called by Plaid servers, not by a logged-in user. Authenticate it via the `Plaid-Verification` header, not via session middleware.
5. **Storing access tokens unencrypted** - encrypt before writing to the database. The `plaid-token-storage` rule catches this pattern.
6. **Forgetting `redirect_uri`** - OAuth institutions (Chase, Capital One, etc.) require a registered redirect URI. Set `PLAID_REDIRECT_URI` and register it in the Plaid Dashboard.

## See Also

- [Plaid React Integration](../plaid-react-integration/SKILL.md) - client-side React components for Link
- [Plaid Link Setup](../plaid-link-setup/SKILL.md) - foundational Link integration
- [Plaid Webhook Handling](../plaid-webhook-handling/SKILL.md) - webhook verification patterns
- [Plaid Transaction Sync](../plaid-transaction-sync/SKILL.md) - cursor-based sync patterns
