import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { getAsset, getOpenTickets, getQr, getTimeline, transition } from "../../api/assets";
import { type Asset, ASSET_STATUSES, type AssetStatus } from "../../api/types";
import Icon from "../../components/Icon";
import { useToast } from "../../components/Toast";
import { BigButton, Card, ConfirmDialog, EmptyState, ErrorBox, Field, inputClass, Loading, PageHeader, StatusBadge } from "../../components/ui";
import { useCan } from "../../lib/auth";
import { errorMessage, fieldErrors, formatDate, formatDateTime, formatMoney } from "../../lib/format";
import { STATUS_LOOK, typeIcon } from "../../lib/status";
import { useApi } from "../../lib/useApi";
import LogServiceButton from "./LogServiceButton";

// Data each stage asks for (mirrors the backend's REQUIRED/OPTIONAL_FIELDS; the backend decides).
const STAGE_FIELDS: Partial<Record<AssetStatus, { key: string; type: "date" | "number" | "text"; required: boolean }[]>> = {
  ACQUIRED: [
    { key: "acquiredDate", type: "date", required: true },
    { key: "cost", type: "number", required: true },
    { key: "vendor", type: "text", required: true },
  ],
  COMMISSIONED: [
    { key: "commissionedDate", type: "date", required: true },
    { key: "warrantyEnd", type: "date", required: false },
  ],
  DISPOSED: [
    { key: "disposalMethod", type: "text", required: true },
    { key: "disposalValue", type: "number", required: false },
  ],
};

/** All 7 stages in order; the current one highlighted. Tap a stage to read what it means. */
function LifecycleBar({ status }: { status: AssetStatus }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<AssetStatus | null>(null);
  const currentIndex = ASSET_STATUSES.indexOf(status);
  return (
    <ol className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
      {ASSET_STATUSES.map((s, i) => {
        const current = s === status;
        // Under repair is a side loop, so it only counts as "passed" when the asset is in it.
        const passed = i < currentIndex && s !== "UNDER_MAINTENANCE";
        return (
          <li key={s} className="sm:flex-1">
            <button
              type="button"
              onClick={() => setOpen(open === s ? null : s)}
              aria-current={current ? "step" : undefined}
              aria-expanded={open === s}
              className={`flex min-h-12 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold ring-1 ring-inset ${
                current ? `${STATUS_LOOK[s].className} ring-2` : passed ? "bg-gray-100 text-gray-800 ring-gray-300" : "bg-white text-gray-500 ring-gray-200"
              }`}
            >
              <Icon name={passed ? "check" : STATUS_LOOK[s].icon} className="h-4 w-4" />
              {t(`status.${s}.label`)}
            </button>
            {(open === s || current) && <p className="px-3 py-1 text-sm text-gray-700">{t(`status.${s}.desc`)}</p>}
          </li>
        );
      })}
    </ol>
  );
}

/** Confirm a stage change in plain words; asks for the stage's data when needed. */
function TransitionDialog({ asset, to, onClose, onDone }: { asset: Asset; to: AssetStatus; onClose: () => void; onDone: (a: Asset) => void }) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const fields = STAGE_FIELDS[to] ?? [];
  const final = to === "DISPOSED" || to === "DECOMMISSIONED";
  const errs = fieldErrors(error);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const stageData = Object.fromEntries(
        fields.filter((f) => values[f.key]).map((f) => [f.key, f.type === "number" ? Number(values[f.key]) : values[f.key]]),
      );
      onDone(await transition(asset.id, { toStatus: to, note: note.trim() || undefined, stageData }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open
      title={t("confirmMove.title", { code: asset.assetCode, status: t(`status.${to}.label`) })}
      confirmLabel={t(`moves.${to}`)}
      danger={final}
      busy={busy}
      onConfirm={submit}
      onCancel={onClose}
    >
      <p className="text-base text-gray-700">{t(`status.${to}.desc`)}</p>
      {final && <p className="font-semibold text-red-800">{t("confirmMove.final")}</p>}
      {to === "UNDER_MAINTENANCE" && <p className="text-gray-800">{t("confirmMove.repairTicket")}</p>}
      {fields.map((f) => (
        <Field key={f.key} label={`${t(`stage.${f.key}`)}${f.required ? "" : ` (${t("common.optional")})`}`} error={errs[f.key]}>
          {(id, describedBy) => (
            <input
              id={id}
              aria-describedby={describedBy}
              type={f.type}
              inputMode={f.type === "number" ? "decimal" : undefined}
              min={f.type === "number" ? 0 : undefined}
              required={f.required}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className={inputClass}
            />
          )}
        </Field>
      ))}
      <Field label={`${t("stage.note")} (${t("common.optional")})`}>
        {(id) => <input id={id} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} maxLength={500} />}
      </Field>
      {error != null && <ErrorBox message={errorMessage(error)} />}
    </ConfirmDialog>
  );
}

