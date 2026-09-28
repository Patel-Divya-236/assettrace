# ARCHITECTURE.md — AssetTrace

All diagrams are Mermaid. Paste any block into https://mermaid.live to export a PNG for slides or the README.

## 1. System overview

```mermaid
flowchart TB
  subgraph Clients["Clients — one React app (Vercel)"]
    S[Staff screens<br/>Admin · Field officer · Viewer]
    P[Public screens<br/>QR scan · report · track]
  end

  subgraph API["Express API — Node + TypeScript (Vercel Function, stateless)"]
    direction TB
    AUTH[JWT auth + role check]
    PUB[Public routes<br/>rate-limited, safe fields only]
    AT[Asset types<br/>custom fields]
    AS[Assets<br/>CRUD · search · map]
    LE[Lifecycle engine<br/>valid moves only]
    MT[Maintenance tickets]
    RQ[Reports queue<br/>confirm / reject]
    IMP[Bulk import<br/>streamed batches]
    DB_[Dashboard<br/>aggregate queries]
    QR[QR codes]
  end

  PG[(PostgreSQL — Neon<br/>JSONB + GIN · insert-only history)]

  S --> AUTH
  P --> PUB
  AUTH --> AT & AS & LE & MT & RQ & IMP & DB_ & QR
  PUB --> AS
  PUB --> RQ
  RQ --> LE
  MT --> LE
  AT & AS & LE & MT & RQ & IMP & DB_ --> PG

  subgraph Future["Scale path — explained, not built"]
    LB[Load balancer]
    RD[Redis cache]
    RR[(Read replica)]
    OS[Object storage]
    JQ[Job queue]
  end
  LB -.-> API
  DB_ -.-> RD
  DB_ -.-> RR
  RQ -.-> OS
  IMP -.-> JQ
```

**Key rules**
- Clients only talk to the API; only the API touches the database.
- Only the lifecycle engine changes `asset.status`. The reports queue and maintenance module call it instead of updating status themselves.
- The API is stateless (JWT), so it scales horizontally behind a load balancer.

## 2. Database (ERD)

```mermaid
erDiagram
  USER ||--o{ LIFECYCLE_EVENT : performs
  USER ||--o{ AUDIT_LOG : performs
  USER ||--o{ MAINTENANCE_TICKET : "creates / assigned"
  USER ||--o{ IMPORT_JOB : starts
  ASSET_TYPE ||--o{ ASSET : defines
  ASSET_TYPE ||--o{ IMPORT_JOB : "imports into"
  ASSET ||--o{ ASSET : "parent of"
  ASSET ||--o{ LIFECYCLE_EVENT : has
  ASSET ||--o{ MAINTENANCE_TICKET : has
  ASSET ||--o{ CITIZEN_REPORT : receives
  CITIZEN_REPORT ||--o| MAINTENANCE_TICKET : "becomes"

  USER {
    uuid id PK
    string name
    string email UK
    string passwordHash
    enum role "ADMIN | FIELD_OFFICER | VIEWER"
  }
  ASSET_TYPE {
    uuid id PK
    string name UK
    string codePrefix UK
    json fields "custom field definitions"
    int maintenanceIntervalDays
    int nextSeq "for asset codes"
  }
  ASSET {
    uuid id PK
    string assetCode UK "e.g. WP-000123"
    uuid typeId FK
    enum status "7 lifecycle stages"
    int condition "1-5"
    float lat
    float lng
    string locationText
    string ward
    uuid parentId FK
    jsonb attributes "GIN indexed"
    date acquiredDate
    decimal cost
    date nextMaintenanceDate
  }
  LIFECYCLE_EVENT {
    uuid id PK
    uuid assetId FK
    enum fromStatus
    enum toStatus
    uuid userId FK
    string note
    datetime createdAt
  }
  MAINTENANCE_TICKET {
    uuid id PK
    uuid assetId FK
    enum kind "PREVENTIVE | CORRECTIVE"
    enum status "OPEN | IN_PROGRESS | CLOSED"
    string priority
    uuid sourceReportId FK
    datetime closedAt
  }
  CITIZEN_REPORT {
    uuid id PK
    uuid assetId FK
    string category
    bytes photo
    string trackingCode UK
    enum status "RECEIVED | ASSIGNED | FIXED | REJECTED"
  }
  AUDIT_LOG {
    uuid id PK
    string entity
    uuid entityId
    string action
    json changes
    datetime createdAt
  }
  IMPORT_JOB {
    uuid id PK
    uuid typeId FK
    enum status
    int total
    int succeeded
    int failed
    json errors
  }
```

