# PROMPTS.md — Claude Code prompt sequence

Paste these into Claude Code **one at a time, in order**. After each one:

1. Read the "What I did and why" section Claude writes. If you can't explain something, ask (see the helper prompts at the end).
2. Test it yourself using the "Done when" checks.
3. Run `/checkpoint` (or commit manually with the suggested message).

Time budgets assume an 8-hour hackathon. If a step runs 20+ minutes over, cut scope, don't push on.

---

## Phase 0 — Kickoff (10 min)

### P0 · Understand before coding
> Tip: switch Claude Code to **plan mode** (Shift+Tab) for this prompt.

```
Read CLAUDE.md and everything in docs/. Do not write any code yet.

Then give me:
1. A 10-line summary of what we are building, in your own words.
2. The build order you will follow (it should match docs/TASKS.md).
3. Any contradictions, gaps, or risks you see in the plan, and what you suggest.
4. Anything you need me to decide before starting.
```

**Done when:** the summary matches the plan and open questions are answered.

---

## Phase 1 — Foundation (50 min)

### P1 · Scaffold the project
```
Step P1: Scaffold the project exactly as in CLAUDE.md section 5.

- Root: docker-compose.yml with Postgres 16 (user/pass/db = assettrace, port 5432, named volume), a root .gitignore (node_modules, dist, .env, etc.).
- api/: Node + TypeScript + Express. package.json scripts: dev (tsx watch), build (tsc), start (node dist/index.js), test (vitest). tsconfig for Node 20. src/config/env.ts that loads and validates env vars with zod and fails fast with a clear message if any are missing. src/app.ts (express app with helmet, cors from CORS_ORIGINS, json body limit 1mb) and src/index.ts (starts server). GET /health returns { status: "ok" }. A central errorHandler middleware returning the error shape from CLAUDE.md section 7. api/.env.example.
- web/: React + Vite + TypeScript + Tailwind, react-router with a placeholder Home page, web/.env.example.

Install only the libraries listed in CLAUDE.md section 4 that are needed for this step. Run both apps and confirm they start. Give me the exact commands to run everything.
```

**Done when:** `docker compose up -d`, `npm run dev` in `api` and `web` all work; `http://localhost:4000/health` returns ok.

### P2 · Database schema
```
Step P2: Create the Prisma schema in api/prisma/schema.prisma.

Enums: Role (ADMIN, FIELD_OFFICER, VIEWER), AssetStatus (PLANNED, ACQUIRED, COMMISSIONED, IN_OPERATION, UNDER_MAINTENANCE, DECOMMISSIONED, DISPOSED), TicketKind (PREVENTIVE, CORRECTIVE), TicketStatus (OPEN, IN_PROGRESS, CLOSED), ReportStatus (RECEIVED, ASSIGNED, FIXED, REJECTED), ImportStatus (PENDING, RUNNING, DONE, FAILED).

Models (use the ERD in docs/ARCHITECTURE.md as the reference):
- User: id, name, email (unique), passwordHash, role, createdAt
- AssetType: id, name (unique), codePrefix (unique, 2–4 uppercase letters), icon (string, optional), fields (Json), expectedLifeYears (int, optional), maintenanceIntervalDays (int, optional), nextSeq (int, default 1), createdAt
- Asset: id, assetCode (unique), typeId, name, status (default PLANNED), condition (int 1–5, optional), lat, lng (Float), locationText, ward (optional), parentId (optional self-relation), attributes (Json), acquiredDate, cost (Decimal), vendor, commissionedDate, warrantyEnd, lastMaintenanceDate, nextMaintenanceDate, disposalMethod, disposalValue (all optional), createdAt, updatedAt
- LifecycleEvent: id, assetId, fromStatus (optional), toStatus, userId (optional), note (optional), createdAt
- MaintenanceTicket: id, assetId, kind, status (default OPEN), priority (LOW/MEDIUM/HIGH as string or enum), description, createdById (optional), assignedToId (optional), sourceReportId (optional, unique), openedAt, closedAt, cost, resolutionNote
- CitizenReport: id, assetId, category (string), note, photo (Bytes, optional), photoMime, phone (optional), language, trackingCode (unique), status (default RECEIVED), rejectReason, createdAt, updatedAt
- AuditLog: id, entity, entityId, action, userId (optional), changes (Json), createdAt
- ImportJob: id, typeId, status, total, succeeded, failed, errors (Json), createdById, createdAt, finishedAt

Indexes: Asset(typeId), Asset(status), Asset(ward), Asset(nextMaintenanceDate), Asset(parentId), Asset(lat, lng), LifecycleEvent(assetId, createdAt), MaintenanceTicket(assetId, status), CitizenReport(status), AuditLog(entity, entityId).

GIN index on Asset.attributes: create the migration with --create-only, then add
CREATE INDEX asset_attributes_gin ON "Asset" USING GIN (attributes jsonb_path_ops);
to the migration SQL, then apply it.

Add a minimal prisma/seed.ts that creates one user per role (admin@demo.in, officer@demo.in, viewer@demo.in, password "demo1234", hashed with bcryptjs). Configure "prisma db seed". Run the migration and seed.
```

