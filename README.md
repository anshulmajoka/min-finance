# Mint Finance

A small Next.js app that connects bank accounts with [Plaid Link](https://plaid.com/docs/link/) and lists transactions (date, merchant, amount, account, institution). Linked institutions and transactions are stored in MongoDB. Later refreshes use Plaid's transactions sync cursor, so only new, changed, or removed transactions are fetched.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Official Plaid Node client + `react-plaid-link`
- MongoDB (`mongodb` driver) for institutions, sync cursors, and transactions

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
| `MONGODB_URI` | Yes in production | Connection string. In development the app uses `mongodb://127.0.0.1:27017` when this is unset |
| `MONGODB_DB` | No (default `mint_finance`) | Database name |
| `ALLOWED_EMAILS` | Yes | Exactly two comma-separated email addresses allowed to sign in |
| `BETTER_AUTH_SECRET` | Yes | Random secret of at least 32 characters; keep it private |
| `BETTER_AUTH_URL` | Recommended | Canonical app origin (for local development, `http://localhost:4317`) |

Run MongoDB locally (Community Server on port 27017) or set `MONGODB_URI` to a MongoDB Atlas connection string. Outside production, an unset `MONGODB_URI` uses `mongodb://127.0.0.1:27017`.

Without Plaid credentials or a reachable database the app still starts and shows a setup panel.

## Run

```bash
npm run dev -- --port 4317
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317).

## Authentication setup

Set the two permitted addresses and a private auth secret in `.env.local` (or your production secret manager). Start MongoDB, then run:

```bash
npm run auth:setup-users
```

The command prompts for each password without echoing it and stores only Better Auth's password hash. It creates missing accounts for `ALLOWED_EMAILS`; existing accounts are left unchanged. Passwords must be 12–128 characters. Public signup is disabled.

For production, use the same setup command as a one-time deployment task against the production MongoDB database. Set a unique random `BETTER_AUTH_SECRET`, the two exact `ALLOWED_EMAILS`, `BETTER_AUTH_URL` to the canonical HTTPS origin, and MongoDB credentials in the deployment environment. Do not commit `.env.local` or send auth secrets to the browser.

After signing in, Plaid Sandbox's test login remains `user_good` / `pass_good` when you connect a bank.

## API routes

- `GET /api/plaid/status` — Plaid, MongoDB, and linked institutions
- `POST /api/plaid/create-link-token` — create Link token
- `POST /api/plaid/exchange-public-token` — exchange public token, store the institution, and run the first sync
- `GET /api/plaid/transactions` — read saved transactions (syncs an institution only if it has never synced)
- `POST /api/plaid/transactions` — incremental sync, then return saved transactions
- `POST /api/plaid/disconnect` — remove every institution, or `{ "itemId": "..." }` to remove one

Better Auth stores sessions in MongoDB and sends the browser an HTTP-only session cookie. Plaid access tokens and sync cursors remain in MongoDB. The two authorized accounts continue to use the existing shared finance dataset.
