import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { api, apiBlobUrl, type Page } from "../../api/client";
import type { Priority, ReportStatus, StaffReport } from "../../api/types";
import Icon from "../../components/Icon";
import { useToast } from "../../components/Toast";
import { BigButton, ConfirmDialog, EmptyState, ErrorBox, Field, inputClass, Loading, PageHeader, Pagination, StatusBadge } from "../../components/ui";
import { errorMessage, timeAgo } from "../../lib/format";
import { typeIcon } from "../../lib/status";
import { useApi } from "../../lib/useApi";

const TABS: ReportStatus[] = ["RECEIVED", "ASSIGNED", "FIXED", "REJECTED"];
const CATEGORY_ICON: Record<string, string> = { NOT_WORKING: "power", BROKEN: "alert", LEAKING: "droplets", OTHER: "help" };

/** Photos are behind login, so fetch with the token and show as a blob URL. Loaded only when visible. */
function Photo({ reportId }: { reportId: string }) {
  const { t } = useTranslation();
  const [src, setSrc] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!show) return;
    let url: string | null = null;
    apiBlobUrl(`/api/reports/${reportId}/photo`).then((u) => setSrc((url = u)));
    return () => void (url && URL.revokeObjectURL(url));
  }, [reportId, show]);
  if (!show)
    return (
      <BigButton variant="ghost" icon="camera" onClick={() => setShow(true)}>
        {t("reports.photo")}
      </BigButton>
    );
  return src ? <img src={src} alt={t("reports.photo")} className="max-h-64 w-full rounded-xl object-cover sm:w-64" /> : <div className="h-40 w-full animate-pulse rounded-xl bg-gray-200 sm:w-64" />;
}

export default function Reports() {
  const { t } = useTranslation();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") as ReportStatus) || "RECEIVED";
  const page = Number(params.get("page") ?? 1);
  const list = useApi(() => api<Page<StaffReport>>("/api/reports", { query: { status, page } }), [status, page]);

  const [confirming, setConfirming] = useState<StaffReport | null>(null);
  const [rejecting, setRejecting] = useState<StaffReport | null>(null);
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [lastTicket, setLastTicket] = useState<{ assetId: string } | null>(null);

  async function act(kind: "confirm" | "reject") {
    const r = kind === "confirm" ? confirming : rejecting;
    if (!r) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/reports/${r.id}/${kind}`, { body: kind === "confirm" ? { priority } : { reason: reason.trim() } });
      toast("success", kind === "confirm" ? t("reports.ticketCreated") : t("reports.rejected"));
      if (kind === "confirm") setLastTicket({ assetId: r.asset.id });
      setConfirming(null);
      setRejecting(null);
      setReason("");
      list.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t("reports.title")} />
      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto">
        {TABS.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={status === s}
            onClick={() => setParams({ status: s })}
            className={`min-h-12 shrink-0 rounded-xl px-4 font-semibold ${status === s ? "bg-blue-800 text-white" : "bg-white text-gray-800 ring-1 ring-gray-300"}`}
          >
            {t(`reports.tab.${s}`)}
          </button>
        ))}
      </div>

      {lastTicket && (
        <p className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-green-50 p-3 text-green-900 ring-1 ring-green-300" role="status">
          <Icon name="checkCircle" /> {t("reports.ticketCreated")}
          <Link to={`/app/tickets?assetId=${lastTicket.assetId}&status=ACTIVE`} className="min-h-12 content-center font-bold underline">
            {t("reports.openTicket")}
          </Link>
        </p>
      )}

      {list.error ? (
        <ErrorBox message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.items.length === 0 ? (
        <EmptyState icon="message" message={t("reports.none")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.data.items.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-gray-200">
              <div className="flex flex-wrap items-center gap-2">
                <Icon name={CATEGORY_ICON[r.category]} className="h-7 w-7 text-gray-700" />
                <span className="text-lg font-bold">{t(`category.${r.category}`)}</span>
                <StatusBadge kind="report" status={r.status} />
                <span className="ml-auto text-sm text-gray-600">{timeAgo(r.createdAt)}</span>
              </div>
              <Link to={`/app/assets/${r.asset.id}`} className="flex min-h-12 items-center gap-2 font-semibold text-blue-900 underline">
                <Icon name={typeIcon(r.asset.type.icon)} /> {r.asset.assetCode} · {r.asset.name}
              </Link>
              <p className="text-gray-700">
                {r.asset.locationText} · {t("reports.tracking", { code: r.trackingCode })}
                {r.phone && ` · ☎ ${r.phone}`}
              </p>
              {r.note && <p className="rounded-lg bg-gray-50 p-2 text-gray-900">“{r.note}”</p>}
              {r.rejectReason && <p className="text-gray-700">{r.rejectReason}</p>}
              {r.hasPhoto ? <Photo reportId={r.id} /> : <p className="text-sm text-gray-500">{t("reports.noPhoto")}</p>}
              {r.status === "RECEIVED" && (
                <div className="flex flex-wrap gap-2">
                  <BigButton icon="check" onClick={() => { setError(null); setConfirming(r); }}>
                    {t("reports.confirm")}
                  </BigButton>
                  <BigButton variant="secondary" icon="x" onClick={() => { setError(null); setRejecting(r); }}>
                    {t("reports.reject")}
                  </BigButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => setParams({ status, page: String(p) })} />}

      <ConfirmDialog open={!!confirming} title={`${t("reports.confirm")}: ${confirming?.asset.assetCode ?? ""}`} confirmLabel={t("reports.confirm")} busy={busy} onConfirm={() => act("confirm")} onCancel={() => setConfirming(null)}>
        <Field label={t("tickets.priorityLabel")}>
          {(id) => (
            <select id={id} value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={inputClass}>
              {(["HIGH", "MEDIUM", "LOW"] as const).map((p) => (
                <option key={p} value={p}>
                  {t(`tickets.priority.${p}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        {error != null && <ErrorBox message={errorMessage(error)} />}
      </ConfirmDialog>

      <ConfirmDialog open={!!rejecting} title={`${t("reports.reject")}: ${rejecting?.asset.assetCode ?? ""}`} confirmLabel={t("reports.reject")} danger busy={busy} onConfirm={() => act("reject")} onCancel={() => setRejecting(null)}>
        <Field label={t("reports.reason")}>
          {(id) => <textarea id={id} required minLength={3} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} py-2`} />}
        </Field>
        {error != null && <ErrorBox message={errorMessage(error)} />}
      </ConfirmDialog>
    </>
  );
}