**Done when:** `npx prisma studio` shows all tables and the 3 users.

### P3 · Deploy the skeleton early
```
Step P3: Deploy the skeleton now so deployment problems show up early, not at the end.

1. api: make sure `npm run build` + `npm start` work, the server listens on process.env.PORT, and `prisma migrate deploy` runs before start. Give me the exact Render settings: root directory, build command (npm ci && npx prisma generate && npm run build), start command (npx prisma migrate deploy && npm start), and env vars.
2. Postgres: steps to create a Render Postgres instance and use its internal URL for DATABASE_URL.
3. web: Vercel settings (root directory web, VITE_API_URL). Add web/vercel.json with a rewrite sending all routes to /index.html so deep links like /a/SL-000001 don't 404.
4. CORS: CORS_ORIGINS must include the Vercel domain.

Give me a numbered click-by-click checklist and the 5 most common errors to look for in the logs.
```

**Done when:** the deployed `/health` returns ok and the deployed web page loads.

---

## Phase 2 — Backend core (2 hours)

### P4 · Auth, roles, validation, audit
```
Step P4: Build the shared backend plumbing.

- modules/auth: POST /api/auth/login (email + password → JWT with userId and role, expires JWT_EXPIRES_IN) and GET /api/auth/me.
- middleware/auth.ts: verifies the Bearer token, attaches req.user; 401 with clear error if missing/invalid.
- middleware/requireRole.ts: requireRole('ADMIN', 'FIELD_OFFICER') style; 403 with clear error.
- middleware/validate.ts: validates body/query/params with a zod schema; 400 with field-level messages.
- lib/audit.ts: writeAudit(tx, { entity, entityId, action, userId, changes }) that works inside a Prisma transaction.
- An AppError class (code, message, httpStatus) used by all services, handled by errorHandler.

Test manually with curl: login as each role, call /api/auth/me, and show a 401 and a 403 example.
```

**Done when:** login works for all 3 users; wrong password and missing token give clear errors.

### P5 · Asset types + attribute validation
```
Step P5: Asset types.

- modules/assetTypes: GET /api/asset-types, GET /api/asset-types/:id (any staff), POST and PATCH (ADMIN only). Validate that `fields` is an array of { key (snake_case, unique within the type), label, type: text|number|date|select, required: boolean, options?: string[] (required when type = select) }.
- PATCH may add new fields or change labels, but must not remove a field or change its type if any asset of that type already exists (return a clear error explaining why).
- lib/attributes.ts: validateAttributes(fields, attributes) → returns cleaned attributes or throws AppError listing every problem (missing required, wrong type, invalid select option, unknown key). Numbers stored as numbers, dates as ISO strings.
- Unit tests with vitest for validateAttributes covering: valid input, missing required field, wrong number, bad date, invalid select option, unknown key.

Every create/update writes an audit row. Run the tests.
```

**Done when:** tests pass; you can create a "Water Pump" type with custom fields via curl.

