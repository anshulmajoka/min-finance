# Mint Finance

A small Next.js app that connects a bank account with [Plaid Link](https://plaid.com/docs/link/) and lists recent transactions (date, merchant, amount, account).

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Official Plaid Node client + `react-plaid-link`

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` with Sandbox keys from the [Plaid Dashboard](https://dashboard.plaid.com/):

| Variable | Required | Description |
| --- | --- | --- |
| `PLAID_CLIENT_ID` | Yes | Plaid client ID |
| `PLAID_SECRET` | Yes | Sandbox secret |
| `PLAID_ENV` | No (default `sandbox`) | `sandbox`, `development`, or `production` |
| `PLAID_PRODUCTS` | No (default `transactions`) | Comma-separated products |
| `NEXT_PUBLIC_PLAID_ENV` | No | Browser-facing env hint |

Without credentials the app still starts and shows a setup panel. Live Link requires sandbox keys.

## Run

```bash
npm run dev -- --port 4317
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317).

## Sandbox test login

1. Click **Connect a bank account**
2. Pick any institution in Plaid Link
3. Sign in with `user_good` / `pass_good`
4. Transactions load via `/transactions/sync` (with a `/transactions/get` fallback)

## API routes

- `GET /api/plaid/status` — credential + connection status
- `POST /api/plaid/create-link-token` — create Link token
- `POST /api/plaid/exchange-public-token` — exchange public token; stores access token in an httpOnly cookie
- `GET /api/plaid/transactions` — sync/list transactions
- `POST /api/plaid/disconnect` — clear the local session cookie

Access tokens are stored only in httpOnly cookies for this demo. Use a real datastore before production.
