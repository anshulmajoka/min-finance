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

Run MongoDB locally (Community Server on port 27017) or set `MONGODB_URI` to a MongoDB Atlas connection string. Outside production, an unset `MONGODB_URI` uses `mongodb://127.0.0.1:27017`.

Without Plaid credentials or a reachable database the app still starts and shows a setup panel.

## Run

```bash
npm run dev -- --port 4317
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317).

## Sandbox test login

1. Click **Connect a bank account**
2. Pick any institution in Plaid Link
3. Sign in with `user_good` / `pass_good`
4. The first sync stores transactions in MongoDB
5. Click **Add institution** to link another bank, then filter the list by institution
6. **Refresh** calls `/transactions/sync` with the saved cursor and upserts only the changes

## API routes

- `GET /api/plaid/status` — Plaid, MongoDB, and linked institutions
- `POST /api/plaid/create-link-token` — create Link token
- `POST /api/plaid/exchange-public-token` — exchange public token, store the institution, and run the first sync
- `GET /api/plaid/transactions` — read saved transactions (syncs an institution only if it has never synced)
- `POST /api/plaid/transactions` — incremental sync, then return saved transactions
- `POST /api/plaid/disconnect` — remove every institution, or `{ "itemId": "..." }` to remove one

An httpOnly cookie stores only a local user id. Access tokens and the Plaid sync cursor live in MongoDB.