### P6 · Assets CRUD, codes, search, map
```
Step P6: Assets.

- lib/assetCode.ts: inside a transaction, increment AssetType.nextSeq and return codes like WP-000001 (6-digit padding). Explain why this is safe when two requests arrive at the same time.
- POST /api/assets (ADMIN): body includes typeId, name, lat, lng, locationText, ward?, parentId?, attributes, optional condition. Attributes validated with validateAttributes. New assets start as PLANNED and get an initial LifecycleEvent (fromStatus null → PLANNED).
- GET /api/assets (any staff): filters typeId, status, ward, q (search on assetCode, name, locationText — case-insensitive), overdue=true (nextMaintenanceDate < now), paginated per CLAUDE.md section 7, sorted by updatedAt desc.
- GET /api/assets/map?bbox=minLng,minLat,maxLng,maxLat&typeId&status: returns only id, assetCode, typeId, status, lat, lng; max 2000 rows.
- GET /api/assets/:id: full asset + its type (with fields) + open ticket count + allowedTransitions (leave allowedTransitions as an empty array for now; P7 fills it).
- PATCH /api/assets/:id (ADMIN): edit name, location, attributes, condition. Must NOT allow changing status (return an error pointing to the transition endpoint). Audit row with before/after changes.
```

**Done when:** create 2 assets of different types, list/filter/search them, and get one by id.

### P7 · Lifecycle engine
```
Step P7: The lifecycle engine — the heart of the system.

- modules/lifecycle/lifecycle.rules.ts: ALLOWED_TRANSITIONS map and ROLE_TRANSITIONS (which roles can make which moves) exactly as in CLAUDE.md section 6.1 and 6.2, plus REQUIRED_FIELDS per target stage. Pure functions only (no database): canTransition(from, to, role) and getAllowedTransitions(from, role).
- modules/lifecycle/lifecycle.service.ts: transitionAsset({ assetId, toStatus, userId, role, note, stageData, source }) that runs in ONE Prisma transaction: re-read the asset, validate move + role + required stage data, update status and stage fields, insert LifecycleEvent, insert AuditLog, and if moving to UNDER_MAINTENANCE from staff (source !== 'REPORT') create a CORRECTIVE ticket.
- POST /api/assets/:id/transition { toStatus, note?, stageData? } using the service.
- GET /api/assets/:id/timeline: lifecycle events newest first, with user names.
- Fill allowedTransitions in GET /api/assets/:id using getAllowedTransitions for the current user's role.
- Invalid moves return code INVALID_TRANSITION with a plain message like "An asset that is Planned can't be Disposed. Next allowed step: Acquired."
- Vitest unit tests for lifecycle.rules.ts: every valid move passes, sample invalid moves fail, field officer can't decommission, DISPOSED has no next moves.

Explain why this module is the only place allowed to change asset.status.
```

**Done when:** tests pass; move an asset PLANNED → … → IN_OPERATION → UNDER_MAINTENANCE via curl, see a ticket created and the full timeline; an invalid move is rejected.

### P8 · Maintenance tickets + dashboard
```
Step P8: Maintenance and dashboard.

- modules/maintenance: GET /api/tickets (filters: status, kind, assetId, paginated), POST /api/tickets (create PREVENTIVE or CORRECTIVE ticket for an asset), PATCH /api/tickets/:id (status, assignedToId, priority), POST /api/tickets/:id/close { resolutionNote, cost? }.
- Closing rule (CLAUDE.md 6.1): if this was the asset's last open ticket and the asset is UNDER_MAINTENANCE, call the lifecycle service to move it back to IN_OPERATION (do not update status directly), set lastMaintenanceDate and nextMaintenanceDate. If the ticket came from a public report, set that report to FIXED.
- "Log a service" for preventive maintenance: creating + closing a PREVENTIVE ticket updates lastMaintenanceDate/nextMaintenanceDate without changing status.
- modules/dashboard: GET /api/dashboard/summary returning: total assets, counts by status, counts by type, counts by condition, overdue maintenance count, open tickets count, new public reports count, top 5 most overdue assets. Use aggregate queries only.
```

**Done when:** closing a corrective ticket returns the asset to In operation and the timeline shows it; the summary endpoint returns sensible numbers.

