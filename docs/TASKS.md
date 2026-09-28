# TASKS.md — AssetTrace build tracker

Claude Code ticks items here after each step and adds a line to the Log. Keep this honest: it becomes the record of how the project was built.

**Hackathon start:** 11:00  **Deadline:** 18:00 (6:00 PM)

## Time plan (8 hours)

| Phase | Prompts | Budget | Target finish | Actual |
|---|---|---|---|---|
| 0 · Kickoff | P0 | 0:10 | +0:10 | |
| 1 · Foundation + early deploy | P1–P3 | 0:50 | +1:00 | |
| 2 · Backend core | P4–P10 | 2:00 | +3:00 | |
| 3 · Frontend | P11–P17 | 2:30 | +5:30 | |
| 4 · Polish, prove, ship | P18–P22 | 1:30 | +7:00 | |
| Buffer + demo rehearsal | — | 1:00 | +8:00 | |

**Cut order if running behind** (cut from the top first):
1. ~~P19 API docs~~ → **CUT at 13:12**: mention as "future"; show requests in curl/Postman instead
2. P17 Map → the Nearby list covers location
3. ~~Import progress polling~~ → **CUT at 13:12**: import runs synchronously (still streamed + batched); `GET /api/imports/:id` kept for the result
4. Field builder preview in P14
5. Never cut: lifecycle engine, public report loop, dashboard, deployment

---

## Phase 0 · Kickoff
- [x] P0 Claude summarised the plan and open questions are resolved

## Phase 1 · Foundation
- [x] P1 Monorepo scaffold, Docker Postgres, API `/health`, web placeholder
- [x] P1 env validation with zod, central error handler
- [x] P2 Prisma schema, all models and enums
- [x] P2 Indexes + GIN index on `attributes`
- [x] P2 Seed users (admin / officer / viewer)
- [ ] P3 API deployed on Render with Postgres
- [ ] P3 Web deployed on Vercel with SPA rewrite
- [ ] P3 CORS + env vars working in production

## Phase 2 · Backend core
- [x] P4 Login + `/me`, JWT middleware, `requireRole`
- [x] P4 zod `validate` middleware, `AppError`, audit helper
- [x] P5 Asset types CRUD with field definition validation
- [x] P5 `validateAttributes` + unit tests passing
- [x] P6 Asset code generator (transaction-safe)
- [x] P6 Assets create / list (filters, search, pagination) / get / update
- [x] P6 Map bbox endpoint
- [x] P7 Lifecycle rules (pure functions) + unit tests passing
- [x] P7 Transition service (one transaction: status + event + audit + ticket)
- [x] P7 Timeline endpoint, `allowedTransitions` on asset detail
- [x] P8 Tickets CRUD + close → asset back to In operation
- [x] P8 Preventive "log a service"
- [x] P8 Dashboard summary (aggregate queries)
- [x] P9 QR endpoint (level H, points to FRONTEND_URL)
- [x] P9 CSV import (streaming, batches, job progress, row errors)
- [x] P9 Seed: 3 types, N assets in Gandhinagar, events, tickets, reports
- [x] P9 `docs/sample-import.csv`
- [x] P10 Public endpoints (asset, nearby, report, track) + rate limits
- [x] P10 Staff reports queue: confirm / reject / photo

## Phase 3 · Frontend
- [x] P11 API client, auth context, route guards
- [x] P11 i18n (gu / hi / en) + LanguageSwitch
- [x] P11 StatusBadge, BigButton, ConfirmDialog, Layout (desktop + mobile)
- [x] P12 Dashboard page
- [x] P13 Asset list (filters in URL, mobile cards)
- [x] P13 Asset detail: lifecycle bar, allowed actions, stage-data dialogs, timeline, QR
- [ ] P14 Asset type builder with preview
- [ ] P14 Add-asset wizard (type → details → location → confirm)
- [ ] P14 CSV import screen with template download
- [ ] P15 Public home, asset page, report flow, done screen, track, nearby
- [ ] P16 Reports queue + tickets pages + "Log a service"
- [ ] P17 Map with bbox loading and CircleMarkers

