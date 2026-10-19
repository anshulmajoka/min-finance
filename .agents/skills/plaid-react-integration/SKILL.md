---
name: plaid-react-integration
description: Integrate Plaid Link into React apps using react-plaid-link hooks, error boundaries, loading states, and context providers. Use when the user is building a React frontend with Plaid.
standards-version: 1.10.0
---

# Plaid React Integration

## Trigger

Use this skill when the user:

- Is building a React app that integrates Plaid Link
- Needs `react-plaid-link` hook patterns beyond basic setup
- Wants context providers for managing Plaid state
- Needs error boundaries for Link failures
- Is handling loading states during token creation and exchange
- Wants reusable Plaid components
- Needs to reconnect broken items (update mode)

## Required Inputs

- **React version**: React 18+ (hooks required)
- **Products**: Which Plaid products to request (`transactions`, `auth`, `identity`, etc.)
- **Backend**: An API route that creates Link tokens and exchanges public tokens

## Workflow

1. **Install `react-plaid-link`.** The official React binding for Plaid Link:

   ```bash
   npm install react-plaid-link
   ```

2. **Fetch a Link token from your backend.** Create a hook that fetches once and caches:

   ```tsx
   import { useState, useEffect } from "react";

   export function useLinkToken() {
     const [linkToken, setLinkToken] = useState<string | null>(null);
     const [error, setError] = useState<Error | null>(null);

     useEffect(() => {
       let cancelled = false;
       fetch("/api/plaid/create-link-token", { method: "POST" })
         .then((res) => {
           if (!res.ok) throw new Error(`HTTP ${res.status}`);
           return res.json();
         })
         .then((data) => {
           if (!cancelled) setLinkToken(data.link_token);
         })
         .catch((err) => {
           if (!cancelled) setError(err);
         });
       return () => { cancelled = true; };
     }, []);

     return { linkToken, error };
   }
   ```

3. **Use `usePlaidLink`.** The hook accepts a config object and returns `open`, `ready`, `error`, and `exit`:

   ```tsx
   import { usePlaidLink } from "react-plaid-link";

   interface PlaidLinkButtonProps {
     linkToken: string;
     onSuccess: (publicToken: string, metadata: any) => void;
   }

   export function PlaidLinkButton({ linkToken, onSuccess }: PlaidLinkButtonProps) {
     const { open, ready, error } = usePlaidLink({
       token: linkToken,
       onSuccess: (publicToken, metadata) => {
         onSuccess(publicToken, metadata);
       },
       onExit: (err, metadata) => {
         if (err) {
           console.error("Link exit error:", err.error_code, err.error_message);
         }
       },
       onEvent: (eventName, metadata) => {
         // Track events: OPEN, HANDOFF, EXIT, ERROR, etc.
       },
     });

     if (error) return <p>Link error: {error.message}</p>;

     return (
       <button onClick={() => open()} disabled={!ready}>
         {ready ? "Connect Bank Account" : "Loading..."}
       </button>
     );
   }
   ```

4. **Handle the token exchange.** Send the public token to your backend after success:

   ```tsx
   async function handleSuccess(publicToken: string) {
     try {
       const res = await fetch("/api/plaid/exchange-token", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ public_token: publicToken }),
       });
       if (!res.ok) throw new Error(`Exchange failed: ${res.status}`);
       const data = await res.json();
       // data.item_id is safe to store client-side
       // data.access_token stays server-side only
     } catch (err) {
       // Show user-facing error, offer retry
     }
   }
   ```

5. **PlaidContext provider.** Manage Link tokens and connected items across components:

   ```tsx
   import { createContext, useContext, useState, useCallback, ReactNode } from "react";

   interface PlaidContextValue {
     linkToken: string | null;
     items: string[];
     addItem: (itemId: string) => void;
     refreshLinkToken: () => Promise<void>;
   }

   const PlaidContext = createContext<PlaidContextValue | null>(null);

   export function PlaidProvider({ children }: { children: ReactNode }) {
     const [linkToken, setLinkToken] = useState<string | null>(null);
     const [items, setItems] = useState<string[]>([]);

     const refreshLinkToken = useCallback(async () => {
       const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
       const data = await res.json();
       setLinkToken(data.link_token);
     }, []);

     const addItem = useCallback((itemId: string) => {
       setItems((prev) => [...prev, itemId]);
     }, []);

     return (
       <PlaidContext.Provider value={{ linkToken, items, addItem, refreshLinkToken }}>
         {children}
       </PlaidContext.Provider>
     );
   }

   export function usePlaidContext() {
     const ctx = useContext(PlaidContext);
     if (!ctx) throw new Error("usePlaidContext must be used within PlaidProvider");
     return ctx;
   }
   ```