### P9 · QR codes, CSV import, big seed data
```
Step P9: QR, bulk import, and realistic seed data.

(a) GET /api/assets/:id/qr → PNG (qrcode library, errorCorrectionLevel 'H', width 512) encoding `${FRONTEND_URL}/a/${assetCode}`, with the asset code printed as text under the code (compose it or return JSON { png, assetCode } — pick the simpler and explain).

(b) Imports: POST /api/imports (ADMIN, multipart: file + typeId, CSV max 10 MB). Create an ImportJob (PENDING), respond immediately with its id, then process in the background: stream-parse with csv-parse, validate each row (required columns: name, lat, lng, locationText; other columns map to the type's field keys), insert valid rows in batches of 500 using createMany (codes from a single nextSeq reservation per batch), collect row-level errors (max 100 stored). Update job counts as it goes. GET /api/imports/:id returns progress. Explain why streaming + batches keeps Node's single thread free for other users.

(c) prisma/seed.ts: keep the users, add 3 asset types (Streetlight SL, Water Pump WP, Transformer TR) with sensible custom fields and maintenance intervals, then generate assets spread across 6 wards of Gandhinagar (use realistic lat/lng around 23.20–23.25 N, 72.62–72.68 E) with a realistic status mix (~75% in operation, ~9% under maintenance, the rest spread across other stages), lifecycle events matching each asset's status, some past tickets, and ~20 public reports. The asset count comes from an env var SEED_ASSET_COUNT (default 5000). Use createMany in batches. Also produce a sample CSV at docs/sample-import.csv with 20 streetlight rows.
```

**Done when:** seeding 5,000 assets takes under a minute; importing the sample CSV works; the QR opens the right URL.

### P10 · Public API + reports queue
```
Step P10: Public access and the reports queue (CLAUDE.md section 6.3).

- lib/statusMap.ts: toPublicStatus(status) → WORKING | BEING_REPAIRED | NOT_IN_SERVICE.
- modules/public (no auth, express-rate-limit: 60 req/min per IP for reads, 5 reports per 10 min per IP):
  - GET /api/public/assets/:assetCode → safe fields only (assetCode, type name + icon, publicStatus, locationText, ward, lastMaintenanceDate).
  - GET /api/public/assets/nearby?lat&lng → up to 20 assets within ~1 km: first filter with a lat/lng bounding box (uses the index), then compute distance with the haversine formula; return distance in metres, sorted nearest first.
  - POST /api/public/reports (multipart): assetCode, category (NOT_WORKING | BROKEN | LEAKING | OTHER), note?, phone? (10-digit Indian mobile), language, photo? (jpeg/png/webp, max 2 MB, stored as Bytes). Generate a unique 6-digit trackingCode (retry on collision). Return { trackingCode }.
  - GET /api/public/reports/:trackingCode → status, category, asset code, createdAt, updatedAt (no phone, no photo).
- modules/reports (staff, ADMIN + FIELD_OFFICER): GET /api/reports?status (paginated, no photo bytes in list), GET /api/reports/:id/photo (serves the image), POST /api/reports/:id/confirm { priority } → in one transaction: create CORRECTIVE ticket with sourceReportId, set report ASSIGNED, and if the asset is IN_OPERATION call the lifecycle service with source 'REPORT'. POST /api/reports/:id/reject { reason } → REJECTED.

Explain the security reasoning for each public endpoint.
```

**Done when:** a report filed with curl appears in the staff queue; confirming it creates a ticket and moves the asset; closing the ticket marks the report FIXED; tracking shows each state.

---

## Phase 3 — Frontend (2.5 hours)

### P11 · Frontend foundation + design system
```
Step P11: Frontend foundation. Follow CLAUDE.md section 8 strictly.

- api/client.ts: fetch wrapper with base URL from VITE_API_URL, JWT from localStorage, JSON + multipart support, throws typed errors with the backend error code.
- lib/auth.ts + an AuthContext: login, logout, current user, role; a <RequireRole> route guard.
- i18n: react-i18next with en.json, hi.json, gu.json. Include translations for: all 7 lifecycle stages (label + one-line explanation), the 3 public states, all error codes, navigation, and common buttons. LanguageSwitch component (ગુજરાતી | हिंदी | English) saved in localStorage.
- lib/status.ts: one config mapping each status to icon, colour classes, and i18n key. StatusBadge component: icon + colour + word, never colour alone.
- Reusable components: BigButton (min height 48px), ConfirmDialog (plain-language confirm), PageHeader, EmptyState, Pagination, a toast for success/error messages.
- Layout for staff: sidebar on desktop, bottom nav on mobile, language switch and user menu always visible.
- Tailwind: base font sizes in rem, high-contrast colour palette, visible focus rings.
- Routes: /login, staff routes under /app/*, public routes at / and /a/:assetCode etc. (placeholders for now).

Mark every Gujarati and Hindi string I should get checked by a native speaker with a TODO comment in the JSON.
```

**Done when:** you can log in, see the empty layout, switch language, and the layout works at 360px width.

