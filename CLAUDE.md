# CLAUDE.md — AssetTrace

This file is read automatically by Claude Code. It is the single source of truth for how to work on this project.

## 1. What we are building

**AssetTrace** is a generic, lifecycle-based infrastructure asset inventory for government departments in India. It tracks and manages any infrastructure asset (streetlights, water pumps, transformers, buildings, anything an admin defines) across its entire lifecycle, from planning to disposal.

Context: built in an 8-hour hackathon for Pravi Research ("Build for Billions"). The system must work at scale, work for people, and work for Bharat. The developers must be able to explain every part of the code and architecture in an interview.

## 2. Working rules for Claude Code (follow every time)

1. **Before any task:** read `CLAUDE.md`, `docs/TASKS.md` and `docs/DECISIONS.md`.
2. **Small steps.** Do only the step requested. Do not build ahead or add features that were not asked for.
3. **Keep code simple and readable.** Prefer clear code over clever code. No unnecessary abstractions, no premature optimisation.
4. **No new libraries without asking.** Only use the libraries listed in section 4. If something else is truly needed, stop and explain why first.
5. **Run it.** After writing code, run the relevant command (dev server, migration, test, type check) and fix errors before saying the step is done.
6. **Explain after every step.** End each step with a section called `## What I did and why` containing:
   - files created or changed (one line each)
   - 3–5 key design decisions in plain language, written so a student can defend them in an interview
   - how to test it manually (exact commands or clicks)
7. **Keep records updated.** After each step:
   - tick completed items in `docs/TASKS.md` and add a line to its Log section
   - add any new design decision to `docs/DECISIONS.md`
8. **Never** commit `.env` files, secrets, or `node_modules`. Never hardcode secrets or URLs; use environment variables.
9. **Suggest a git commit message** at the end of each step (format: `feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`). Do not push without being asked.
10. If a request is ambiguous or conflicts with this file, ask before coding.

## 3. Architecture (summary)

```
Clients (React web app: staff screens + public screens, mobile-first)
        │
        ▼
Express API (Node + TypeScript, stateless)
  ├── /api/*          staff routes → JWT auth → role check → services
  └── /api/public/*   public routes → rate limit → read-safe fields + file reports only
        │
        ▼
PostgreSQL (Prisma ORM, JSONB attributes + GIN index, insert-only history tables)
```

- Only the API talks to the database. Clients never touch the DB directly.
- Every lifecycle status change goes through the **lifecycle engine** module. Nothing else may change `asset.status`.
- The API stores no session state (JWT), so it can run as many copies behind a load balancer.
- Full details: `docs/ARCHITECTURE.md`.

## 4. Tech stack (do not add to this without asking)

**Backend (`/api`)**
- Node.js 20+, TypeScript, Express
- Prisma ORM **pinned to v6** (`prisma@6`, `@prisma/client@6`; v7+ needs driver adapters and a different config) + PostgreSQL 16
- zod (validation), jsonwebtoken, bcryptjs (pure JS, avoids native build issues)
- multer (memory storage, for CSV and photo uploads), csv-parse (streaming CSV)
- qrcode (PNG QR generation), express-rate-limit, cors, helmet
- vitest (unit tests), tsx (dev runner)
- swagger-ui-express + @asteasolutions/zod-to-openapi (API docs, added late, time-boxed)

**Frontend (`/web`)**
- React + Vite + TypeScript, Tailwind CSS (v4, via its official `@tailwindcss/vite` plugin), react-router
- react-i18next (Gujarati, Hindi, English)
- react-leaflet + leaflet (OpenStreetMap tiles), recharts
- A small fetch wrapper for API calls (no heavy data-fetching library)

**Infra**
- Docker Compose for local Postgres
- Deploy: everything on Vercel: web and API are two Vercel projects from the same repo (root directories `web` and `api`); Postgres is Neon, added from the API project's Vercel Storage tab (D-39)

## 5. Folder structure

```
/
├── CLAUDE.md
├── README.md
├── docker-compose.yml
├── docs/            ARCHITECTURE.md, DECISIONS.md, TASKS.md, PROMPTS.md
├── .claude/commands/checkpoint.md
├── api/
│   ├── prisma/      schema.prisma, migrations/, seed.ts
│   └── src/
│       ├── index.ts, app.ts
│       ├── config/env.ts          (zod-validated env vars)
│       ├── db/prisma.ts
│       ├── middleware/            auth.ts, requireRole.ts, errorHandler.ts, validate.ts, rateLimit.ts
│       ├── lib/                   audit.ts, attributes.ts, assetCode.ts, statusMap.ts
│       └── modules/               auth, assetTypes, assets, lifecycle, maintenance,
│                                  reports, public, dashboard, imports, qr
│                                  (each: *.routes.ts, *.service.ts, *.schema.ts)
└── web/
    └── src/
        ├── api/                   client.ts + one file per module
        ├── i18n/                  index.ts, en.json, hi.json, gu.json
        ├── components/            StatusBadge, BigButton, ConfirmDialog, Layout, LanguageSwitch ...
        ├── lib/                   status.ts (colours, icons, labels), auth.ts
        └── pages/
            ├── staff/             Login, Dashboard, AssetList, AssetDetail, AssetTypes,
            │                      AssetForm, Import, Tickets, Reports, Map
            └── public/            Home, PublicAsset, ReportProblem, ReportDone, TrackReport, Nearby
```

