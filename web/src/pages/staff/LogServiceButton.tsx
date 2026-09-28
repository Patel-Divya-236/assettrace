import { useState } from "react";
import { useTranslation } from "react-i18next";
import { logService } from "../../api/tickets";
import type { Asset } from "../../api/types";
import { useToast } from "../../components/Toast";
import { BigButton, ConfirmDialog, ErrorBox, Field, inputClass } from "../../components/ui";
import { errorMessage } from "../../lib/format";

/** "Log a service": records routine maintenance done today. Status does not change. */
export default function LogServiceButton({ asset, onDone }: { asset: Asset; onDone: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await logService({ assetId: asset.id, resolutionNote: note.trim(), cost: cost ? Number(cost) : undefined });
      setOpen(false);
      setNote("");
      setCost("");
      toast("success", t("asset.saved"));
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BigButton variant="secondary" icon="settings" onClick={() => setOpen(true)}>
        {t("asset.logService")}
      </BigButton>
      <ConfirmDialog
        open={open}
        title={`${t("asset.logService")}: ${asset.assetCode}`}
        confirmLabel={t("common.save")}
        busy={busy}
        onConfirm={submit}
        onCancel={() => setOpen(false)}
      >
        <p className="text-gray-700">{t("asset.logServiceHelp")}</p>
        <Field label={t("asset.whatWasDone")}>
          {(id) => <input id={id} required minLength={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />}
        </Field>
        <Field label={`${t("tickets.cost")} (${t("common.optional")})`}>
          {(id) => <input id={id} type="number" inputMode="decimal" min={0} value={cost} onChange={(e) => setCost(e.target.value)} className={inputClass} />}
        </Field>
        {error != null && <ErrorBox message={errorMessage(error)} />}
      </ConfirmDialog>
    </>
  );
}
