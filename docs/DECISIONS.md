# DECISIONS.md — Architecture decision log

Each decision: what we chose, why, what we considered, and the trade-off. This file is your interview preparation. Claude Code adds new entries as the build progresses.

Format for new entries:
```
## D-XX · Title
**Decision:** ...
**Why:** ...
**Alternatives considered:** ...
**Trade-off / what we'd change at scale:** ...
```

---

## D-01 · Generic, admin-defined asset types
**Decision:** Asset types are data, not code. An admin defines each type's fields; asset-specific values live in a JSONB `attributes` column.
**Why:** The problem is "infrastructure asset inventory", not "streetlight inventory". Government departments own thousands of kinds of assets; a new kind must not need a developer or a deployment. Platform thinking, like Aadhaar and UPI.
**Alternatives considered:** One table per asset type (strong typing, but every new type = migration + code); EAV table (flexible but slow and painful to query).
**Trade-off:** Custom fields are validated in application code rather than by database columns. A GIN index keeps JSONB searches fast.

## D-02 · Node.js + Express + TypeScript for the API
**Decision:** Express with TypeScript, zod for validation.
**Why:** One language across frontend and backend. The workload is I/O-bound (database queries), which suits Node's event loop. TypeScript catches mistakes before runtime.
**Alternatives considered:** FastAPI (built-in validation and docs), Django (built-in admin), Spring Boot (common in government, but slow to set up in 8 hours).
**Trade-off:** Validation and API docs are set up manually (zod + OpenAPI). CPU-heavy work blocks the single thread, so bulk imports are streamed in batches.

## D-03 · PostgreSQL + Prisma
**Decision:** PostgreSQL as the single database, accessed through Prisma.
**Why:** Relational data with strong consistency (assets, tickets, history), transactions for lifecycle changes, and JSONB for flexible fields — one database covers both needs. Prisma gives typed queries and migrations quickly.
**Alternatives considered:** MongoDB (flexible documents, but weaker for relational history and multi-table transactions).
**Trade-off:** Complex JSONB queries may need raw SQL through Prisma.

## D-04 · Lifecycle as a state machine in one module
**Decision:** All status changes go through the lifecycle engine; allowed moves are defined in one table of rules (pure functions, unit-tested).
**Why:** Prevents impossible histories (Planned → Disposed), gives one place to change rules, and makes the rules testable without a database.
**Alternatives considered:** A free-form status dropdown (simple, but no guarantees and no reliable history).
**Trade-off:** Adding a new stage needs a code change. Per-type custom lifecycles are future scope.

## D-05 · Backend computes allowed next moves
**Decision:** `GET /assets/:id` returns `allowedTransitions` for the current user; the UI only renders those.
**Why:** Rules live in one place (the backend). The UI can't drift out of sync with the rules, and security never depends on hidden buttons.
**Alternatives considered:** Duplicating the rules in the frontend, or sharing a TypeScript package between both.
**Trade-off:** One extra field per detail request — negligible.

## D-06 · Insert-only history (LifecycleEvent + AuditLog)
**Decision:** History tables only ever receive inserts; there are no update or delete routes for them.
**Why:** Government systems need accountability: who changed what, when, and why. An editable history is not a history.
**Trade-off:** These tables grow fastest. At scale: partition by month and archive old partitions.

## D-07 · Status change + history in one transaction
**Decision:** Updating the asset, writing the lifecycle event, writing the audit row, and creating a ticket happen in one database transaction.
**Why:** Either everything is saved or nothing is. We never get an asset whose status changed without a history row.

## D-08 · Stateless JWT authentication, roles enforced in the API
**Decision:** JWT carries user id and role; middleware checks roles on every protected route.
**Why:** No server-side sessions, so any number of API instances can serve any request (horizontal scaling). Security is enforced on the server, not by hiding UI.
**Trade-off:** Tokens can't be revoked instantly before expiry; mitigated by short expiry. At scale: refresh tokens + a revocation list.

## D-09 · Separate public API with limited powers
**Decision:** Public routes (`/api/public/*`) need no login, are rate-limited, return only safe fields, and can only file reports — never change an asset.
**Why:** Citizens are the best sensors for broken infrastructure, but anyone on the internet can call a public endpoint. Reports go to a queue that staff confirm or reject, which stops spam and fake reports from changing records.
**Trade-off:** A human step before action. At scale: OTP verification and spam scoring.

## D-10 · 3 public states, 7 staff stages
**Decision:** Staff see all 7 lifecycle stages; the public sees Working / Being repaired / Not in service.
**Why:** Show each person what they need to act. "Commissioned" means nothing to a citizen; "Working" does.

## D-11 · One inclusive UI, not a "simple mode"
**Decision:** Every screen follows the same rules: 3 languages, icon + colour + word, plain words, big touch targets, mobile-first, wizards over long forms.
**Why:** Built for Bharat — if a first-time smartphone user can use it, everyone can. Field officers and officials benefit as much as citizens.

## D-12 · QR holds only a URL with the asset ID
**Decision:** The QR code encodes `FRONTEND_URL/a/{assetCode}` at error-correction level H; the asset code is also printed as text.
**Why:** No data lives in the code, so a fake or copied QR leaks nothing. Level H still scans with ~30% damage. If it fades, the printed ID or "Assets near me" still works, and reprinting gives an identical code.

## D-13 · Transaction-safe asset codes
**Decision:** Codes like `WP-000123` come from a per-type counter incremented inside a transaction.
**Why:** Human-readable IDs for plates and phone calls; the transaction guarantees two simultaneous creates never get the same code.

