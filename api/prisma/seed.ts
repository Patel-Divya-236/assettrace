/**
 * Demo data: 3 users, 3 asset types, SEED_ASSET_COUNT assets (default 5000) across
 * 6 wards of Gandhinagar, lifecycle events that match each asset's status, past
 * and open tickets, and ~20 public reports.
 *
 * Safe to re-run: users and types are upserted. Assets are only generated when the
 * database has none, unless SEED_RESET=true (which deletes all asset data first).
 *
 *   npx prisma db seed
 *   SEED_ASSET_COUNT=100000 SEED_RESET=true npx prisma db seed
 */
import { randomUUID } from "node:crypto";
import { type AssetStatus, type Prisma, PrismaClient, Role, type TicketPriority } from "@prisma/client";
import bcrypt from "bcryptjs";

try {
  process.loadEnvFile();
} catch {
  // no .env file (e.g. seeding production with DATABASE_URL set in the shell)
}

const prisma = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD || "demo1234";
const ASSET_COUNT = Number(process.env.SEED_ASSET_COUNT || 5000);
const RESET = process.env.SEED_RESET === "true";
const BATCH = 2000;
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

// ---------- small helpers ----------
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
const daysAgo = (d: number) => new Date(NOW - d * DAY);
function weighted<T>(options: [T, number][]): T {
  let r = Math.random() * options.reduce((s, [, w]) => s + w, 0);
  for (const [value, w] of options) if ((r -= w) <= 0) return value;
  return options[0][0];
}
async function inBatches<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += BATCH) await insert(rows.slice(i, i + BATCH));
}

// ---------- reference data ----------
const users: { name: string; email: string; role: Role }[] = [
  { name: "Admin User", email: "admin@demo.in", role: Role.ADMIN },
  { name: "Field Officer", email: "officer@demo.in", role: Role.FIELD_OFFICER },
  { name: "Viewer", email: "viewer@demo.in", role: Role.VIEWER },
];

const types = [
  {
    name: "Streetlight",
    codePrefix: "SL",
    icon: "lightbulb",
    expectedLifeYears: 10,
    maintenanceIntervalDays: 180,
    share: 60,
    fields: [
      { key: "lamp_type", label: "Lamp type", type: "select", required: true, options: ["LED", "Sodium", "CFL"] },
      { key: "wattage", label: "Wattage (W)", type: "number", required: true },
      { key: "pole_height_m", label: "Pole height (m)", type: "number", required: false },
    ],
    attributes: () => ({
      lamp_type: weighted([["LED", 70], ["Sodium", 20], ["CFL", 10]]),
      wattage: pick([24, 40, 60, 90, 150]),
      pole_height_m: pick([6, 8, 9, 12]),
    }),
    vendors: ["Bajaj Electricals", "Havells", "Syska", "Philips India"],
    cost: [8000, 25000],
    names: ["Streetlight", "Light pole"],
  },
  {
    name: "Water Pump",
    codePrefix: "WP",
    icon: "droplet",
    expectedLifeYears: 15,
    maintenanceIntervalDays: 90,
    share: 25,
    fields: [
      { key: "pump_capacity_hp", label: "Capacity (HP)", type: "number", required: true },
      { key: "source", label: "Water source", type: "select", required: true, options: ["Borewell", "River", "Tank"] },
      { key: "motor_make", label: "Motor make", type: "text", required: false },
    ],
    attributes: () => ({
      pump_capacity_hp: pick([3, 5, 7.5, 10, 15]),
      source: weighted([["Borewell", 60], ["Tank", 30], ["River", 10]]),
      motor_make: pick(["Kirloskar", "CRI", "Texmo", "Crompton"]),
    }),
    vendors: ["Kirloskar Brothers", "CRI Pumps", "Texmo Industries"],
    cost: [40000, 250000],
    names: ["Water pump", "Borewell pump"],
  },
  {
    name: "Transformer",
    codePrefix: "TR",
    icon: "zap",
    expectedLifeYears: 25,
    maintenanceIntervalDays: 365,
    share: 15,
    fields: [
      { key: "capacity_kva", label: "Capacity (kVA)", type: "number", required: true },
      { key: "voltage_ratio", label: "Voltage ratio", type: "select", required: true, options: ["11kV/433V", "22kV/433V"] },
      { key: "oil_type", label: "Oil type", type: "select", required: false, options: ["Mineral", "Synthetic"] },
    ],
    attributes: () => ({
      capacity_kva: pick([63, 100, 250, 500]),
      voltage_ratio: weighted([["11kV/433V", 80], ["22kV/433V", 20]]),
      oil_type: weighted([["Mineral", 85], ["Synthetic", 15]]),
    }),
    vendors: ["Voltamp Transformers", "Kirloskar Electric", "Crompton Greaves"],
    cost: [300000, 1500000],
    names: ["Transformer", "Distribution transformer"],
  },
] as const;