### P12 · Dashboard
```
Step P12: Staff Dashboard page (/app) using GET /api/dashboard/summary.

- Top: 4 metric cards — Total assets, Working, Under repair, Overdue service — each with an icon.
- Lifecycle stage breakdown as a horizontal stacked bar (recharts) with a legend using StatusBadge colours.
- Assets by type (bar chart).
- Two lists: "Service overdue" (top 5, click → asset detail) and "New public reports" (click → reports queue).
- Loading skeletons and friendly empty states.
- Works on a phone (cards stack in 2 columns).
```

**Done when:** the dashboard shows seeded data correctly on desktop and mobile widths.

### P13 · Asset list + asset detail
```
Step P13: Asset list and detail.

List (/app/assets): search box + filters for type and status visible; ward and "overdue only" behind a "More filters" button. Table on desktop, cards on mobile, pagination, StatusBadge on each row. Filters are kept in the URL query string.

Detail (/app/assets/:id):
- Header: asset code, type, name, location, StatusBadge.
- Lifecycle progress bar showing all 7 stages with the current one highlighted and each stage's one-line explanation on hover/tap.
- Action buttons rendered ONLY from allowedTransitions returned by the API, with plain-language labels (e.g. "Mark as under repair"). Each opens ConfirmDialog; if the target stage needs data (acquired date/cost/vendor, commissioned date, disposal method), the dialog shows those fields.
- Show the backend's error message if a move is rejected.
- Sections: custom attributes (labels from the type's fields), dates, open tickets, history timeline (GET /timeline), QR code image with Download and Print buttons.
```

**Done when:** you can walk an asset through its whole lifecycle from the UI and see every step in its history.

### P14 · Asset types builder, add-asset wizard, CSV import
```
Step P14: Admin setup screens.

- Asset types (/app/asset-types): list types; "New asset type" form: name, code prefix, maintenance interval, and a field builder (add/remove/reorder rows: label → auto key, type dropdown, required toggle, options input for select). Show a live preview of the form the fields will generate.
- Add asset wizard (/app/assets/new): Step 1 choose type (big cards with icons) → Step 2 details (form generated dynamically from the type's fields, with example placeholders) → Step 3 location (click on a small Leaflet map to set lat/lng, or "Use my current location", plus location text and ward) → Step 4 review and confirm.
- Edit asset reuses steps 2–3.
- Import (/app/import): choose type, download a CSV template generated from that type's fields, upload, then a progress bar polling GET /api/imports/:id, and a table of row errors at the end.
```

**Done when:** you can create a brand-new asset type live, add an asset of that type through the wizard, and import the sample CSV.

### P15 · Public screens
```
Step P15: Public screens (no login), mobile-first, following every rule in CLAUDE.md section 8. Body text ≥ 18px, buttons ≥ 56px tall on these pages.

- Home (/): language choice shown prominently on first visit; three big buttons with icons: Scan QR (explain "Open your phone camera and point it at the code on the pole or pump"), Assets near me, Track my complaint.
- Public asset page (/a/:assetCode): one large status block (icon + colour + word from the 3 public states), asset type, location text, last repaired date, asset code, one large "Report a problem" button. Friendly "not found" page telling the user to check the number on the plate.
- Report problem (/a/:assetCode/report): 4 picture buttons (Not working, Broken, Leaking, Other), optional photo (compress in the browser to max ~1280px / ~100 KB using a canvas before upload), optional phone, optional note, one Send button. No typing required.
- Report done: tracking number in very large digits, "Write this number down" message, and a button to track it.
- Track (/track): enter tracking number (numeric keypad), 3-step progress: Received → Worker assigned → Fixed (or Rejected with reason).
- Nearby (/nearby): ask for location, show a simple list with StatusBadge (public version) and distance ("200 m away"); handle location-denied with a clear message.
```

**Done when:** on a real phone, someone can scan a QR, report a problem without typing, and track it.

### P16 · Staff reports queue + tickets
```
Step P16: Staff work screens.

- Reports queue (/app/reports): tabs New / Assigned / Fixed / Rejected; each card shows asset code, category icon, time ago, photo thumbnail (lazy-loaded), note. Buttons: Confirm (choose priority) and Reject (reason required). After confirming, show a link to the created ticket.
- Tickets (/app/tickets): filters (status, kind), each ticket shows asset, priority, age; actions: assign to me, mark in progress, close (resolution note + optional cost). Show a toast when closing returns the asset to "In operation".
- On the asset detail page add a "Log a service" button (preventive) for ADMIN and FIELD_OFFICER.
```