function QrCard({ assetId }: { assetId: string }) {
  const { t } = useTranslation();
  const qr = useApi(() => getQr(assetId), [assetId]);
  if (!qr.data) return qr.error ? <ErrorBox message={errorMessage(qr.error)} onRetry={qr.reload} /> : <Loading />;
  const { png, assetCode } = qr.data;

  // Print only the plate: QR + code in large text.
  const print = () => {
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) return;
    w.document.write(
      `<title>${assetCode}</title><body style="font-family:sans-serif;text-align:center;margin:24px">` +
        `<img src="${png}" style="width:320px;height:320px" alt=""><p style="font-size:32px;font-weight:bold;letter-spacing:2px">${assetCode}</p>` +
        `<script>onload=()=>{print();close()}</script></body>`,
    );
    w.document.close();
  };

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <figure className="flex flex-col items-center">
        <img src={png} alt={`${t("asset.qr")} ${assetCode}`} className="h-44 w-44" />
        <figcaption className="font-mono text-xl font-bold tracking-wider">{assetCode}</figcaption>
      </figure>
      <div className="flex flex-col gap-2">
        <p className="text-gray-700">{t("asset.qrHelp")}</p>
        <div className="flex flex-wrap gap-2">
          <a href={png} download={`${assetCode}-qr.png`} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-4 font-semibold text-blue-900 ring-2 ring-inset ring-blue-800 hover:bg-blue-50">
            <Icon name="download" /> {t("common.download")}
          </a>
          <BigButton variant="secondary" icon="printer" onClick={print}>
            {t("common.print")}
          </BigButton>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col border-b border-gray-100 py-2 sm:flex-row sm:gap-4">
      <dt className="text-sm font-semibold text-gray-600 sm:w-48">{label}</dt>
      <dd className="text-base text-gray-900">{value}</dd>
    </div>
  );
}

