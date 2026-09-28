import { api, type Page } from "./client";
import type { Asset, AssetListItem, AssetStatus, AssetType, LifecycleEvent, Ticket } from "./types";

export type AssetFilters = {
  q?: string;
  typeId?: string;
  status?: string;
  ward?: string;
  overdue?: string;
  page?: number;
  pageSize?: number;
};

export const listAssets = (f: AssetFilters) => api<Page<AssetListItem>>("/api/assets", { query: f });
export const getAsset = (id: string) => api<Asset>(`/api/assets/${id}`);
export const getTimeline = (id: string) => api<Page<LifecycleEvent>>(`/api/assets/${id}/timeline`, { query: { pageSize: 100 } });
export const getQr = (id: string) => api<{ assetCode: string; url: string; png: string }>(`/api/assets/${id}/qr`);
export const getOpenTickets = (assetId: string) =>
  api<Page<Ticket>>("/api/tickets", { query: { assetId, status: "ACTIVE", pageSize: 50 } });

export const transition = (id: string, body: { toStatus: AssetStatus; note?: string; stageData?: Record<string, string | number> }) =>
  api<Asset>(`/api/assets/${id}/transition`, { body });

export type AssetInput = {
  typeId: string;
  name: string;
  lat: number;
  lng: number;
  locationText: string;
  ward?: string;
  attributes: Record<string, string | number>;
  condition?: number;
};
export const createAsset = (body: AssetInput) => api<Asset>("/api/assets", { body });
export const updateAsset = (id: string, body: Partial<Omit<AssetInput, "typeId">>) =>
  api<Asset>(`/api/assets/${id}`, { method: "PATCH", body });

export const listTypes = () => api<Page<AssetType>>("/api/asset-types", { query: { pageSize: 100 } });