6. **Error boundary for Link crashes.** Wrap the Link component to catch rendering errors:

   ```tsx
   import { Component, ErrorInfo, ReactNode } from "react";

   interface Props { children: ReactNode; fallback?: ReactNode; }
   interface State { hasError: boolean; }

   export class PlaidErrorBoundary extends Component<Props, State> {
     state: State = { hasError: false };

     static getDerivedStateFromError(): State {
       return { hasError: true };
     }

     componentDidCatch(error: Error, info: ErrorInfo) {
       console.error("PlaidLink error:", error, info);
     }

     render() {
       if (this.state.hasError) {
         return this.props.fallback ?? <p>Something went wrong. Please refresh.</p>;
       }
       return this.props.children;
     }
   }
   ```

7. **Reconnection UI (update mode).** When an item's login breaks, create a new Link token in update mode:

   ```tsx
   // Backend: create Link token with access_token for update mode
   // POST /api/plaid/create-link-token { access_token: "access-sandbox-..." }

   // Frontend: same usePlaidLink hook, but the token triggers update mode
   function ReconnectButton({ updateToken }: { updateToken: string }) {
     const { open, ready } = usePlaidLink({
       token: updateToken,
       onSuccess: () => {
         // Item credentials updated, refresh data
       },
       onExit: (err) => {
         if (err) console.error("Reconnect failed:", err.error_code);
       },
     });

     return (
       <button onClick={() => open()} disabled={!ready}>
         Reconnect Account
       </button>
     );
   }
   ```

8. **TypeScript types.** Key types from `react-plaid-link`:

   ```typescript
   import type {
     PlaidLinkOnSuccess,
     PlaidLinkOnExit,
     PlaidLinkOnEvent,
     PlaidLinkOptions,
     PlaidLinkError,
   } from "react-plaid-link";

   // onSuccess receives (public_token: string, metadata: PlaidLinkOnSuccessMetadata)
   // onExit receives (error: PlaidLinkError | null, metadata: PlaidLinkOnExitMetadata)
   // onEvent receives (eventName: string, metadata: PlaidLinkOnEventMetadata)
   ```

## Key References

- [react-plaid-link](https://www.npmjs.com/package/react-plaid-link)
- [Plaid Link web](https://plaid.com/docs/link/web/)
- [Link update mode](https://plaid.com/docs/link/update-mode/)
- [Link events](https://plaid.com/docs/link/web/#onevent)

## Example Interaction

**User:** "I need a reusable React component for connecting bank accounts with Plaid that handles loading, errors, and success states."

**Agent:**
1. Creates `useLinkToken` hook that fetches and caches a Link token
2. Builds `PlaidLinkButton` using `usePlaidLink` with `onSuccess`, `onExit`, `onEvent`
3. Wraps it in `PlaidErrorBoundary` for crash recovery
4. Shows `handleSuccess` function that exchanges the public token server-side
5. Adds `PlaidProvider` context for managing multiple connected items
6. Notes: "Pre-fetch the Link token on mount so the button is immediately ready when clicked"

## MCP Usage

| Step | MCP Tool | Description |
|------|----------|-------------|
| Create Link token | `plaid_createLinkToken` | Test Link token creation during development |
| Create sandbox item | `plaid_createSandboxItem` | Create a test item without the Link UI |
| Get accounts | `plaid_getAccounts` | Verify connected accounts after token exchange |
| Get item status | `plaid_getItemStatus` | Check item health for reconnection testing |
| Remove item | `plaid_removeItem` | Clean up test items |

## Common Pitfalls

1. **Creating Link tokens on every render** - the `useLinkToken` hook should have `[]` deps so it fetches once. Link tokens are valid for 4 hours.
2. **Missing cleanup on unmount** - `usePlaidLink` handles cleanup internally, but your `useLinkToken` fetch needs a cancelled flag to avoid state updates on unmounted components.
3. **Not handling the ready state** - `open()` does nothing until `ready` is `true`. Disable the button until ready.
4. **Fire-and-forget token exchange** - the `onSuccess` callback must handle exchange failures with try/catch and show a user-facing error.
5. **Storing access tokens in React state** - access tokens must stay server-side. Only store `item_id` in the client.
6. **Forgetting update mode** - when an item's login expires (`ITEM_LOGIN_REQUIRED`), create a Link token with `access_token` to trigger update mode instead of creating a new item.

## See Also

- [Plaid Link Setup](../plaid-link-setup/SKILL.md) - foundational Link integration patterns
- [Plaid Next.js Integration](../plaid-nextjs-integration/SKILL.md) - Next.js-specific API routes and server patterns
- [Plaid Error Handling](../plaid-error-handling/SKILL.md) - handle Plaid API errors in callbacks
