import { api } from "./client";
import type { PublicAsset, ReportCategory, TrackedReport } from "./types";

export const getPublicAsset = (code: string) => api<PublicAsset>(`/api/public/assets/${encodeURIComponent(code)}`);
export const getNearby = (lat: number, lng: number) => api<{ items: PublicAsset[] }>("/api/public/assets/nearby", { query: { lat, lng } });
export const trackReport = (code: string) => api<TrackedReport>(`/api/public/reports/${encodeURIComponent(code)}`);

/** Needs a logged-in citizen: the complaint is saved against their account. */
export function sendReport(data: { assetCode: string; category: ReportCategory; note?: string; language: string; photo?: Blob }) {
  const form = new FormData();
  form.append("assetCode", data.assetCode);
  form.append("category", data.category);
  form.append("language", data.language);
  if (data.note) form.append("note", data.note);
  if (data.photo) form.append("photo", data.photo, "photo.jpg");
  return api<{ trackingCode: string }>("/api/citizen/reports", { form });
}
