# TASKS.md — AssetTrace build tracker

Claude Code ticks items here after each step and adds a line to the Log. Keep this honest: it becomes the record of how the project was built.

**Hackathon start:** __:__  **Deadline:** __:__

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
1. P19 API docs → mention as "future"; show requests in curl/Postman instead
2. P17 Map → the Nearby list covers location
3. Import progress polling → import synchronously for small files
4. Field builder preview in P14
5. Never cut: lifecycle engine, public report loop, dashboard, deployment

---

## Phase 0 · Kickoff
- [x] P0 Claude summarised the plan and open questions are resolved

## Phase 1 · Foundation
- [ ] P1 Monorepo scaffold, Docker Postgres, API `/health`, web placeholder
- [ ] P1 env validation with zod, central error handler
- [ ] P2 Prisma schema, all models and enums
- [ ] P2 Indexes + GIN index on `attributes`
- [ ] P2 Seed users (admin / officer / viewer)
- [ ] P3 API deployed on Render with Postgres
- [ ] P3 Web deployed on Vercel with SPA rewrite
- [ ] P3 CORS + env vars working in production

## Phase 2 · Backend core
- [ ] P4 Login + `/me`, JWT middleware, `requireRole`
- [ ] P4 zod `validate` middleware, `AppError`, audit helper
- [ ] P5 Asset types CRUD with field definition validation
- [ ] P5 `validateAttributes` + unit tests passing
- [ ] P6 Asset code generator (transaction-safe)
- [ ] P6 Assets create / list (filters, search, pagination) / get / update
- [ ] P6 Map bbox endpoint
- [ ] P7 Lifecycle rules (pure functions) + unit tests passing
- [ ] P7 Transition service (one transaction: status + event + audit + ticket)
- [ ] P7 Timeline endpoint, `allowedTransitions` on asset detail
- [ ] P8 Tickets CRUD + close → asset back to In operation
- [ ] P8 Preventive "log a service"
- [ ] P8 Dashboard summary (aggregate queries)
- [ ] P9 QR endpoint (level H, points to FRONTEND_URL)
- [ ] P9 CSV import (streaming, batches, job progress, row errors)
- [ ] P9 Seed: 3 types, N assets in Gandhinagar, events, tickets, reports
- [ ] P9 `docs/sample-import.csv`
- [ ] P10 Public endpoints (asset, nearby, report, track) + rate limits
- [ ] P10 Staff reports queue: confirm / reject / photo

## Phase 3 · Frontend
- [ ] P11 API client, auth context, route guards
- [ ] P11 i18n (gu / hi / en) + LanguageSwitch
- [ ] P11 StatusBadge, BigButton, ConfirmDialog, Layout (desktop + mobile)
- [ ] P12 Dashboard page
- [ ] P13 Asset list (filters in URL, mobile cards)
- [ ] P13 Asset detail: lifecycle bar, allowed actions, stage-data dialogs, timeline, QR
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
