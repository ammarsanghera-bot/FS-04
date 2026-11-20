# Architecture

Flowboard is an npm workspaces monorepo.

- `apps/web` is the React client.
- `apps/api` is the Express API. Routes call controllers, controllers call services, and tenant-owned queries go through scoped repository helpers.
- `packages/shared` holds Zod schemas, the permission matrix, plan limits, and status enums used by both sides.

## Tenancy

One PostgreSQL schema is shared by every workspace. Tenant-owned tables include `workspaceId`. The active tenant is the workspace id in the route, and only after `WorkspaceMember` confirms the caller belongs to it. A workspace id in a JSON body is ignored. If the client also sends `X-Workspace-Id`, it must match the route or the request is rejected.

Owners and admins can read every project in their workspace. Managers can too, because they run projects for that company. Members only receive projects where a `ProjectMember` row exists. Missing rows return 404 so another tenant's ids do not confirm that a record exists.

Administrators of workspace A are not members of workspace B and have no implicit access.

## Authentication

Passwords are hashed with bcrypt. Login returns a short-lived JWT access token and sets an HTTP-only `fb_refresh` cookie scoped to `/api/v1/auth`. Refresh rotates the stored hash. Logout revokes it. Reset and password change revoke outstanding refresh tokens.

Email verification and password reset links are delivered through the email sender. Without `SMTP_HOST`, messages are printed to the API log. Docker Compose points SMTP at Mailpit.

## Authorization

`hasPermission` in `@flowboard/shared` is the role matrix. `requirePermission` enforces it on the API. The UI hides some actions with the same helper, but that is not the control.

## Plans

Free allows 3 active projects, 5 members, and 100 tasks. Pro removes the project and task caps and allows 25 members plus advanced reports. Business removes the member cap and unlocks webhooks. Limits are checked in the service layer before a write.

## Files

`FileStorage` is the storage boundary. Development uses `LocalFileStorage` under `UPLOAD_DIR`. `S3FileStorage` is the adapter selected by `STORAGE_DRIVER=s3`; it stays inactive until an object-storage client is wired. Downloads stream through an authorized route. Attachment keys are never public URLs.

## Jobs

`JobQueue` is the background boundary. The default driver runs in process. `JOBS_DRIVER=bullmq` with `REDIS_URL` uses a BullMQ worker in the API process. If Redis is down, the API logs the failure and keeps the in-process queue. Deadline reminders and subscription period-end sweeps are scheduled there. A later split can move the worker into its own process without changing the handlers.

## Billing

Stripe secret keys stay on the API. Checkout and the customer portal are created server-side. Webhooks require `Stripe-Signature` verification. Without keys, the billing screen says it is in demo mode.
