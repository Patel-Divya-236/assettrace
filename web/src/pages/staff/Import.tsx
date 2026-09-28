import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { listTypes } from "../../api/assets";
import type { ImportJob } from "../../api/types";
import { BigButton, Card, ErrorBox, Field, inputClass, PageHeader } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { errorMessage } from "../../lib/format";
import { useApi } from "../../lib/useApi";

/**
 * CSV import. The server imports synchronously (streamed, batches of 500; D-34),
 * so the page simply waits for the finished job and shows row errors.
 */
export default function Import() {
  const { t } = useTranslation();
  const toast = useToast();
  const types = useApi(listTypes, []);
  const [typeId, setTypeId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const type = types.data?.items.find((ty) => ty.id === typeId);

  // Template generated from the type's own fields, with one example row.
  function downloadTemplate() {
    if (!type) return;
    const cols = ["name", "lat", "lng", "locationText", "ward", "status", ...type.fields.map((f) => f.key)];
    const example = ["Example asset", "23.2156", "72.6369", "Sector 21 near bus stand", "Ward 1", "IN_OPERATION", ...type.fields.map((f) => (f.type === "select" ? (f.options?.[0] ?? "") : f.type === "number" ? "10" : f.type === "date" ? "2024-01-31" : ""))];
    const csv = [cols, example].map((r) => r.map((v) => (v.includes(",") ? `"${v}"` : v)).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })); // BOM so Excel reads Gujarati/Hindi text
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type.codePrefix}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function upload() {
    if (!file || !typeId) return;
    setBusy(true);
    setError(null);
    setJob(null);
    const form = new FormData();
    form.append("typeId", typeId);
    form.append("file", file);
    try {
      const result = await api<ImportJob>("/api/imports", { form });
      setJob(result);
      toast(result.failed ? "error" : "success", t("import.result", { ok: result.succeeded, failed: result.failed }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t("import.title")} />
      <Card className="flex max-w-2xl flex-col gap-5">
        <Field label={t("import.chooseType")}>
          {(id) => (
            <select id={id} value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputClass}>
              <option value="">—</option>
              {types.data?.items.map((ty) => (
                <option key={ty.id} value={ty.id}>
                  {ty.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="flex flex-col gap-2">
          <p className="font-semibold">{t("import.template")}</p>
          <BigButton variant="secondary" icon="download" onClick={downloadTemplate} disabled={!type}>
            {t("import.downloadTemplate")}
          </BigButton>
          <p className="text-sm text-gray-600">{t("import.help")}</p>
        </div>
        <Field label={t("import.upload")}>
          {(id) => <input id={id} type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={`${inputClass} py-2`} />}
        </Field>
        <BigButton icon="upload" big onClick={upload} disabled={!file || !typeId || busy}>
          {busy ? t("import.working") : t("import.start")}
        </BigButton>
        {busy && <div className="h-3 w-full animate-pulse rounded-full bg-blue-200" role="progressbar" aria-label={t("import.working")} />}
        {error != null && <ErrorBox message={errorMessage(error)} />}
        {job && (
          <div className="flex flex-col gap-3" aria-live="polite">
            <p className={`text-lg font-bold ${job.failed ? "text-amber-900" : "text-green-800"}`}>{t("import.result", { ok: job.succeeded, failed: job.failed })}</p>
            {job.errors.length > 0 && (
              <>
                <h2 className="font-bold">{t("import.rowErrors")}</h2>
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2">{t("import.row")}</th>
                      <th className="p-2">{t("import.problem")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {job.errors.map((e) => (
                      <tr key={e.row}>
                        <td className="p-2 font-mono">{e.row}</td>
                        <td className="p-2">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