**Done when:** the full loop works in the UI — public report → confirm → ticket → close → asset working again → report shows Fixed on the public track page.

### P17 · Map
```
Step P17: Map page (/app/map), lazy-loaded route.

react-leaflet with OpenStreetMap tiles, centred on Gandhinagar. Fetch /api/assets/map with the current bounding box whenever the map stops moving (debounce 300 ms). Draw CircleMarkers coloured by status (with a legend showing icon + word). Click a marker → popup with asset code, type, StatusBadge, "Open" link. Filters for type and status. Show a small notice when the 2,000-result cap is reached ("Zoom in to see all assets").
```

**Done when:** panning around loads assets smoothly with 5,000+ seeded assets.

---

## Phase 4 — Polish, prove, ship (1.5 hours)

### P18 · Usability and accessibility pass
```
Step P18: Review every page against CLAUDE.md section 8 and fix what fails. Check specifically:
- any hardcoded English strings
- any status shown by colour alone
- touch targets under 48px, text too small on public pages
- missing labels / aria-labels, keyboard navigation, visible focus
- layouts breaking at 360px width
- technical words shown to users (enum names, error codes, "404")
- bundle size: report the production build size and lazy-load anything heavy
Give me a checklist of what you found and fixed.
```

### P19 · API docs (time-box: 30 minutes)
```
Step P19: Add OpenAPI docs at /api/docs using @asteasolutions/zod-to-openapi and swagger-ui-express, generated from the existing zod schemas for: auth, asset types, assets, transition, tickets, public endpoints. If this is taking more than 30 minutes, stop and instead write a concise hand-written openapi.yaml for the 10 most important endpoints.
```

### P20 · Prove it scales
```
Step P20: Give me a script (api/scripts/explain.ts or plain SQL in docs/) that:
1. Seeds 100,000 assets locally (SEED_ASSET_COUNT=100000).
2. Runs EXPLAIN ANALYZE on: filter by status + typeId with pagination; overdue maintenance query; search on attributes JSONB (e.g. attributes @> '{"lamp_type":"LED"}').
3. Drops the relevant indexes, runs the same queries, then recreates the indexes.
Output a short table of timings with and without indexes into docs/PERFORMANCE.md, and explain how to read the EXPLAIN output (Seq Scan vs Index Scan / Bitmap Index Scan).
```

### P21 · Final deploy
```
Step P21: Final deployment check.
- Redeploy api and web. Seed the deployed database with SEED_ASSET_COUNT=20000 (run the seed locally against the deployed DATABASE_URL).
- Verify: FRONTEND_URL points to the Vercel domain so QR codes open the live site; CORS allows it; /a/:assetCode deep links work; geolocation works on HTTPS.
- Give me a pre-demo checklist, including waking the Render service a few minutes before the demo (free instances sleep after inactivity).
```

### P22 · README and docs
```
Step P22: Fill in README.md from its template using the actual code: features, screenshots placeholders, setup commands, env vars, demo logins, API overview, architecture (link docs/ARCHITECTURE.md), design decisions (link docs/DECISIONS.md), performance results (docs/PERFORMANCE.md), known limitations, future scope, and the "How we used AI" section (fill it honestly from docs/TASKS.md log). Update docs/ARCHITECTURE.md if anything changed during the build.
```

---

## Helper prompts (use any time)

### When something breaks
```
This is broken: [what I did] → [what I expected] → [what happened].
Error / logs:
[paste]
Find the root cause before changing anything. Explain the cause in plain words, then make the smallest fix. Don't rewrite unrelated code.
```

### When I don't understand code
```
Explain [file or function] to me like I'm explaining it in an interview:
what problem it solves, how it works step by step, why it's written this way,
what would break if we removed it, and one alternative approach with its trade-off.
```

### Interview practice
```
Act as a senior engineer interviewing me about this project. Ask me one tough question at a time about the architecture, database design, lifecycle engine, security of the public API, or scaling. Wait for my answer, then tell me what was strong, what was missing, and the ideal answer.
```

### Scope check (when running behind)
```
We have [X] hours left. Look at docs/TASKS.md and tell me what to cut so that the demo flow in README works end to end. Prioritise a working loop over extra features.
```