export default function AssetDetail() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const toast = useToast();
  const isAdmin = useCan("ADMIN");
  const canAct = useCan("ADMIN", "FIELD_OFFICER");
  const asset = useApi(() => getAsset(id), [id]);
  const timeline = useApi(() => getTimeline(id), [id]);
  const tickets = useApi(() => getOpenTickets(id), [id]);
  const [moveTo, setMoveTo] = useState<AssetStatus | null>(null);

  if (asset.error) return <ErrorBox message={errorMessage(asset.error)} onRetry={asset.reload} />;
  if (!asset.data) return <Loading />;
  const a = asset.data;

  const refreshAll = (updated?: Asset) => {
    if (updated) asset.setData(updated);
    else asset.reload();
    timeline.reload();
    tickets.reload();
  };

  return (
    <>
      <PageHeader
        back={
          <Link to="/app/assets" className="mb-1 inline-flex min-h-12 items-center gap-1 font-semibold text-blue-900">
            <Icon name="arrowLeft" /> {t("asset.backToList")}
          </Link>
        }
        title={`${a.assetCode} · ${a.name}`}
        actions={
          isAdmin && (
            <Link to={`/app/assets/${a.id}/edit`}>
              <BigButton variant="secondary" icon="settings" tabIndex={-1}>
                {t("common.edit")}
              </BigButton>
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-gray-800">
        <StatusBadge status={a.status} size="lg" />
        <span className="inline-flex items-center gap-1.5">
          <Icon name={typeIcon(a.type.icon)} /> {a.type.name}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="mapPin" /> {a.locationText}
          {a.ward && ` · ${a.ward}`}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <h2 className="mb-3 text-lg font-bold">{t("asset.lifecycle")}</h2>
            <LifecycleBar status={a.status} />
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-bold">{t("asset.actions")}</h2>
            {/* Buttons come only from the API's allowedTransitions (D-05). */}
            {a.allowedTransitions.length === 0 ? (
              <p className="text-gray-700">{t("asset.noActions")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {a.allowedTransitions.map((to) => (
                  <BigButton
                    key={to}
                    variant={to === "DISPOSED" || to === "DECOMMISSIONED" ? "danger" : "primary"}
                    icon={STATUS_LOOK[to].icon}
                    onClick={() => setMoveTo(to)}
                  >
                    {t(`moves.${to}`)}
                  </BigButton>
                ))}
              </div>
            )}
            {canAct && (a.status === "IN_OPERATION" || a.status === "UNDER_MAINTENANCE") && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <LogServiceButton asset={a} onDone={() => refreshAll()} />
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 text-lg font-bold">{t("asset.customFields")}</h2>
            {a.type.fields.length === 0 ? (
              <p className="text-gray-700">{t("types.noFields")}</p>
            ) : (
              <dl>
                {a.type.fields.map((f) => (
                  <Row
                    key={f.key}
                    label={f.label}
                    value={a.attributes[f.key] === undefined ? t("common.notRecorded") : f.type === "date" ? formatDate(String(a.attributes[f.key])) : String(a.attributes[f.key])}
                  />
                ))}
                <Row label={t("asset.condition")} value={a.condition ? t("asset.conditionValue", { value: a.condition }) : t("common.notRecorded")} />
              </dl>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 text-lg font-bold">{t("asset.dates")}</h2>
            <dl>
              <Row label={t("stage.acquiredDate")} value={formatDate(a.acquiredDate)} />
              <Row label={t("stage.cost")} value={formatMoney(a.cost)} />
              <Row label={t("stage.vendor")} value={a.vendor ?? t("common.notRecorded")} />
              <Row label={t("stage.commissionedDate")} value={formatDate(a.commissionedDate)} />
              <Row label={t("stage.warrantyEnd")} value={formatDate(a.warrantyEnd)} />
              <Row label={t("asset.lastService")} value={formatDate(a.lastMaintenanceDate)} />
              <Row label={t("asset.nextService")} value={formatDate(a.nextMaintenanceDate)} />
              {a.disposalMethod && <Row label={t("stage.disposalMethod")} value={a.disposalMethod} />}
              {a.disposalValue && <Row label={t("stage.disposalValue")} value={formatMoney(a.disposalValue)} />}
              <Row label={t("asset.coordinates")} value={`${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}`} />
            </dl>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-3 text-lg font-bold">
              {t("asset.openTickets")} ({a.openTicketCount})
            </h2>
            {!tickets.data || tickets.data.items.length === 0 ? (
              <p className="text-gray-700">{t("asset.noOpenTickets")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {tickets.data.items.map((tk) => (
                  <li key={tk.id} className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
                    <p className="font-semibold">
                      {t(`tickets.kind.${tk.kind}`)} · {t(`tickets.priority.${tk.priority}`)}
                    </p>
                    <p className="text-sm text-gray-700">{tk.description}</p>
                    <Link to={`/app/tickets?assetId=${a.id}`} className="inline-flex min-h-12 items-center font-semibold text-blue-900 underline">
                      {t("common.open")}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-bold">{t("asset.qr")}</h2>
            <QrCard assetId={a.id} />
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-bold">{t("asset.history")}</h2>
            {!timeline.data ? (
              <Loading />
            ) : timeline.data.items.length === 0 ? (
              <EmptyState message={t("common.nothingHere")} />
            ) : (
              <ol className="relative flex flex-col gap-4 border-l-2 border-gray-200 pl-4">
                {timeline.data.items.map((e) => (
                  <li key={e.id}>
                    <p className="text-sm text-gray-600">{formatDateTime(e.createdAt)}</p>
                    <p className="flex flex-wrap items-center gap-1">
                      {e.fromStatus ? t("asset.moved") : t("asset.createdEvent")} <StatusBadge status={e.toStatus} />
                    </p>
                    <p className="text-sm text-gray-700">{t("asset.by", { name: e.user?.name ?? t("asset.system") })}</p>
                    {e.note && <p className="text-sm text-gray-800 italic">“{e.note}”</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      {moveTo && (
        <TransitionDialog
          asset={a}
          to={moveTo}
          onClose={() => setMoveTo(null)}
          onDone={(updated) => {
            setMoveTo(null);
            refreshAll(updated);
            toast("success", `${updated.assetCode}: ${t(`status.${updated.status}.label`)}`);
          }}
        />
      )}
    </>
  );
}
