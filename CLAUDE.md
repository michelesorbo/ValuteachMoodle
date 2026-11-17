# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

NewLMS: single-organization LMS (Next.js 16 App Router, TypeScript, PostgreSQL + Drizzle, Better Auth, next-intl, Tailwind 4). README and docs are in Italian; the full MVP plan is in `PLAN/plan.md`. Deploy guide: `docs/deploy-coolify.md`.

`AGENTS.md` warns that this Next.js version has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code.

## Commands

Package manager is pnpm (Node 22, Docker needed for the DB).

- `cp .env.example .env` (set `BETTER_AUTH_SECRET`, `SEED_ADMIN_*`), then `pnpm db:up`, `pnpm db:migrate`, `pnpm seed:admin`, `pnpm dev`
- `pnpm typecheck` (runs `next typegen` first), `pnpm lint`, `pnpm test` (Vitest, only `modules/**/*.test.ts` and `db/**/*.test.ts`)
- Single test: `pnpm vitest run modules/progress/video.test.ts` (add `-t "name"` to filter)
- `pnpm db:generate` after editing `db/schema`; `pnpm db:migrate` to apply. After changing Better Auth plugins run `pnpm auth:schema` (regenerates `db/schema/auth.ts`)
- `pnpm seed:dev` creates `docente@newlms.test` / `studente@newlms.test`; `pnpm fixture:scorm` builds the SCORM test zip
- `pnpm e2e`: Playwright against a production build on port 3100 with a dedicated `newlms_e2e` DB; needs the dev DB up and Google Chrome installed (H.264 video)

## Architecture

Feature code lives in `modules/*` (auth, courses, progress, files, scorm, i18n, config, shared); `app/` holds pages/routes; `db/` holds the Drizzle schema and SQL migrations. Unit tests sit next to the code.

- **Permissions are per call site.** Every page, server action and route handler must call `requireUser()` / `requireAdmin()` (`modules/auth/session.ts`); the layout does not protect anything. Course pages/actions get the course via `getViewableCourse()` / `getManageableCourse()` (`modules/courses/access.ts`), which 404 when access is denied. Rules live in `modules/courses/permissions.ts`.
- **Roles are data, scopes are code.** The catalog of scopes is `modules/auth/scopes.ts` (global: `users:manage`, `roles:manage`, `courses:create`; course: `course:view|learn|manage|delete|enrollments:manage|enrollments:assign-privileged`). Roles (`role` + `role_scope` tables, kind `global` or `course`) are created in `/admin/roles`; built-ins are Amministratore (scopes computed in code: all but `course:learn`), Docente, Studente. Global roles go to users (`user_role`), course roles to enrollments (`enrollment.role_id`); scopes can also be assigned directly (`user_scope`, `enrollment_scope`). Course scopes held globally apply to every course. Use `requireScope()` for global checks and `getCourseScopes()` (via `getCourseContext`) for course ones; nobody can grant privileged scopes they don't hold (`canGrant`). Better Auth's `user.role` column is no longer used for authorization.
- **Cache Components:** session-reading content in authenticated pages (`app/(app)/`) must be wrapped in `<Suspense fallback={<PageFallback />}>`.
- **Two origins, one server.** SCORM content is third-party code, so `proxy.ts` splits hosts: on `SCORM_ORIGIN` only `/scorm/*` exists; on the app host `/scorm/*` is 404. Because the origins are same-*site*, any mutating endpoint must check `isAppOriginRequest` (`modules/scorm/origin.ts`). SCORM player access uses signed 4h tokens (user + lesson); player and tracking re-check enrollment in the DB. Only SCORM 1.2, first SCO only, one attempt per user.
- **Files/videos are never served statically.** Downloads go through `/api/files/[id]` (always as attachment) and video through `/api/videos/[id]` (range requests), both after an enrollment check. Storage is on disk under `FILES_DIR` (`modules/files`). Video completion is the server-side union of reported played intervals (90% rule in `modules/progress/video.ts`), so seeking forward doesn't count.
- **i18n:** no user-visible strings in code; everything goes in `messages/it.json`.
- **Users:** public sign-up is disabled; admins create accounts at `/admin/users`.
- **Env:** variables are validated in `modules/config/env.ts`; the container entrypoint runs migrations and seeds the first admin (see `Dockerfile`, output is `standalone`). Health check: `GET /api/health`.
