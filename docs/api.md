# API

Base path: `/api/v1`. Authenticated calls send `Authorization: Bearer <access token>`. Tenant calls also live under `/workspaces/:workspaceId` and require membership.

Errors use `{ "error": { "code", "message", "details" } }`.

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `GET /auth/me`
- `PATCH /auth/me`
- `POST /auth/change-password`
- `GET /auth/sessions`
- `DELETE /auth/sessions/:sessionId`
- `POST /auth/avatar`
- `GET /auth/avatars/:userId`

## Workspaces and team

- `GET /workspaces`
- `POST /workspaces`
- `GET /workspaces/:workspaceId`
- `PATCH /workspaces/:workspaceId`
- `DELETE /workspaces/:workspaceId`
- `POST /workspaces/:workspaceId/switch`
- `GET|PATCH|DELETE /workspaces/:workspaceId/members/:memberId`
- `GET|POST /workspaces/:workspaceId/invitations`
- `POST /workspaces/:workspaceId/invitations/:invitationId/resend`
- `DELETE /workspaces/:workspaceId/invitations/:invitationId`
- `GET /invitations/preview?token=`
- `POST /invitations/accept`

## Projects, board, tasks

- `GET|POST /workspaces/:workspaceId/projects`
- `GET|PATCH|DELETE /workspaces/:workspaceId/projects/:projectId`
- `GET|POST /workspaces/:workspaceId/projects/:projectId/members`
- `DELETE /workspaces/:workspaceId/projects/:projectId/members/:userId`
- `GET /workspaces/:workspaceId/projects/:projectId/board`
- `GET|POST /workspaces/:workspaceId/projects/:projectId/tasks`
- `GET|PATCH|DELETE /workspaces/:workspaceId/tasks/:taskId`
- `POST /workspaces/:workspaceId/tasks/:taskId/move`
- `GET|POST /workspaces/:workspaceId/labels`

Board and task list filters: `search`, `assigneeId` (`me` or a user id), `priority`, `labelId`, `dueBefore`, `dueAfter`, `status`, `sprintId`.

## Sprints

- `GET|POST /workspaces/:workspaceId/sprints`
- `GET|PATCH /workspaces/:workspaceId/sprints/:sprintId`
- `POST /workspaces/:workspaceId/sprints/:sprintId/tasks`
- `DELETE /workspaces/:workspaceId/sprints/:sprintId/tasks/:taskId`
- `POST /workspaces/:workspaceId/sprints/:sprintId/start`
- `POST /workspaces/:workspaceId/sprints/:sprintId/complete`
- `GET /workspaces/:workspaceId/sprints/:sprintId/report`

## Collaboration

- `GET|POST /workspaces/:workspaceId/tasks/:taskId/comments`
- `PATCH|DELETE /workspaces/:workspaceId/comments/:commentId`
- `POST /workspaces/:workspaceId/tasks/:taskId/attachments`
- `GET /workspaces/:workspaceId/attachments/:attachmentId/download`
- `DELETE /workspaces/:workspaceId/attachments/:attachmentId`
- `GET /workspaces/:workspaceId/notifications`
- `POST /workspaces/:workspaceId/notifications/read-all`
- `POST /workspaces/:workspaceId/notifications/:notificationId/read`
- `GET /workspaces/:workspaceId/activity`

## Billing, reports, webhooks

- `GET /plans`
- `GET /workspaces/:workspaceId/billing`
- `POST /workspaces/:workspaceId/billing/checkout`
- `POST /workspaces/:workspaceId/billing/portal`
- `POST /workspaces/:workspaceId/billing/mock-activate`
- `POST /workspaces/:workspaceId/billing/cancel`
- `POST /billing/webhook` (raw body, Stripe signature)
- `GET /workspaces/:workspaceId/reports/dashboard`
- `GET|POST /workspaces/:workspaceId/webhooks`
- `DELETE /workspaces/:workspaceId/webhooks/:webhookId`
- `GET /health`