## Phase 4 · Polish, prove, ship
- [ ] P18 Usability + accessibility pass done, checklist recorded
- [ ] P18 Gujarati / Hindi strings checked by a native reader
- [ ] P19 API docs at `/api/docs` (or openapi.yaml fallback)
- [ ] P20 100k-row EXPLAIN results in `docs/PERFORMANCE.md`
- [ ] P21 Final deploy, 20k seed on production DB, QR works on live site
- [ ] P22 README complete, architecture doc updated
- [ ] Architecture diagram exported as PNG (mermaid.live) and added to README
- [ ] Demo rehearsed twice on a real phone

---

## Demo script (3–4 minutes)

1. **Dashboard** — "24,000 assets across 6 wards; here's what needs attention."
2. **New asset type live** — create "Hand pump" with 2 custom fields; the add form appears automatically. *Point: works for any government asset, no code change.*
3. **Add one asset** through the wizard, then walk it Planned → Acquired → Commissioned → In operation. Try an invalid move and show the plain-language rejection. *Point: lifecycle engine.*
4. **Hand a judge your phone** — scan the QR, pick Gujarati, report "Not working" without typing. Show the tracking number.
5. **Back on the laptop** — the report is in the queue; confirm it → ticket created, asset turns "Under repair", timeline shows why.
6. **Close the ticket** → asset back in operation; the judge's phone now shows "Fixed".
7. **Scale proof** — show `docs/PERFORMANCE.md`: same query with and without indexes on 100k assets.
8. **Architecture slide** — 30-second walkthrough.

---

## Log

Claude Code appends one line per step: `HH:MM · Pxx · what was done · commit hash (if any) · notes/issues`.