// Gandhinagar, roughly 23.20–23.25 N, 72.62–72.68 E, split into a 3 x 2 grid of wards.
const wards = Array.from({ length: 6 }, (_, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  return {
    name: `Ward ${i + 1}`,
    lat: [23.2 + row * 0.025, 23.2 + (row + 1) * 0.025] as const,
    lng: [72.62 + col * 0.02, 72.62 + (col + 1) * 0.02] as const,
    sectors: [i * 5 + 1, i * 5 + 5] as const,
  };
});
const landmarks = ["bus stand", "primary school", "garden", "community hall", "PHC", "temple", "market", "water tank", "circle"];

// ~75% in operation, ~9% under maintenance, the rest spread across the other stages.
const statusMix: [AssetStatus, number][] = [
  ["IN_OPERATION", 75],
  ["UNDER_MAINTENANCE", 9],
  ["PLANNED", 3],
  ["ACQUIRED", 3],
  ["COMMISSIONED", 3],
  ["DECOMMISSIONED", 4],
  ["DISPOSED", 3],
];

// The path an asset took to reach its current status.
const PATH: Record<AssetStatus, AssetStatus[]> = {
  PLANNED: ["PLANNED"],
  ACQUIRED: ["PLANNED", "ACQUIRED"],
  COMMISSIONED: ["PLANNED", "ACQUIRED", "COMMISSIONED"],
  IN_OPERATION: ["PLANNED", "ACQUIRED", "COMMISSIONED", "IN_OPERATION"],
  UNDER_MAINTENANCE: ["PLANNED", "ACQUIRED", "COMMISSIONED", "IN_OPERATION", "UNDER_MAINTENANCE"],
  DECOMMISSIONED: ["PLANNED", "ACQUIRED", "COMMISSIONED", "IN_OPERATION", "DECOMMISSIONED"],
  DISPOSED: ["PLANNED", "ACQUIRED", "COMMISSIONED", "IN_OPERATION", "DECOMMISSIONED", "DISPOSED"],
};

const repairNotes = ["Light not working", "Motor making noise", "Loose wiring", "Pole tilted", "Water leaking", "Oil leak", "Fuse blown"];

async function seedUsers() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const result: Record<string, string> = {};
  for (const user of users) {
    const u = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash },
      create: { ...user, passwordHash },
    });
    result[user.role] = u.id;
  }
  console.log(`Users: ${users.map((u) => u.email).join(", ")} (password from SEED_PASSWORD)`);
  return result;
}

async function resetAssetData() {
  // Children first. History tables are insert-only in the app; only the seed wipes them.
  await prisma.maintenanceTicket.deleteMany();
  await prisma.citizenReport.deleteMany();
  await prisma.lifecycleEvent.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.asset.updateMany({ data: { parentId: null } });
  await prisma.asset.deleteMany();
  await prisma.assetType.deleteMany();
  console.log("Reset: deleted all asset data.");
}

