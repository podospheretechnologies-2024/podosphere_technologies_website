# Podo Social: how the code is organised

Podo Social is **one Next.js 16 app** that contains both the frontend and the backend,
plus a separate **worker** process for background jobs. There is no separate API server:
the backend is the `src/app/api/**` route handlers and the `server/` folders they call.

```
Browser ──▶ Next.js app (pm2: podo-social, port 3100)
              ├── pages + React components        ← FRONTEND
              └── /api/* route handlers           ← BACKEND
                     │
                     ├── MySQL  (Prisma)
                     └── Redis  (BullMQ queues) ──▶ Worker (pm2: podo-social-worker)
                                                    publishes posts, refreshes tokens, runs autoposts
```

## Frontend vs backend at a glance

**Rule of thumb:** anything under `src/app/api/` or inside a `server/` folder is backend.
Everything else is frontend. Backend files start with `import 'server-only';`, so the build
fails if frontend code ever imports them by mistake.

| Layer | Where | What lives there |
|---|---|---|
| Frontend: pages | `src/app/(marketing)/` | Landing page, `/privacy`, `/terms`, `/data-deletion` (public) |
| | `src/app/(auth)/` | `/login`, `/register` |
| | `src/app/(dashboard)/` | `/dashboard` and `/dashboard/social/*` (calendar, media, AI, channels, automation, analytics, settings) |
| Frontend: UI | `src/modules/<module>/components/` | Feature components (composer, calendar, media library, ...) |
| | `src/shared/components/` | Reusable UI: `ui/` (button, card, input...), `layout/` (dashboard shell, nav), `motion/` |
| Frontend: data | `src/modules/social/hooks/` | `useSWR` hooks that **read** from the API (`usePostsList`, `useChannels`, ...) |
| | `src/modules/social/lib/*.client.ts` | Functions that **write** to the API (`savePost`, `deletePostGroup`, ...) |
| Shared | `src/modules/social/types/`, `config/` | TypeScript types and constants used by both sides |
| Backend: API | `src/app/api/auth/*` | Login, logout, register, current user |
| | `src/app/api/social/*` | Posts, media, AI, integrations (OAuth), sets, signatures, tags, webhooks, autoposts |
| | `src/app/api/health` | Health check |
| Backend: logic | `src/modules/social/server/<feature>/` | `*.schema.ts` (zod validation), `*.service.ts` (business logic), `*.repository.ts` (database queries) |
| | `src/modules/auth/server/` | Password hashing, signed session cookie |
| Backend: infra | `src/shared/lib/` | `prisma.ts`, `redis.ts`, `queue.ts`, `crypto.ts`, `env.ts` |
| | `src/shared/server/` | `current-organization.ts`, `http-error.ts`, safe outbound fetch |
| Database | `prisma/schema/*.prisma`, `prisma/migrations/` | Table definitions and migrations (MySQL) |
| Background jobs | `src/worker/index.ts` | Starts the publish + automation workers (BullMQ) |
| Login guard | `src/proxy.ts` | Redirects `/dashboard/*` to `/login` when there is no session cookie |

## How one request flows (example: the posts list)

1. **Page** `src/app/(dashboard)/dashboard/social/calendar/page.tsx` renders the calendar component.
2. **Hook** `usePostsList()` in `src/modules/social/hooks/use-posts.ts` calls `GET /api/social/posts?page=1`.
3. **Route** `src/app/api/social/posts/route.ts`:
   - gets the logged-in user's organization (`getCurrentOrganization()`),
   - validates the query with `listPostsQuerySchema` (`post.schema.ts`),
   - calls `postService.list(...)`.
4. **Service** `post.service.ts` applies the business rules and calls `post.repository.ts`.
5. **Repository** runs the Prisma query against MySQL, always filtered by `organizationId`.
6. The JSON goes back to the hook, and SWR caches it and re-renders the page.

Writes go the same way, using `savePost()` in `src/modules/social/lib/posts.client.ts`
(`POST /api/social/posts`). After a write, the client calls `revalidatePosts()` so every screen refreshes.

## Background jobs (the worker)

Scheduled posts can't be published inside a web request, so:

1. The API saves the post and adds a job to a **Redis queue** (`publishing/publish.queue.ts`).
2. The **worker** (`pnpm worker`, running in pm2 as `podo-social-worker`) picks up the job
   (`publishing/publish.worker.ts`) and publishes to Facebook, Instagram or LinkedIn at the right time.
3. Repeating jobs also run there: `sweep-posts` (due posts), `refresh-tokens` (platform tokens),
   and `autopost-sweep` (RSS autoposts, in `automation/automation.worker.ts`).

If you add background work, put it in a `*.worker.ts` inside the module and start it from `src/worker/index.ts`.

## Where do I add...?

| I want to add... | Put it in |
|---|---|
| A new page | `src/app/(dashboard)/dashboard/social/<name>/page.tsx` (plus a nav entry in `modules/social/config/navigation.ts`) |
| A new API endpoint | `src/app/api/social/<name>/route.ts`. Keep it thin: validate → call a service → return JSON |
| Business logic | `src/modules/social/server/<feature>/<feature>.service.ts` |
| A database query | `src/modules/social/server/<feature>/<feature>.repository.ts` (always scope by `organizationId`) |
| A new table or column | `prisma/schema/*.prisma`, then `pnpm db:migrate` (creates a migration, commit it) |
| Reading data in a component | A hook in `src/modules/social/hooks/` using `useSWR` |
| A button that saves something | A function in `src/modules/social/lib/<feature>.client.ts` using `apiFetch` |
| A reusable UI element | `src/shared/components/ui/` |
| A new social platform | A provider in `src/modules/social/server/integrations/providers/<platform>/`, registered in `integrations/core/integration.registry.ts` |
| A new env variable | `.env.example` (empty value) plus the zod schema in `src/shared/lib/env.ts` |

## Run it locally

```bash
docker compose up -d        # MySQL (3307), Redis (6381), phpMyAdmin (8086)
cp .env.example .env        # then fill SESSION_SECRET / ENCRYPTION_KEY (openssl rand -hex 32)
pnpm install
pnpm db:deploy && pnpm db:seed
pnpm dev                    # app on http://localhost:3000
pnpm worker                 # in a second terminal, for scheduled posts
```

## Update production (Lightsail, `/var/www/podo-social`)

```bash
cd /var/www/podo-social
git pull
pnpm install
pnpm db:deploy                                   # apply new migrations (safe to run every time)
NODE_OPTIONS="--max-old-space-size=1536" pnpm build
pm2 restart podo-social podo-social-worker
```

Production runs behind nginx at `https://social.podospheretechnologies.com` → `127.0.0.1:3100`.
Secrets live only in `/var/www/podo-social/.env` on the server and are never committed.
