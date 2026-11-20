# Setup

1. Copy `.env.example` to `.env`.
2. Start Postgres, Redis, and Mailpit with `docker compose up -d postgres redis mailpit`.
3. `npm install`
4. `npm run db:setup`
5. `npm run dev`

The web app reads `VITE_API_URL`. Cookies are HTTP-only for the refresh token. In production set `secure` by running with `NODE_ENV=production`, and put a real origin in `WEB_ORIGIN` and `APP_URL`.

## Jobs and mail

Leave `JOBS_DRIVER=inprocess` when Redis is not running. Compose sets `JOBS_DRIVER=bullmq` for the API container. Mail without `SMTP_HOST` is printed by the API. Mailpit uses host `mailpit` and port `1025` inside Compose, or `localhost:1025` from the host.

## Stripe

Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, and `STRIPE_PRICE_BUSINESS` with test-mode values. Forward events to `http://localhost:4000/api/v1/billing/webhook`. Leave the secrets empty to keep the labeled demo billing mode.

## Object storage

`STORAGE_DRIVER=local` writes under `UPLOAD_DIR`. The `S3FileStorage` class is the extension point for an S3-compatible bucket (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`).

## Tests

`TEST_DATABASE_URL` must contain `_test`. The test setup creates that database if Postgres is reachable, applies migrations, and truncates between cases.
