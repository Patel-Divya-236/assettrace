// Shapes returned by the API (kept in one place so pages agree).

export type Role = "ADMIN" | "OFFICER" | "FIELD_OFFICER" | "VIEWER" | "CITIZEN";
export const STAFF_ROLES: Role[] = ["ADMIN", "OFFICER", "FIELD_OFFICER", "VIEWER"];

export type AssetStatus =
  | "PLANNED"
  | "ACQUIRED"
  | "COMMISSIONED"
  | "IN_OPERATION"
  | "UNDER_MAINTENANCE"
  | "DECOMMISSIONED"
  | "DISPOSED";

export const ASSET_STATUSES: AssetStatus[] = [
  "PLANNED",
  "ACQUIRED",
  "COMMISSIONED",
  "IN_OPERATION",
  "UNDER_MAINTENANCE",
  "DECOMMISSIONED",
  "DISPOSED",
];

export type PublicStatus = "WORKING" | "BEING_REPAIRED" | "NOT_IN_SERVICE";

export type User = { id: string; name: string; email: string | null; phone: string | null; role: Role };

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  required: boolean;
  options?: string[];
};

export type AssetType = {
  id: string;
  name: string;
  codePrefix: string;
  icon: string | null;
  fields: FieldDef[];
  expectedLifeYears: number | null;
  maintenanceIntervalDays: number | null;
  _count?: { assets: number };
};

export type TypeSummary = Pick<AssetType, "id" | "name" | "codePrefix" | "icon">;

export type AssetListItem = {
  id: string;
  assetCode: string;
  name: string;
  status: AssetStatus;
  condition: number | null;
  locationText: string;
  ward: string | null;
  nextMaintenanceDate: string | null;
  updatedAt: string;
  type: TypeSummary;
};

export type Asset = {
  id: string;
  assetCode: string;
  name: string;
  status: AssetStatus;
  condition: number | null;
  lat: number;
  lng: number;
  locationText: string;
  ward: string | null;
  parentId: string | null;
  attributes: Record<string, string | number>;
  acquiredDate: string | null;
  cost: string | null; // Decimal arrives as a string
  vendor: string | null;
  commissionedDate: string | null;
  warrantyEnd: string | null;
  lastMaintenanceDate: string | null;
  nextMaintenanceDate: string | null;
  disposalMethod: string | null;
  disposalValue: string | null;
  createdAt: string;
  updatedAt: string;
  type: AssetType;
  parent: { id: string; assetCode: string; name: string } | null;
  openTicketCount: number;
  childCount: number;
  allowedTransitions: AssetStatus[];
};

export type LifecycleEvent = {
  id: string;
  fromStatus: AssetStatus | null;
  toStatus: AssetStatus;
  note: string | null;
  createdAt: string;
  user: { id: string; name: string; role: Role } | null;
};

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";
export type Priority = "LOW" | "MEDIUM" | "HIGH";

export type Ticket = {
  id: string;
  assetId: string;
  kind: "PREVENTIVE" | "CORRECTIVE";
  status: TicketStatus;
  priority: Priority;
  description: string | null;
  openedAt: string;
  closedAt: string | null;
  cost: string | null;
  resolutionNote: string | null;
  sourceReportId: string | null;
  inspectionNote: string | null;
  inspectedAt: string | null;
  estimatedCost: string | null;
  needsApproval: boolean;
  approvalReason: string | null;
  approvedAt: string | null;
  contractor: { id: string; name: string; firm: string | null; phone: string } | null;
  updates: { id: string; note: string; progress: number | null; createdAt: string }[];
  asset: { id: string; assetCode: string; name: string; status: AssetStatus; locationText: string };
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
};

export type ReportCategory = "NOT_WORKING" | "BROKEN" | "LEAKING" | "OTHER";
export type ReportStatus = "RECEIVED" | "ASSIGNED" | "FIXED" | "REJECTED";

export type StaffReport = {
  id: string;
  category: ReportCategory;
  note: string | null;
  phone: string | null;
  language: string;
  trackingCode: string;
  status: ReportStatus;
  rejectReason: string | null;
  hasPhoto: boolean;
  createdAt: string;
  asset: {
    id: string;
    assetCode: string;
    name: string;
    status: AssetStatus;
    locationText: string;
    type: { name: string; icon: string | null };
  };
  ticket: { id: string; status: TicketStatus } | null;
  reporter: { name: string; phone: string | null } | null;
};

export type PublicAsset = {
  assetCode: string;
  type: { name: string; icon: string | null };
  publicStatus: PublicStatus;
  canReport: boolean;
  locationText: string;
  ward: string | null;
  lastRepairedAt: string | null;
  distanceMeters?: number;
};

export type TrackedReport = {
  trackingCode: string;
  status: ReportStatus;
  category: ReportCategory;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
  assetCode: string;
  assetType: { name: string; icon: string | null };
  inspected: boolean;
  contractorWorking: boolean;
  progress: number | null;
};

export type DashboardSummary = {
  totalAssets: number;
  byStatus: { status: AssetStatus; count: number }[];
  byType: { typeId: string; name: string; icon: string | null; count: number }[];
  byCondition: { condition: number | null; count: number }[];
  overdueMaintenance: number;
  openTickets: number;
  newPublicReports: number;
  topOverdue: {
    id: string;
    assetCode: string;
    name: string;
    status: AssetStatus;
    locationText: string;
    nextMaintenanceDate: string;
    type: { name: string; icon: string | null };
  }[];
};

export type ImportJob = {
  id: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  total: number;
  succeeded: number;
  failed: number;
  errors: { row: number; message: string }[];
};