## D-14 · Bulk import: respond first, process in batches
**Decision:** CSV upload creates an import job, responds immediately, then streams and inserts rows in batches of 500, recording row-level errors.
**Why:** Governments start from Excel sheets. Streaming keeps Node's single thread free for other users; batch inserts are far faster than row-by-row.
**Trade-off:** If the server restarts mid-import, the job stops. At scale: a job queue (BullMQ + Redis) with retries.

## D-15 · Photos stored in Postgres (for now)
**Decision:** Compressed report photos (~100 KB) are stored as bytes in the database.
**Why:** Render's free tier filesystem is wiped on restart, and object storage setup costs hackathon time.
**Trade-off:** Databases are not ideal file stores. At scale: object storage (S3-compatible) with only the URL in the database.

## D-16 · Map loads only the visible area
**Decision:** The map requests assets inside its current bounding box, capped at 2,000, drawn as lightweight circle markers.
**Why:** A city can have 100k+ assets; sending all of them would crash a cheap phone.
**Trade-off:** At scale: server-side clustering or vector tiles, and PostGIS for spatial queries.

## D-17 · Deploy early, deploy often
**Decision:** Skeleton deployed in hour 1 (Render + Vercel); every push redeploys.
**Why:** Deployment problems (CORS, env vars, SPA routing, HTTPS for GPS/camera) surface early instead of during the demo.

## D-18 · What we deliberately did NOT build
Redis cache, job queues, microservices, Kubernetes, PostGIS, OTP login, offline mode, ML predictions.
**Why:** Each adds setup and failure points without improving the core loop in 8 hours. They are the documented scale path, not missing features.

## D-19 · Pin Prisma to version 6
**Decision:** Use `prisma@6` and `@prisma/client@6`, not the newest major.
**Why:** Prisma 7+ requires a `prisma.config.ts`, a separate driver adapter (`@prisma/adapter-pg` + `pg`) and moves the seed configuration. That adds two libraries and setup the plan does not cover. Version 6 is stable, well documented, and matches every step in `docs/PROMPTS.md`.
**Alternatives considered:** Prisma 7 with the pg adapter.
**Trade-off / what we'd change at scale:** We are one major behind. Upgrading later is a contained change in `db/prisma.ts` and the Prisma config.

## D-20 · Creation sets the first status; the engine governs every change after that
**Decision:** Creating an asset (form, CSV import, seed) is not a transition. It sets an initial status and writes a first `LifecycleEvent` with `fromStatus = null`. Forms create PLANNED assets; CSV import may set the status through an optional `status` column (default IN_OPERATION). After creation, only the lifecycle engine changes `status`.
**Why:** Departments import registers of assets that already exist and are running. Forcing them all to PLANNED and clicking through four stages per asset would make bulk import useless. Every asset still has a history that starts at the moment it entered the system.
**Alternatives considered:** Imported assets always PLANNED; replaying every transition through the engine for each imported row (slow, and invents fake history).
**Trade-off / what we'd change at scale:** Imported assets in later stages may have empty stage fields (acquired date, cost, vendor). These are shown as "not recorded".

## D-21 · Tickets must be closed before repair-done or decommission
**Decision:** A manual UNDER_MAINTENANCE → IN_OPERATION move is allowed only when the asset has no open tickets. An asset cannot be decommissioned while it has open tickets. Public reports can only be filed for assets that are IN_OPERATION or UNDER_MAINTENANCE.
**Why:** Without these rules an asset could show "Working" while a repair ticket is still open, or be decommissioned with work orders left hanging, and a citizen could report a problem on an asset that is not even installed. Each rule keeps tickets, reports and status consistent.
**Alternatives considered:** Automatically closing open tickets on decommission (hides unfinished work); allowing reports on any asset (reports that can never be resolved).
**Trade-off / what we'd change at scale:** One extra count query inside the transition transaction; negligible.

## D-22 · Optional `details` in the error response
**Decision:** Errors look like `{ error: { code, message, details? } }`. `details` carries field-level validation errors or the values needed to build a translated message.
**Why:** The frontend translates errors by `code` into Gujarati, Hindi or English. A message such as "Next allowed step: Acquired" needs the underlying values to be translated, and forms need to show errors next to the right field.
**Alternatives considered:** Only `code` and `message` (per-field display and translated details are lost).
**Trade-off / what we'd change at scale:** Slightly larger error payloads.

## D-23 · Transitions accept a transaction and use a conditional update
**Decision:** `transitionAsset` accepts an optional Prisma transaction client (`tx`). The status update is `updateMany({ where: { id, status: from } })`; if no row changes, the move is rejected.
**Why:** Confirming a report and closing a ticket must change the asset inside their own transaction, and Prisma cannot nest `$transaction` calls, so the caller passes its `tx` in. The conditional update prevents a race: if two people change the same asset at the same moment, only the first succeeds, so the history can never record two different moves from the same starting status.
**Alternatives considered:** `SELECT ... FOR UPDATE` row locks through raw SQL (works, but harder to read); serializable isolation (retries needed).
**Trade-off / what we'd change at scale:** The losing request gets an error and must retry; that is the correct outcome for conflicting human actions.

## D-24 · JWT kept in localStorage
**Decision:** The web app stores the JWT in `localStorage` and sends it as a Bearer header. Protected images (photos, QR codes) are fetched through the API client, not with a plain `<img src>`.
**Why:** The frontend (Vercel) and API (Render) are on different domains. Cross-site cookies need SameSite=None, CSRF protection and more CORS setup. A Bearer header is simple and stateless.
**Alternatives considered:** httpOnly cookie with CSRF token.
**Trade-off / what we'd change at scale:** A script injected through an XSS bug could read the token. Mitigations: React escapes output by default, helmet sets security headers, and tokens expire in 8 hours. At scale: httpOnly cookies on a shared parent domain plus refresh tokens.
