import { api, type Page } from "./client";
import type { Priority, Ticket } from "./types";

export type TicketFilters = { status?: string; kind?: string; assetId?: string; page?: number };

export const listTickets = (f: TicketFilters) => api<Page<Ticket>>("/api/tickets", { query: f });
export const updateTicket = (id: string, body: { status?: "OPEN" | "IN_PROGRESS"; assignedToId?: string | null; priority?: Priority }) =>
  api<Ticket>(`/api/tickets/${id}`, { method: "PATCH", body });
export const closeTicket = (id: string, body: { resolutionNote: string; cost?: number }) =>
  api<{ ticket: Ticket; assetReturnedToOperation: boolean }>(`/api/tickets/${id}/close`, { body });
export const logService = (body: { assetId: string; resolutionNote: string; cost?: number }) =>
  api<{ ticket: Ticket; assetReturnedToOperation: boolean }>("/api/tickets/service", { body });