async function main() {
  const t0 = Date.now();
  const userIds = await seedUsers();
  const adminId = userIds.ADMIN;
  const officerId = userIds.FIELD_OFFICER;

  if (RESET) await resetAssetData();

  const typeRows = [];
  for (const t of types) {
    const data = {
      name: t.name,
      icon: t.icon,
      expectedLifeYears: t.expectedLifeYears,
      maintenanceIntervalDays: t.maintenanceIntervalDays,
      fields: t.fields as unknown as Prisma.InputJsonValue,
    };
    typeRows.push(await prisma.assetType.upsert({ where: { codePrefix: t.codePrefix }, update: data, create: { ...data, codePrefix: t.codePrefix } }));
  }
  console.log(`Asset types: ${types.map((t) => t.name).join(", ")}`);

  if ((await prisma.asset.count()) > 0) {
    console.log("Assets already exist; skipping asset generation. Use SEED_RESET=true to regenerate.");
    return;
  }

  const assets: Prisma.AssetCreateManyInput[] = [];
  const events: Prisma.LifecycleEventCreateManyInput[] = [];
  const tickets: Prisma.MaintenanceTicketCreateManyInput[] = [];
  const seq: Record<string, number> = {};

  for (let i = 0; i < ASSET_COUNT; i++) {
    const typeIndex = weighted(types.map((t, idx) => [idx, t.share] as [number, number]));
    const t = types[typeIndex];
    const typeRow = typeRows[typeIndex];
    seq[t.codePrefix] = (seq[t.codePrefix] ?? 0) + 1;
    const ward = pick(wards);
    const status = weighted(statusMix);
    const id = randomUUID();
    const sector = randInt(ward.sectors[0], ward.sectors[1]);

    // Dates walk forward from planning, spread over the last ~3 years.
    const plannedAt = daysAgo(randInt(400, 1100));
    const acquiredAt = new Date(plannedAt.getTime() + randInt(15, 60) * DAY);
    const commissionedAt = new Date(acquiredAt.getTime() + randInt(7, 30) * DAY);
    const operatingAt = new Date(commissionedAt.getTime() + randInt(1, 10) * DAY);
    const path = PATH[status];
    const reached = (s: AssetStatus) => path.includes(s);
    const inService = status === "IN_OPERATION" || status === "UNDER_MAINTENANCE";

    // ~12% of in-service assets are overdue for service.
    const interval = t.maintenanceIntervalDays;
    const next = inService ? new Date(NOW + (Math.random() < 0.12 ? -randInt(1, 60) : randInt(1, interval)) * DAY) : null;

    assets.push({
      id,
      assetCode: `${t.codePrefix}-${String(seq[t.codePrefix]).padStart(6, "0")}`,
      typeId: typeRow.id,
      name: `${pick(t.names)} ${sector}-${randInt(1, 99)}`,
      status,
      condition: status === "PLANNED" ? null : weighted([[5, 20], [4, 35], [3, 25], [2, 12], [1, 8]]),
      lat: rand(ward.lat[0], ward.lat[1]),
      lng: rand(ward.lng[0], ward.lng[1]),
      locationText: `Sector ${sector}, near ${pick(landmarks)}`,
      ward: ward.name,
      attributes: t.attributes(),
      acquiredDate: reached("ACQUIRED") ? acquiredAt : null,
      cost: reached("ACQUIRED") ? Math.round(rand(t.cost[0], t.cost[1])) : null,
      vendor: reached("ACQUIRED") ? pick(t.vendors) : null,
      commissionedDate: reached("COMMISSIONED") ? commissionedAt : null,
      warrantyEnd: reached("COMMISSIONED") ? new Date(commissionedAt.getTime() + 730 * DAY) : null,
      nextMaintenanceDate: next,
      lastMaintenanceDate: next ? new Date(next.getTime() - interval * DAY) : null,
      disposalMethod: status === "DISPOSED" ? pick(["Auction", "Scrap sale", "Transferred to another department"]) : null,
      disposalValue: status === "DISPOSED" ? randInt(500, 20000) : null,
      createdAt: plannedAt,
    });

    // Lifecycle events that match the path, one per stage.
    const stageDate: Record<AssetStatus, Date> = {
      PLANNED: plannedAt,
      ACQUIRED: acquiredAt,
      COMMISSIONED: commissionedAt,
      IN_OPERATION: operatingAt,
      UNDER_MAINTENANCE: daysAgo(randInt(1, 20)),
      DECOMMISSIONED: daysAgo(randInt(40, 200)),
      DISPOSED: daysAgo(randInt(1, 39)),
    };
    path.forEach((s, idx) => {
      events.push({
        assetId: id,
        fromStatus: idx === 0 ? null : path[idx - 1],
        toStatus: s,
        userId: s === "UNDER_MAINTENANCE" ? officerId : adminId,
        note: idx === 0 ? "Asset created" : null,
        createdAt: stageDate[s],
      });
    });

    // Every asset under maintenance has an open corrective ticket (the rules require it).
    if (status === "UNDER_MAINTENANCE") {
      tickets.push({
        id: randomUUID(),
        assetId: id,
        kind: "CORRECTIVE",
        status: pick(["OPEN", "IN_PROGRESS"] as const),
        priority: weighted<TicketPriority>([["MEDIUM", 60], ["HIGH", 25], ["LOW", 15]]),
        description: pick(repairNotes),
        createdById: officerId,
        assignedToId: Math.random() < 0.5 ? officerId : null,
        openedAt: stageDate.UNDER_MAINTENANCE,
      });
    }
    // Some history: ~10% of operating assets had a past repair or service.
    if (reached("IN_OPERATION") && Math.random() < 0.1) {
      const openedAt = daysAgo(randInt(30, 300));
      tickets.push({
        id: randomUUID(),
        assetId: id,
        kind: pick(["PREVENTIVE", "CORRECTIVE"] as const),
        status: "CLOSED",
        priority: "MEDIUM",
        description: pick(repairNotes),
        createdById: officerId,
        assignedToId: officerId,
        openedAt,
        closedAt: new Date(openedAt.getTime() + randInt(1, 5) * DAY),
        cost: randInt(300, 8000),
        resolutionNote: pick(["Replaced part", "Cleaned and tested", "Rewired connection", "Serviced"]),
      });
    }
  }

  await inBatches(assets, (chunk) => prisma.asset.createMany({ data: chunk }));
  await inBatches(events, (chunk) => prisma.lifecycleEvent.createMany({ data: chunk }));

  // ~20 public reports in every state, linked to tickets where the state needs one.
  const reports: Prisma.CitizenReportCreateManyInput[] = [];
  const codes = new Set<string>();
  const trackingCode = () => {
    let c;
    do c = String(randInt(100000, 999999));
    while (codes.has(c));
    codes.add(c);
    return c;
  };
  const operating = assets.filter((a) => a.status === "IN_OPERATION");
  const openTickets = tickets.filter((tk) => tk.status !== "CLOSED");
  const closedTickets = tickets.filter((tk) => tk.status === "CLOSED");
  const reportBase = () => ({
    category: weighted([["NOT_WORKING", 50], ["BROKEN", 25], ["LEAKING", 15], ["OTHER", 10]]),
    language: weighted([["gu", 50], ["hi", 30], ["en", 20]]),
    createdAt: daysAgo(randInt(0, 10)),
  });
  for (let i = 0; i < 8 && operating.length; i++) {
    reports.push({ id: randomUUID(), assetId: pick(operating).id!, status: "RECEIVED", trackingCode: trackingCode(), ...reportBase() });
  }
  for (const tk of openTickets.slice(0, 6)) {
    const id = randomUUID();
    reports.push({ id, assetId: tk.assetId, status: "ASSIGNED", trackingCode: trackingCode(), ...reportBase() });
    tk.sourceReportId = id;
  }
  for (const tk of closedTickets.filter((tk) => tk.kind === "CORRECTIVE").slice(0, 4)) {
    const id = randomUUID();
    reports.push({ id, assetId: tk.assetId, status: "FIXED", trackingCode: trackingCode(), ...reportBase(), createdAt: tk.openedAt as Date });
    tk.sourceReportId = id;
  }
  for (let i = 0; i < 2 && operating.length; i++) {
    reports.push({ id: randomUUID(), assetId: pick(operating).id!, status: "REJECTED", rejectReason: "Asset checked on site and working", trackingCode: trackingCode(), ...reportBase() });
  }
  await prisma.citizenReport.createMany({ data: reports });
  await inBatches(tickets, (chunk) => prisma.maintenanceTicket.createMany({ data: chunk }));

  // Continue asset codes after the generated ones.
  for (const [i, t] of types.entries()) {
    await prisma.assetType.update({ where: { id: typeRows[i].id }, data: { nextSeq: (seq[t.codePrefix] ?? 0) + 1 } });
  }

  console.log(
    `Seeded ${assets.length} assets, ${events.length} lifecycle events, ${tickets.length} tickets, ${reports.length} reports in ${((Date.now() - t0) / 1000).toFixed(1)}s.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
