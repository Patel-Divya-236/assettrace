import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { closeTicket, listTickets, updateTicket } from "../../api/tickets";
import type { Ticket } from "../../api/types";
import Icon from "../../components/Icon";
import { useToast } from "../../components/Toast";
import { BigButton, ConfirmDialog, EmptyState, ErrorBox, Field, inputClass, Loading, PageHeader, Pagination, StatusBadge } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { errorMessage, timeAgo } from "../../lib/format";
import { useApi } from "../../lib/useApi";

const PRIORITY_CLASS = { HIGH: "bg-red-100 text-red-900", MEDIUM: "bg-amber-100 text-amber-900", LOW: "bg-gray-100 text-gray-800" };

export default function Tickets() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const canAct = user?.role === "ADMIN" || user?.role === "FIELD_OFFICER";
  const [params, setParams] = useSearchParams();
  const filters = {
    status: params.get("status") ?? "ACTIVE",
    kind: params.get("kind") ?? undefined,
    assetId: params.get("assetId") ?? undefined,
    page: Number(params.get("page") ?? 1),
  };
  const list = useApi(() => listTickets(filters), [params.toString()]);
  const [closing, setClosing] = useState<Ticket | null>(null);
  const [note, setNote] = useState("");
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const setFilter = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    next.delete("page");
    setParams(next, { replace: true });
  };

  async function quick(tk: Ticket, body: Parameters<typeof updateTicket>[1]) {
    try {
      await updateTicket(tk.id, body);
      list.reload();
    } catch (err) {
      toast("error", errorMessage(err));
    }
  }

  async function close() {
    if (!closing) return;
    setBusy(true);
    setError(null);
    try {
      const res = await closeTicket(closing.id, { resolutionNote: note.trim(), cost: cost ? Number(cost) : undefined });
      // Tell the user when closing put the asset back in operation.
      toast("success", res.assetReturnedToOperation ? t("tickets.backInOperation", { code: closing.asset.assetCode }) : t("tickets.closed"));
      setClosing(null);
      setNote("");
      setCost("");
      list.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t("tickets.title")} />
      <div className="mb-4 grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-gray-200 sm:grid-cols-2">
        <Field label={t("tickets.stateLabel")}>
          {(id) => (
            <select id={id} value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className={inputClass}>
              <option value="ACTIVE">
                {t("tickets.state.OPEN")} + {t("tickets.state.IN_PROGRESS")}
              </option>
              {(["OPEN", "IN_PROGRESS", "CLOSED"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`tickets.state.${s}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t("tickets.kindLabel")}>
          {(id) => (
            <select id={id} value={filters.kind ?? ""} onChange={(e) => setFilter("kind", e.target.value)} className={inputClass}>
              <option value="">{t("common.all")}</option>
              {(["CORRECTIVE", "PREVENTIVE"] as const).map((k) => (
                <option key={k} value={k}>
                  {t(`tickets.kind.${k}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        {filters.assetId && (
          <BigButton variant="ghost" icon="x" onClick={() => setFilter("assetId", "")}>
            {t("assets.clear")}
          </BigButton>
        )}
      </div>

      {list.error ? (
        <ErrorBox message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.items.length === 0 ? (
        <EmptyState icon="wrench" message={t("tickets.none")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.data.items.map((tk) => (
            <li key={tk.id} className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-gray-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-sm font-bold ${PRIORITY_CLASS[tk.priority]}`}>
                  {t("tickets.priorityLabel")}: {t(`tickets.priority.${tk.priority}`)}
                </span>
                <span className="font-semibold">{t(`tickets.kind.${tk.kind}`)}</span>
                <span className="text-sm text-gray-600">· {t(`tickets.state.${tk.status}`)}</span>
                <span className="ml-auto text-sm text-gray-600">{t("tickets.opened", { when: timeAgo(tk.openedAt) })}</span>
              </div>
              <Link to={`/app/assets/${tk.asset.id}`} className="flex min-h-10 flex-wrap items-center gap-2 font-semibold text-blue-900 underline">
                {tk.asset.assetCode} · {tk.asset.name}
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={tk.asset.status} />
                <span className="text-gray-700">{tk.asset.locationText}</span>
              </div>
              {tk.description && <p className="text-gray-900">{tk.description}</p>}
              {tk.resolutionNote && (
                <p className="flex items-center gap-2 text-green-900">
                  <Icon name="check" /> {tk.resolutionNote}
                </p>
              )}
              <p className="text-sm text-gray-700">{tk.assignedTo ? t("tickets.assignedTo", { name: tk.assignedTo.name }) : t("tickets.unassigned")}</p>
              {canAct && tk.status !== "CLOSED" && (
                <div className="flex flex-wrap gap-2">
                  {tk.assignedTo?.id !== user?.id && (
                    <BigButton variant="secondary" icon="user" onClick={() => quick(tk, { assignedToId: user!.id })}>
                      {t("tickets.assignToMe")}
                    </BigButton>
                  )}
                  {tk.status === "OPEN" && (
                    <BigButton variant="secondary" icon="wrench" onClick={() => quick(tk, { status: "IN_PROGRESS" })}>
                      {t("tickets.markInProgress")}
                    </BigButton>
                  )}
                  <BigButton icon="check" onClick={() => { setError(null); setClosing(tk); }}>
                    {t("tickets.close")}
                  </BigButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => setFilter("page", String(p))} />}

      <ConfirmDialog open={!!closing} title={`${t("tickets.close")}: ${closing?.asset.assetCode ?? ""}`} confirmLabel={t("tickets.close")} busy={busy} onConfirm={close} onCancel={() => setClosing(null)}>
        <Field label={t("tickets.resolution")}>
          {(id) => <input id={id} required minLength={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />}
        </Field>
        <Field label={`${t("tickets.cost")} (${t("common.optional")})`}>
          {(id) => <input id={id} type="number" min={0} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className={inputClass} />}
        </Field>
        {error != null && <ErrorBox message={errorMessage(error)} />}
      </ConfirmDialog>
    </>
  );
}
