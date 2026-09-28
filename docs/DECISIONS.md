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

## D-25 · Pin TypeScript 5 and react-router 7
**Decision:** Use `typescript@5` in both apps and `react-router@7` in the web app, not the newest majors (TypeScript 7, react-router 8).
**Why:** TypeScript 7 is the new native compiler and react-router 8 is a fresh major; both changed recently enough that tooling support and examples may lag. For an 8-hour build, known-stable versions avoid surprises. The code we write is the same either way.
**Alternatives considered:** Latest majors of both.
**Trade-off / what we'd change at scale:** Upgrade after the hackathon once the ecosystem has caught up.

## D-26 · Node's built-in `.env` loader instead of dotenv
**Decision:** `config/env.ts` calls `process.loadEnvFile()` (built into Node 20.12+) and ignores a missing file, then validates every variable with zod and exits with a clear list if any are missing or invalid.
**Why:** No extra library. Locally the values come from `api/.env`; on Render there is no file and the values come from the dashboard, so the same code works in both places. Failing fast at startup is better than failing on the first request that needs a missing value.
**Alternatives considered:** `dotenv` (extra dependency), `node --env-file` (fails when the file is missing, which it is in production).
**Trade-off / what we'd change at scale:** None significant; secrets would move to a secret manager, still read through `process.env`.

## D-27 · UUID keys, Decimal money, priority as an enum
**Decision:** All ids are UUIDs; `cost` and `disposalValue` are `Decimal(14,2)`; ticket priority is an enum (LOW, MEDIUM, HIGH).
**Why:** UUIDs can be generated anywhere (seed, import) without a round trip and do not reveal how many records exist. Floats round money wrongly (0.1 + 0.2), Decimal does not. An enum rejects typos like "hgih" at the database level.
**Alternatives considered:** Auto-increment integers (smaller, but guessable and leak counts); priority as free text.
**Trade-off / what we'd change at scale:** UUID indexes are larger than integer indexes. Prisma returns Decimal as a string in JSON, so the frontend formats it.

## D-28 · Render Blueprint (render.yaml) instead of manual dashboard setup
**Decision:** The API service and its Postgres database are described in `render.yaml` at the repo root and created with Render's "Blueprint" option.
**Why:** Infrastructure as code: the build command, start command, health check, Node version and env vars live in git, are reviewable, and can be recreated in one click. `JWT_SECRET` is generated by Render, so no secret is ever typed or committed. `DATABASE_URL` is wired to the database's internal URL automatically.
**Alternatives considered:** Creating the web service and database by hand in the dashboard (more clicks, easy to mistype, not reproducible).
**Trade-off / what we'd change at scale:** `FRONTEND_URL` and `CORS_ORIGINS` still need one manual entry because the Vercel domain is only known after the first frontend deploy.

## D-29 · Auth middleware trusts the token, /me reads the database
**Decision:** `requireAuth` only verifies the JWT signature and expiry; it does not look the user up. `GET /api/auth/me` does read the user from the database. Login returns the same message for an unknown email and a wrong password.
**Why:** No database call on every request keeps the API stateless and fast (D-08). `/me` is called once when the app loads, so it is the natural place to confirm the account still exists. The shared login message stops anyone from using the form to discover which emails are registered.
**Alternatives considered:** Look up the user on every request (instant revocation, but one extra query per request).
**Trade-off / what we'd change at scale:** A deleted or demoted user keeps access until the token expires (8 hours). At scale: short-lived access tokens plus refresh tokens, or a small revocation list.

## D-30 · Field definitions are locked once assets exist
**Decision:** After assets of a type exist, PATCH may rename labels and add optional fields, but may not remove a field, change its type, or add a new required field. The code prefix can never change.
**Why:** Stored attributes depend on the field list. Removing a field or changing its type would leave existing assets with data that no longer validates; a new required field would make every old asset invalid the next time someone edits it. Asset codes already printed on plates use the prefix.
**Alternatives considered:** Free editing with a data migration per change (powerful, far too much for 8 hours).
**Trade-off / what we'd change at scale:** To really change a field, an admin creates a new type. At scale: versioned field definitions with a migration tool.

## D-31 · Map endpoint returns six fields and says when it hit the cap
**Decision:** `GET /api/assets/map` filters by bounding box, returns only id, code, type, status, lat, lng, and asks the database for 2,001 rows so it can return `capped: true` when there are more than 2,000.
**Why:** The map only needs enough to draw a dot and open a popup. Fetching one extra row is the cheapest way to know whether to tell the user "zoom in to see all assets" without a separate count query.
**Alternatives considered:** A `count(*)` for the same box (a second query on every pan); returning everything (crashes cheap phones).
**Trade-off / what we'd change at scale:** Which 2,000 are shown in a dense area is arbitrary. At scale: server-side clustering or vector tiles (D-16).