## 6. Domain rules (must be enforced in the backend)

### 6.1 Lifecycle stages (enum `AssetStatus`)
`PLANNED → ACQUIRED → COMMISSIONED → IN_OPERATION ⇄ UNDER_MAINTENANCE → DECOMMISSIONED → DISPOSED`

Allowed transitions (anything else is rejected with a clear error):

| From | To |
|---|---|
| PLANNED | ACQUIRED |
| ACQUIRED | COMMISSIONED |
| COMMISSIONED | IN_OPERATION |
| IN_OPERATION | UNDER_MAINTENANCE, DECOMMISSIONED |
| UNDER_MAINTENANCE | IN_OPERATION, DECOMMISSIONED |
| DECOMMISSIONED | DISPOSED |
| DISPOSED | (none — final) |

Data required when entering a stage:
- ACQUIRED: `acquiredDate`, `cost`, `vendor`
- COMMISSIONED: `commissionedDate` (`warrantyEnd` optional)
- DISPOSED: `disposalMethod` (`disposalValue` optional)

Every transition, in **one database transaction**:
1. validates the move and the role
2. updates `asset.status` (and stage fields)
3. inserts a `LifecycleEvent` row
4. inserts an `AuditLog` row

Guards (checked inside the transition transaction):
- A manual UNDER_MAINTENANCE → IN_OPERATION move is allowed only when the asset has no open tickets (OPEN or IN_PROGRESS). Otherwise reject with "Close the open tickets first".
- An asset cannot be moved to DECOMMISSIONED while it has open tickets.
- Concurrency: the status update is conditional on the status that was read (`updateMany({ where: { id, status: from } })`); if no row was updated, another change won and the move is rejected.
- `transitionAsset` accepts an optional Prisma transaction client (`tx`) so callers such as report-confirm and ticket-close can run it inside their own transaction.

Creation is not a transition: a new asset (form, CSV import, seed) is created with an initial status (PLANNED by default; CSV import may set it via an optional `status` column, default IN_OPERATION) and an initial `LifecycleEvent` with `fromStatus = null`. After creation, only the lifecycle engine changes `status`.

Side effects:
- Staff moving an asset to UNDER_MAINTENANCE auto-creates a CORRECTIVE maintenance ticket (unless the move came from confirming a public report, which creates its own ticket).
- Closing the last open ticket of an asset in UNDER_MAINTENANCE moves it back to IN_OPERATION, sets `lastMaintenanceDate = now` and `nextMaintenanceDate = now + type.maintenanceIntervalDays`.

`GET /api/assets/:id` returns `allowedTransitions` computed by the backend for the current user's role. The frontend only renders those buttons; it never decides lifecycle rules itself.

### 6.2 Roles
| Role | Can do |
|---|---|
| ADMIN | everything: asset types, assets, all transitions, import, reports, tickets; assigns repairs to field officers |
| FIELD_OFFICER | view assets; IN_OPERATION ⇄ UNDER_MAINTENANCE; manage tickets (assign only to themselves); confirm/reject public reports |
| OFFICER | supervises field officers: assigns repairs, acts on reports and tickets (cost approval and budget: planned, see TASKS.md) |
| VIEWER | read-only staff access (dashboards, lists, details) |
| CITIZEN | signs up with mobile + password; files complaints (recorded against the account); sees "My complaints"; never reaches staff routes |
| Public (no login) | view safe asset info; track a report by its number |

Roles are enforced in the API with middleware. Hiding buttons in the UI is not security.

### 6.3 Public access rules
- Public routes live under `/api/public/*`, need no login, and are rate-limited per IP.
- Public responses include only safe fields: asset code, type name and icon, public status, plain location text, ward, last repaired date. Never cost, vendor, internal notes, or user data.
- Reports can only be filed for assets that are IN_OPERATION or UNDER_MAINTENANCE. For any other stage the public page says the asset is not in service and hides the report button; the API rejects the report.
- The API runs behind a proxy (Render), so `app.set('trust proxy', 1)` is required for per-IP rate limits. Limits are configurable through environment variables.
- Filing a complaint needs a CITIZEN login (`POST /api/citizen/reports`); anonymous reports were removed (D-42). Every staff route requires a staff role, so citizen tokens are refused there.
- The public can **never** change lifecycle status. A report goes to a queue; a field officer or admin confirms it (creates ticket + moves asset to UNDER_MAINTENANCE if it is IN_OPERATION) or rejects it with a reason.
- Public status is a simplified 3-state view (see `lib/statusMap.ts`):
  - IN_OPERATION → `WORKING`
  - UNDER_MAINTENANCE → `BEING_REPAIRED`
  - everything else → `NOT_IN_SERVICE`
