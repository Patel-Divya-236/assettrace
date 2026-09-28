import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { trackReport } from "../../api/public";
import type { TrackedReport } from "../../api/types";
import Icon from "../../components/Icon";
import { BigButton, ErrorBox, Field, inputClass } from "../../components/ui";
import { errorMessage, formatDateTime } from "../../lib/format";

// Received -> Inspected -> Contractor working -> Fixed (only yes/no facts are public).
const STEP_KEYS = ["reportStatus.RECEIVED", "track.inspected", "track.contractorWorking", "reportStatus.FIXED"] as const;

export default function TrackReport() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [report, setReport] = useState<TrackedReport | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function find(c: string) {
    if (!/^\d{6}$/.test(c)) return;
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      setReport(await trackReport(c));
      setParams({ code: c }, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  // Opened from the "done" screen with ?code=123456
  useEffect(() => {
    if (params.get("code")) void find(params.get("code")!);
  }, []); // run once on open

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void find(code);
  };
  const reached = !report ? -1 : report.status === "FIXED" ? 3 : report.contractorWorking ? 2 : report.inspected ? 1 : 0;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-bold">{t("track.title")}</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label={t("track.enter")}>
          {(id) => (
            <input
              id={id}
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${inputClass} min-h-16 text-center font-mono text-3xl tracking-[0.3em]`}
            />
          )}
        </Field>
        <BigButton type="submit" big icon="search" disabled={code.length !== 6 || busy}>
          {busy ? t("common.loading") : t("track.find")}
        </BigButton>
      </form>

      {error != null && <ErrorBox message={errorMessage(error)} />}

      {report && (
        <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-gray-200" aria-live="polite">
          <p className="text-lg">
            {t(`category.${report.category}`)} · {t("track.for", { code: report.assetCode })}
          </p>
          {report.status === "REJECTED" ? (
            <div className="flex flex-col gap-2 rounded-xl bg-gray-100 p-4">
              <p className="flex items-center gap-2 text-xl font-bold">
                <Icon name="xCircle" className="h-7 w-7" /> {t("reportStatus.REJECTED")}
              </p>
              {report.rejectReason && <p className="text-lg">{t("track.rejectedReason", { reason: report.rejectReason })}</p>}
            </div>
          ) : (
            <ol className="flex flex-col gap-3">
              {STEP_KEYS.map((s, i) => {
                const done = i <= reached;
                return (
                  <li key={s} className={`flex min-h-14 items-center gap-3 rounded-xl px-4 text-xl font-bold ${done ? "bg-green-50 text-green-900 ring-2 ring-green-600" : "bg-gray-50 text-gray-500 ring-1 ring-gray-200"}`} aria-current={i === reached ? "step" : undefined}>
                    <Icon name={done ? "checkCircle" : "clock"} className="h-8 w-8" />
                    {t(s)}
                    {i === 2 && i === reached && report.progress !== null && ` · ${report.progress}%`}
                  </li>
                );
              })}
            </ol>
          )}
          <p className="text-base text-gray-600">{t("track.updated", { when: formatDateTime(report.updatedAt) })}</p>
        </section>
      )}
    </div>
  );
}