## D-32 · Allowed transitions include the ticket guards; first operation starts the service schedule
**Decision:** `allowedTransitions` hides moves that the open-ticket guards would reject (repair-done and decommission while tickets are open). Moving COMMISSIONED → IN_OPERATION sets `nextMaintenanceDate = now + type.maintenanceIntervalDays`.
**Why:** The UI renders only what the backend allows (D-05), so a button must never appear that is guaranteed to fail. Without a first `nextMaintenanceDate`, a new asset would never show up as overdue for service.
**Alternatives considered:** Show every structurally valid move and let the request fail (confusing for users); leave the schedule empty until the first service is logged.
**Trade-off / what we'd change at scale:** One extra count query per detail request, already needed for `openTicketCount`.

## D-33 · One definition of "overdue"; tickets only for assets in service
**Decision:** An asset is overdue when `nextMaintenanceDate` has passed and it is IN_OPERATION or UNDER_MAINTENANCE. Decommissioning clears `nextMaintenanceDate`. Tickets (and "Log a service") can only be created for assets that are IN_OPERATION or UNDER_MAINTENANCE. Closing a ticket returns `assetReturnedToOperation` so the UI can say so.
**Why:** The dashboard count, the "overdue only" list filter and the top-5 list must agree, and a decommissioned pump is not "overdue for service". A ticket on a planned or disposed asset could never be resolved by the lifecycle.
**Alternatives considered:** Overdue = any date in the past (inflates the number with dead assets).
**Trade-off / what we'd change at scale:** The overdue query uses the `nextMaintenanceDate` index plus a status filter; a composite index `(status, nextMaintenanceDate)` if this becomes hot.

## D-34 · CSV import runs synchronously (cut from D-14)
**Decision:** `POST /api/imports` stream-parses the CSV and inserts valid rows in batches of 500 before responding with the finished job (total, succeeded, failed, first 100 row errors). There is no background processing or progress polling.
**Why:** Cut at 13:12 to protect the backend deadline (TASKS.md cut order, item 3). Streaming + batching still keeps memory flat and yields the event loop between batches; a 10 MB CSV (~50k rows) finishes in seconds. It also removes the risk of a job stuck in RUNNING after a restart.
**Alternatives considered:** Respond first and process in the background with polling (D-14, original plan).
**Trade-off / what we'd change at scale:** Very large files hold one HTTP request open. At scale: the original background design with a job queue (BullMQ + Redis) and retries.

## D-35 · Seed data is realistic and consistent with the rules
**Decision:** The seed generates assets whose lifecycle events follow the real path to their status, gives every UNDER_MAINTENANCE asset an open ticket, links ASSIGNED/FIXED reports to tickets, and continues `nextSeq` after the generated codes. It only generates assets when none exist, unless `SEED_RESET=true`.
**Why:** Demo data that breaks the rules (an asset under repair with no ticket) would make the lifecycle engine reject actions during the demo. Re-running the seed must never wipe production data by accident.
**Trade-off / what we'd change at scale:** The seed writes directly with `createMany` and bypasses the lifecycle engine for speed (5,000 assets in ~3 s). That is acceptable only because it produces the same rows the engine would.

## D-36 · Public API: what each endpoint can reveal
**Decision:** Public responses are built from one `safeAssetSelect` (code, type name + icon, status mapped to 3 states, location text, ward, last repaired date). Tracking returns status, category, asset code, dates and the reject reason; never phone, photo or ids. Asset codes are validated by pattern before any query. Tracking codes are 6 random digits from `crypto.randomInt`, retried on collision. Reports are refused for assets not in service. Limits: 60 reads/min, 5 reports/10 min, 20 logins/15 min per IP, the first two configurable by env.
**Why:** Anyone on the internet can call these routes, so every field is chosen on purpose and the only write goes into a queue staff review. Random codes cannot be walked in order; the rate limit makes guessing 900,000 codes impractical, and a guessed code reveals only a status.
**Alternatives considered:** Returning the full asset and hiding fields in the UI (leaks cost and vendor to anyone with devtools).
**Trade-off / what we'd change at scale:** In-memory rate limits are per API instance. At scale: a shared Redis store, OTP-verified reporting, duplicate-report detection per asset.