- Each report gets a unique 6-digit `trackingCode`.
- Photos: optional, compressed in the browser to ~100 KB, max 2 MB on the server, stored in Postgres (`Bytes`). Never write uploads to the server filesystem (serverless filesystems are temporary).

### 6.4 Asset types and custom fields
- Admin creates asset types with a `fields` JSON array: `[{ key, label, type: "text"|"number"|"date"|"select", required, options? }]`.
- Asset `attributes` (JSONB) are validated against the type's field definitions on create/update (`lib/attributes.ts`). Unknown keys are rejected.
- Asset codes are `PREFIX-000123`, generated from a per-type counter (`AssetType.nextSeq`) incremented inside a transaction, so two simultaneous creates never get the same code.

### 6.5 History
- `LifecycleEvent` and `AuditLog` are insert-only. No update or delete routes for them.

## 7. API conventions

- All staff routes under `/api`, public routes under `/api/public`, health at `/health`.
- Validate every request body, query, and param with zod.
- Error response shape: `{ "error": { "code": "INVALID_TRANSITION", "message": "Plain-language message", "details": { ... } } }`. `details` is optional: field-level validation errors (`{ fields: { name: "Required" } }`) or values the frontend needs to build a translated message (`{ from: "PLANNED", allowed: ["ACQUIRED"] }`). The frontend translates by `code`.
- Protected images (report photos, QR codes) are fetched through the API client with the auth header, never via a plain `<img src>` to the API. The QR endpoint returns JSON `{ assetCode, png }` where `png` is a data URL.
- Register fixed-path routes before parameter routes (`/api/assets/map` before `/api/assets/:id`, `/api/public/assets/nearby` before `/api/public/assets/:assetCode`).
- List endpoints are always paginated: `page` (default 1), `pageSize` (default 20, max 100). Response: `{ items, page, pageSize, total }`.
- Map endpoint returns minimal fields only and caps results (2,000).
- Use aggregate SQL (Prisma `groupBy`/`count` or `$queryRaw`) for dashboards — never load all rows into memory.
- Dates in ISO 8601, stored in UTC.

## 8. UI rules (apply to EVERY screen — staff and public)

The app is for everyone in India. Design every screen so a first-time smartphone user can use it without help. This is one inclusive design, not a separate "simple version".

1. **Language:** Gujarati / Hindi / English switch visible on every screen, remembered in localStorage. All user-facing text comes from i18n files — no hardcoded strings.
2. **Plain words:** "Mark as under repair", not "Transition to UNDER_MAINTENANCE". Errors say what happened and what to do.
3. **Status = icon + colour + word, always.** Never colour alone. Use one shared `StatusBadge` component.
4. **Public sees 3 states; staff see all 7 stages** with a one-line explanation each.
5. **Simple by default:** search + a few filters visible; advanced options behind "More".
6. **Wizards, not long forms:** add asset = Type → Details → Location → Confirm.
7. **Confirm important actions** in plain words ("Mark WP-000021 as Decommissioned? This cannot be undone.").
8. **Mobile-first everywhere:** touch targets ≥ 48px, body text ≥ 18px on public pages and ≥ 16px on staff pages, high contrast.
9. **No typing required** for the public report flow (picture buttons for problem type; text and photo optional).
10. **Light and fast:** works on low-end Android and slow 3G. Lazy-load the map page. Use `CircleMarker`s on the map (avoids Leaflet default-icon issues in Vite and is faster).
11. **Accessibility:** every input has a label, icon-only buttons have `aria-label`, keyboard navigable, text scales with the phone's font size (use rem).

## 9. Commands

```bash
# database
docker compose up -d

# api
cd api
npm run dev            # tsx watch src/index.ts
npm run build          # tsc
npm start              # node dist/index.js
npx prisma migrate dev
npx prisma db seed
npm test               # vitest

# web
cd web
npm run dev
npm run build

# deploy (Vercel CLI, logged in; run inside api/ or web/)
vercel deploy --prod
```

## 10. Environment variables

`api/.env` (see `api/.env.example`):
```
DATABASE_URL=postgresql://assettrace:assettrace@localhost:5432/assettrace
DATABASE_URL_UNPOOLED=postgresql://assettrace:assettrace@localhost:5432/assettrace
JWT_SECRET=change-me
JWT_EXPIRES_IN=8h
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
PORT=4000
RATE_LIMIT_PUBLIC_READS_PER_MIN=60
RATE_LIMIT_REPORTS_PER_10_MIN=5
# password for seeded users; use a strong value when seeding production
SEED_PASSWORD=demo1234
```

`web/.env` (see `web/.env.example`):
```
VITE_API_URL=http://localhost:4000
```

## 11. Out of scope (do not build)

Redis, job queues (BullMQ), microservices, Kubernetes, PostGIS, OTP/SMS login, payments/tendering, offline mode, ML predictions. These are explained as the future scale path in `docs/ARCHITECTURE.md`, not built.