| Time | Step | What was done | Commit | Notes |
|---|---|---|---|---|
| — | P0 | Reviewed all docs; recorded decisions D-19 to D-24; updated CLAUDE.md (Prisma 6 pin, lifecycle guards, error `details`, public report rule, trust proxy, SEED_PASSWORD) | — | No Docker or local Postgres on the dev machine yet; project is not a git repo yet |
| 13:09 | P1 | Scaffold: docker-compose (Postgres 16), api (Express 5 + TS, zod env validation, helmet, cors, trust proxy, /health, 404 + error handler), web (React 19 + Vite 8 + Tailwind 4 + react-router 7 placeholder) | — | TypeScript pinned to 5 and react-router to 7 (newest majors 7 and 8 are unfamiliar); Docker not on PATH in already-open terminals until they are reopened |
| 13:23 | P2 | Prisma 6 schema: 6 enums + TicketPriority, 8 models, all indexes, GIN on attributes (migration SQL + declared in schema to avoid drift), seed of 3 users via SEED_PASSWORD | — | `prisma migrate dev` hung in the non-interactive shell after applying; used `migrate deploy` + `generate` + `db seed` |
| 13:25 | P3 (prep) | render.yaml Blueprint (API + free Postgres 16, JWT_SECRET generated, NODE_VERSION 22), web/vercel.json SPA rewrite; Render build + start commands simulated locally, /health ok | — | Waiting on user: Render + Vercel dashboard clicks. P3 boxes stay unticked until the live URLs work |
| 13:28 | P4 | Login + /me (JWT sub+role), requireAuth, requireRole (+3 vitest), validate middleware with field-level details, AppError, writeAudit(tx), error handler maps AppError / Zod / Prisma P2002 + P2025 | — | Tested all 3 logins, wrong password, invalid body, missing + bad token with curl |
| 13:31 | P5 | Asset types CRUD (list paginated, get, ADMIN create/patch), field definition validation (snake_case keys, unique, select needs options), field-lock rule when assets exist, validateAttributes + 8 vitest cases, audit rows | — | Tested via curl: create Water Pump, viewer 403, field errors, duplicate name 409, patch adds optional field |
| 13:33 | P6 | Transaction-safe asset codes (atomic nextSeq increment), POST/GET/PATCH assets with attribute validation + initial LifecycleEvent + audit before/after, list filters (type, status, ward, q, overdue) paginated, bbox map endpoint capped at 2000 | — | Parallel creates got SL-000001/000002; PATCH with status returns USE_TRANSITION_ENDPOINT; field lock verified |
| 13:36 | P7 | lifecycle.rules.ts (ALLOWED/ROLE/REQUIRED maps, pure functions, 22 vitest cases), transitionAsset in one transaction with optional tx, conditional update, event + audit + auto corrective ticket, POST /:id/transition, GET /:id/timeline, allowedTransitions on detail | — | Walked WP-000001 PLANNED to UNDER_MAINTENANCE via curl; invalid move, missing stage data, officer commission, viewer, open-ticket guards all rejected with plain messages |
| 13:38 | P8 | Tickets list/create/patch/close; closing last open ticket calls lifecycle engine (tx) to return asset to IN_OPERATION, sets last/next maintenance dates, marks source report FIXED; POST /tickets/service (preventive create+close); GET /dashboard/summary with count/groupBy only | — | Verified: first close keeps asset under maintenance, last close returns it, timeline shows why; log service keeps status |
| 13:41 | P9 | QR endpoint (level H, JSON data URL -> FRONTEND_URL/a/CODE); CSV import (multer memory 10 MB, csv-parse stream, batches of 500 with one nextSeq reservation, row errors max 100, optional status column); seed: 3 types, SEED_ASSET_COUNT across 6 Gandhinagar wards, matching events, tickets, 20 reports; docs/sample-import.csv | — | 5000 assets seeded in 3.3 s; sample CSV imported 20/20; empty cells now mean not provided. CUT: import progress polling (synchronous), P19 API docs |
| 13:45 | P10 | statusMap (3 public states), rate limits (public reads, reports, login), public asset/nearby (bbox + haversine)/report (multipart photo 2 MB, 6-digit code)/track; staff queue list (no bytes), photo, confirm (ticket + ASSIGNED + lifecycle to UNDER_MAINTENANCE in one tx), reject with reason | — | Full loop via curl: report -> RECEIVED -> confirm -> BEING_REPAIRED + 1 ticket -> close -> FIXED + WORKING. 6th report in 10 min -> 429. Backend phase done 13:45 (target was 13:30) |
| 13:53 | P11 | api client (JWT, JSON/multipart, typed ApiError, blob URLs), AuthContext + RequireRole, i18n en/hi/gu (all app strings, hi/gu flagged for native review), status config + StatusBadge (icon+colour+word), BigButton, ConfirmDialog (native dialog), Field/labels, Pagination, Toast, Staff layout (sidebar/bottom nav), Public layout, Login, routes with placeholders | — | Build 117 KB gzip. Could not click-test in a browser from here: login/language/360px need a manual check |
| 13:54 | P12 | Dashboard: 4 metric cards (link to filtered lists), stacked stage bar + badge legend with counts, assets-by-type bar chart, top-5 overdue list, new public reports list; useApi hook; staff pages lazy-loaded (recharts in its own 105 KB chunk) | — | Data verified via /api/dashboard/summary; visual check at 360px still manual |
| 13:57 | P13 | Asset list: debounced search, type + stage filters, ward/overdue behind More, filters in URL, table on desktop, cards on phone, pagination. Detail: 7-stage bar with tap-to-explain, action buttons only from allowedTransitions, confirm dialog with stage-data fields and backend error, attributes, dates/money, open tickets, timeline, QR download/print; Log a service dialog (from P16) built here since it lives on this page | — | Built and type-checked; lifecycle walk verified via API in P7, UI walk still manual |