**Indexes:** `Asset(typeId)`, `Asset(status)`, `Asset(ward)`, `Asset(nextMaintenanceDate)`, `Asset(parentId)`, `Asset(lat, lng)`, GIN on `Asset(attributes)`, `LifecycleEvent(assetId, createdAt)`, `MaintenanceTicket(assetId, status)`, `CitizenReport(status)`, `AuditLog(entity, entityId)`.

## 3. Lifecycle state machine

```mermaid
stateDiagram-v2
  [*] --> PLANNED
  PLANNED --> ACQUIRED: admin · date, cost, vendor
  ACQUIRED --> COMMISSIONED: admin · commissioned date
  COMMISSIONED --> IN_OPERATION: admin
  IN_OPERATION --> UNDER_MAINTENANCE: admin / field officer / confirmed report
  UNDER_MAINTENANCE --> IN_OPERATION: last ticket closed
  IN_OPERATION --> DECOMMISSIONED: admin
  UNDER_MAINTENANCE --> DECOMMISSIONED: admin
  DECOMMISSIONED --> DISPOSED: admin · disposal method
  DISPOSED --> [*]
```

Public view maps these to 3 states: `IN_OPERATION → Working`, `UNDER_MAINTENANCE → Being repaired`, everything else → `Not in service`.

## 4. Key flows

### 4.1 Staff changes an asset's stage
```mermaid
sequenceDiagram
  actor O as Field officer
  participant W as Web app
  participant A as API
  participant L as Lifecycle engine
  participant D as PostgreSQL

  O->>W: Tap "Mark as under repair"
  W->>A: POST /api/assets/:id/transition
  A->>A: Verify JWT + role
  A->>L: transitionAsset(...)
  L->>D: BEGIN
  L->>D: Re-read asset, check move + role
  L->>D: Update status
  L->>D: Insert lifecycle event + audit row
  L->>D: Create corrective ticket
  L->>D: COMMIT
  A-->>W: Updated asset + allowedTransitions
  W-->>O: New status, timeline updated
```

### 4.2 Public report → repair → fixed
```mermaid
sequenceDiagram
  actor C as Citizen
  actor O as Field officer
  participant A as API
  participant L as Lifecycle engine
  participant D as PostgreSQL

  C->>A: Scan QR → GET /api/public/assets/SL-000142
  C->>A: POST /api/public/reports (category, optional photo)
  A->>D: Save report (RECEIVED), tracking code
  A-->>C: Tracking number 482193
  O->>A: POST /api/reports/:id/confirm
  A->>D: Create ticket, report → ASSIGNED
  A->>L: IN_OPERATION → UNDER_MAINTENANCE (source: report)
  O->>A: POST /api/tickets/:id/close
  A->>L: UNDER_MAINTENANCE → IN_OPERATION
  A->>D: Report → FIXED
  C->>A: GET /api/public/reports/482193 → Fixed
```

## 5. Deployment

```mermaid
flowchart LR
  U[Users' browsers<br/>desktop + phones] -->|HTTPS| V[Vercel<br/>React static build]
  U -->|HTTPS /api| R[Vercel Function<br/>Express API]
  R --> PG[(Neon PostgreSQL<br/>via Vercel Storage)]
  GH[GitHub repo] -->|push = deploy| V
  GH -->|push = deploy| R
```

Notes: HTTPS is required for phone GPS and camera. The API runs as one Vercel Function (zero-config Express); request bodies are capped at 4.5 MB by Vercel. Neon's free database may pause when idle; the first query after a pause takes a second or two. QR codes are generated from `FRONTEND_URL`, so they must point to the Vercel domain.

## 6. Scaling plan

| Pressure | What breaks first | Fix |
|---|---|---|
| More users | Single API instance | Stateless API → more instances behind a load balancer |
| Dashboard load | Repeated aggregate queries | Cache in Redis / materialized views refreshed every minute; read replica for reads |
| 10M+ assets | Unindexed filters | Already indexed; add composite indexes from real query patterns; PostGIS for spatial queries |
| History growth | `LifecycleEvent`, `AuditLog` tables | Partition by month, archive old partitions |
| Large imports | Single-thread CPU, restarts mid-job | Job queue (BullMQ + Redis) with workers and retries |
| Photos | Database size | Object storage (S3-compatible), store URL only |
| Spam reports | Report queue noise | OTP verification, per-device limits, duplicate detection per asset |
| Multi-state rollout | One shared database | Tenant id per department/state, row-level security |
