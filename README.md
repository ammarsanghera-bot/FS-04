# FS-04 — Flowboard

Flowboard is the FS-04 submission: a multi-tenant project management platform. Each company gets a workspace with its own members, projects, boards, sprints, files, and subscription. A user in one workspace cannot read another workspace's records, even if they paste those IDs into the API.

## Stack

- React, TypeScript, Vite, Tailwind CSS, shadcn-style Radix components, TanStack Query, Zustand, React Hook Form, Zod, dnd-kit, Recharts
- Node.js, TypeScript, Express, Prisma, PostgreSQL
- JWT access tokens and HTTP-only refresh cookies
- Vitest, Supertest, React Testing Library
- Docker Compose, GitHub Actions

## Local demo accounts

These accounts exist only after you run the seed. Do not use them outside local development.

| Role | Email | Password |
| --- | --- | --- |
| Owner | owner@acme.flowboard.dev | Password123! |
| Admin | admin@acme.flowboard.dev | Password123! |
| Manager | manager@acme.flowboard.dev | Password123! |
| Member | member@acme.flowboard.dev | Password123! |
| Member | member2@acme.flowboard.dev | Password123! |
| Other tenant | outsider@northwind.flowboard.dev | Password123! |

Acme Studio is on the Pro plan. Northwind is a second tenant on Free, with a project members of Acme cannot open. A pending local invitation token is printed by the seed script.

## Run it

```bash
docker compose up -d postgres redis mailpit
copy .env.example .env
npm install
npm run db:setup
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000
- Mailpit: http://localhost:8025

`npm run db:setup` applies migrations and seeds the demo workspace.

The full stack, including the built web app on port 8080, is `docker compose up --build`.

## Billing

If `STRIPE_SECRET_KEY` is empty, billing stays in a labeled demo mode and plan changes are stored on the workspace. With test keys set, checkout, the billing portal, and signed webhooks are used. The webhook endpoint is `POST /api/v1/billing/webhook`.

## Tests

Tests refuse to run unless the database name contains `_test`.

```bash
npm test
```

## Continuous integration

The workflow file is `docs/ci-workflow.yml`. It starts Postgres 16, runs the test suite, and builds the web app. Copy it to `.github/workflows/ci.yml` to have GitHub Actions run it. A local copy is already at `.github/workflows/ci.yml`.

## Docs

- [Architecture](docs/architecture.md)
- [API](docs/api.md)
- [Database](docs/database.md)
- [Setup](docs/setup.md)