## D-37 · Frontend foundation: inline SVG icons, English fallback, one error translator
**Decision:** Icons are ~40 inline SVG paths in one `Icon` component (no icon library, no emoji). i18next falls back to English for any missing Hindi/Gujarati string. The first language is the saved choice, then the phone's language, then English. `errorMessage(err)` translates every API error by `code`, falling back to the backend's plain English message. Hindi and Gujarati files carry a top-level `_TODO` flag because JSON has no comments; every string in them needs native review.
**Why:** SVG looks identical on a ₹6,000 Android and an iPhone, while emoji differ and may be missing. A fallback means a missed translation shows readable English instead of a key like `asset.logService`. One translator means no page invents its own error text.
**Alternatives considered:** An icon package (new dependency, larger bundle); `i18next-browser-languagedetector` (not in the stack; 10 lines do the same).
**Trade-off / what we'd change at scale:** Translation keys are checked only at runtime. At scale: a typed key list and a CI check that all three files have the same keys.

## D-38 · Staff pages are lazy-loaded; charts always have a text twin
**Decision:** Every staff page is loaded with `React.lazy`, so the public bundle (QR scan → asset page → report) never includes recharts, Leaflet or admin screens. Each chart is paired with a list that shows the same numbers as StatusBadge (icon + word) + count, and every number links to the filtered asset list.
**Why:** Citizens on slow 3G only download what the public pages need (recharts alone is ~105 KB gzipped). A chart is colour-only by nature; the list makes the same information readable for colour-blind users and screen readers, and clickable.
**Trade-off / what we'd change at scale:** The first visit to the dashboard downloads the chart chunk; it is cached afterwards.

## D-39 · Deploy web and API on Vercel, database on Neon (replaces the Render plan in D-17/D-28)
**Decision:** The web app and the API are two Vercel projects from the same GitHub repo (root directories `web` and `api`). The API uses Vercel's zero-config Express support: `api/src/index.ts` becomes one Vercel Function. Postgres is Neon, created from the API project's **Storage** tab, which injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct, used by `prisma migrate deploy`). The `vercel-build` script runs `prisma generate && prisma migrate deploy`.
**Why:** One dashboard and one login for everything, and every push redeploys both apps. The API was already stateless (JWT, no sessions, no disk writes), so it runs as a serverless function without code changes. The pooled URL stops many short-lived function instances from exhausting Postgres connections.
**Alternatives considered:** Render for API + Postgres (original plan; the free instance sleeps for ~1 minute after inactivity); Vercel for both with a self-managed database elsewhere.
**Trade-off / what we'd change at scale:** Vercel caps request bodies at 4.5 MB, so the CSV import limit is 4 MB (~20k rows). In-memory rate limits are per function instance, so they are weaker than on one long-running server; at scale use a shared store (Redis/Upstash) or Vercel Firewall rules. Long imports are bounded by the function time limit.

## D-40 · Production deploys from the CLI; production accounts use a strong password
**Decision:** Both Vercel projects (`assettrace-api`, `assettrace-web`) are deployed with `vercel deploy --prod` from their folders, not from Git pushes. The API and Neon database run in Singapore (`sin1`), the closest region Neon offers to India. Production staff accounts were seeded with a random strong password (shared privately), and the login page shows the demo hint only in local development. `.vercelignore` keeps local `.env` files out of uploads.
**Why:** The repo holds two apps; connecting Git would need each project's root directory configured first, and a wrong setting would produce failing builds on every push during the demo. Public demo credentials on a live site would let anyone log in as admin and change records.
**Trade-off / what we'd change at scale:** Deploys are manual. Next step: connect GitHub in each project's settings with root directory `api` / `web` so every push deploys (D-17).

## D-41 · Repairs are assigned only to field officers
**Decision:** Tickets can only be assigned to users with the FIELD_OFFICER role. Admins assign from an "Assign to" list of field officers (`GET /api/users?role=FIELD_OFFICER`, admin only); a field officer can only assign a ticket to themselves ("Assign to me"). "Log a service" by an admin records the service without an assignee. Enforced in `maintenance.service.ts`, not just in the UI.
**Why:** Admins manage the work; officers do or supervise it. An admin taking a repair ticket, or an officer pushing work onto another officer, would blur who is accountable for the fix.
**Alternatives considered:** A separate FIELD_WORKER role that logs in to see only its own tickets (more realistic for large departments, but a bigger change to roles and screens).
**Trade-off / what we'd change at scale:** Contractors and linemen who don't log in are not recorded by name. Next step: a FIELD_WORKER role, or a free-text "worker on site" field on the ticket.
