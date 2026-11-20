# Database

PostgreSQL is accessed through Prisma. Primary keys are UUIDs. Tenant-owned models carry `workspaceId`, foreign keys, and indexes for the common filters (workspace plus status, assignee, or due date).

Models: User, Workspace, WorkspaceMember, Invitation, Project, ProjectMember, Board, BoardColumn, Task, TaskLabel, TaskLabelAssignment, Sprint, SprintTask, Comment, Attachment, ActivityLog, Notification, Subscription, Plan, Webhook, WebhookEvent, RefreshToken. PasswordResetToken and EmailVerificationToken support the account flows.

Projects, tasks, comments, users, and workspaces use `deletedAt` where a soft delete is safer than removing history. Deleting a workspace or project rewrites the unique slug or key so the name can be used again.

Activity rows are insert-only. There is no API to edit or delete them.

The migration lives in `apps/api/prisma/migrations`. `npm run db:seed` loads plans, Acme Studio, Northwind, projects, sprints, tasks, comments, and activity. It refuses to run when `NODE_ENV=production` unless `SEED_DEMO=true`.
