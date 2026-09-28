import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import type { Ticket } from "../../api/types";
import { BigButton, ConfirmDialog, ErrorBox, Field, inputClass } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../lib/auth";
import { errorMessage, formatMoney, timeAgo } from "../../lib/format";

type Contractor = { id: string; name: string; firm: string | null; phone: string };
type Dialog = "inspect" | "contractor" | "update" | null;

/**
 * Field work on one ticket: inspection -> (officer approval) -> contractor -> progress updates.
 * The backend enforces the order; buttons only appear when the next step is possible.
 */
export default function TicketWork({ ticket, contractors, onChange }: { ticket: Ticket; contractors: Contractor[]; onChange: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  const canApprove = user?.role === "ADMIN" || user?.role === "OFFICER";
  const canWork = canApprove || user?.role === "FIELD_OFFICER";
  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState("");
  const [num, setNum] = useState("");
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const tk = ticket;
  const approvedOrFree = !tk.needsApproval || !!tk.approvedAt;

  const open = (d: Dialog) => {
    setText("");
    setNum("");
    setChoice("");
    setError(null);
    setDialog(d);
  };

  async function run(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tickets/${tk.id}/${path}`, { body: body ?? {} });
      toast("success", t("work.saved"));
      setDialog(null);
      onChange();
    } catch (err) {
      setError(err);
      if (!dialog) toast("error", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200">
      {tk.inspectedAt ? (
        <p className="text-gray-900">
          <strong>{t("work.inspection")}:</strong> {tk.inspectionNote} · {t("work.estimateShort", { amount: formatMoney(tk.estimatedCost) })}
        </p>
      ) : null}
      {tk.needsApproval && (
        <p className={`rounded-lg px-3 py-2 text-sm font-semibold ${tk.approvedAt ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-950"}`}>
          {tk.approvedAt ? `✓ ${t("work.approved")}` : `⚠ ${t("work.needsApproval")}: ${tk.approvalReason}`}
        </p>
      )}
      {tk.contractor && (
        <p>
          <strong>{t("work.contractor")}:</strong> {tk.contractor.name}
          {tk.contractor.firm && ` (${tk.contractor.firm})`} · ☎ {tk.contractor.phone}
        </p>
      )}
      {tk.updates.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-gray-800">
          {tk.updates.map((u) => (
            <li key={u.id}>
              {u.progress !== null && <strong>{u.progress}% · </strong>}
              {u.note} <span className="text-gray-500">({timeAgo(u.createdAt)})</span>
            </li>
          ))}
        </ul>
      )}

      {canWork && tk.status !== "CLOSED" && (
        <div className="flex flex-wrap gap-2">
          {!tk.contractor && (
            <BigButton variant="secondary" icon="search" onClick={() => open("inspect")}>
              {t("work.inspect")}
            </BigButton>
          )}
          {canApprove && tk.needsApproval && !tk.approvedAt && (
            <BigButton icon="check" disabled={busy} onClick={() => run("approve")}>
              {t("work.approve")}
            </BigButton>
          )}
          {tk.inspectedAt && approvedOrFree && !tk.contractor && (
            <BigButton variant="secondary" icon="user" onClick={() => open("contractor")}>
              {t("work.assignContractor")}
            </BigButton>
          )}
          {tk.contractor && (
            <BigButton variant="secondary" icon="plus" onClick={() => open("update")}>
              {t("work.addUpdate")}
            </BigButton>
          )}
        </div>
      )}

      <ConfirmDialog open={dialog === "inspect"} title={`${t("work.inspect")}: ${tk.asset.assetCode}`} confirmLabel={t("common.save")} busy={busy} onCancel={() => setDialog(null)} onConfirm={() => run("inspect", { note: text.trim(), estimatedCost: Number(num) })}>
        <Field label={t("work.findings")}>{(id) => <textarea id={id} required minLength={3} rows={3} value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass} py-2`} />}</Field>
        <Field label={t("work.estimate")}>{(id) => <input id={id} type="number" required min={0} inputMode="decimal" value={num} onChange={(e) => setNum(e.target.value)} className={inputClass} />}</Field>
        {error != null && <ErrorBox message={errorMessage(error)} />}
      </ConfirmDialog>

      <ConfirmDialog open={dialog === "contractor"} title={`${t("work.assignContractor")}: ${tk.asset.assetCode}`} confirmLabel={t("work.assignContractor")} busy={busy} onCancel={() => setDialog(null)} onConfirm={() => run("contractor", { contractorId: choice })}>
        <Field label={t("work.contractor")}>
          {(id) => (
            <select id={id} required value={choice} onChange={(e) => setChoice(e.target.value)} className={inputClass}>
              <option value="">{t("work.chooseContractor")}</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.firm ? ` · ${c.firm}` : ""}
                </option>
              ))}
            </select>
          )}
        </Field>
        {error != null && <ErrorBox message={errorMessage(error)} />}
      </ConfirmDialog>

      <ConfirmDialog open={dialog === "update"} title={`${t("work.addUpdate")}: ${tk.asset.assetCode}`} confirmLabel={t("common.save")} busy={busy} onCancel={() => setDialog(null)} onConfirm={() => run("updates", { note: text.trim(), progress: num === "" ? undefined : Number(num) })}>
        <Field label={t("work.update")}>{(id) => <textarea id={id} required minLength={2} rows={2} value={text} onChange={(e) => setText(e.target.value)} className={`${inputClass} py-2`} />}</Field>
        <Field label={`${t("work.progress")} (${t("common.optional")})`}>{(id) => <input id={id} type="number" min={0} max={100} inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value)} className={inputClass} />}</Field>
        {error != null && <ErrorBox message={errorMessage(error)} />}
      </ConfirmDialog>
    </div>
  );
}
