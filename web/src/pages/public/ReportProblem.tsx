import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { sendReport } from "../../api/public";
import type { ReportCategory } from "../../api/types";
import Icon from "../../components/Icon";
import { BigButton, ErrorBox, Field, inputClass } from "../../components/ui";
import { compressImage } from "../../lib/compressImage";
import { errorMessage } from "../../lib/format";

// Picture buttons: no typing needed to report.
const CATEGORIES: { value: ReportCategory; icon: string }[] = [
  { value: "NOT_WORKING", icon: "power" },
  { value: "BROKEN", icon: "alert" },
  { value: "LEAKING", icon: "droplets" },
  { value: "OTHER", icon: "help" },
];

export default function ReportProblem() {
  const { t, i18n } = useTranslation();
  const { assetCode = "" } = useParams();
  const navigate = useNavigate();
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const small = await compressImage(file);
      setPhoto(small);
      setPreview(URL.createObjectURL(small));
    } catch {
      // Unsupported image: the report still works without a photo.
      setPhoto(null);
    }
  }

  async function send() {
    if (!category) return;
    setBusy(true);
    setError(null);
    try {
      const { trackingCode } = await sendReport({
        assetCode,
        category,
        language: i18n.language,
        phone: phone.trim() || undefined,
        note: note.trim() || undefined,
        photo: photo ?? undefined,
      });
      navigate(`/done/${trackingCode}`, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-mono text-lg text-gray-700">{assetCode}</p>
        <h1 className="text-3xl font-bold">{t("report.title")}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t("report.title")}>
        {CATEGORIES.map((c) => {
          const on = category === c.value;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setCategory(c.value)}
              className={`flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl p-3 text-lg font-bold ring-4 ring-inset ${
                on ? "bg-blue-800 text-white ring-blue-800" : "bg-white text-gray-900 ring-gray-300"
              }`}
            >
              <Icon name={on ? "checkCircle" : c.icon} className="h-12 w-12" />
              {t(`category.${c.value}`)}
            </button>
          );
        })}
      </div>

      {/* Photo: optional. capture=environment opens the back camera on phones. */}
      <div className="flex flex-col gap-2">
        <span className="font-semibold">{t("report.photoOptional")}</span>
        {preview && <img src={preview} alt="" className="max-h-56 w-full rounded-xl object-cover" />}
        <label className="flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-2xl bg-white text-lg font-bold text-blue-900 ring-2 ring-inset ring-blue-800">
          <Icon name="camera" className="h-7 w-7" />
          {preview ? t("report.changePhoto") : t("report.photo")}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
        </label>
        {preview && (
          <BigButton variant="ghost" icon="x" onClick={() => { setPhoto(null); setPreview(null); }}>
            {t("report.removePhoto")}
          </BigButton>
        )}
      </div>

      <Field label={t("report.phone")} hint={t("report.phoneHelp")} error={undefined}>
        {(id, d) => <input id={id} aria-describedby={d} type="tel" inputMode="numeric" autoComplete="tel" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} className={`${inputClass} min-h-14 text-lg`} />}
      </Field>
      <Field label={t("report.note")}>
        {(id) => <textarea id={id} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} py-2 text-lg`} />}
      </Field>

      {error != null && <ErrorBox message={errorMessage(error)} />}
      {!category && <p className="text-center text-base text-gray-700">{t("report.chooseProblem")}</p>}
      <BigButton big full icon="checkCircle" onClick={send} disabled={!category || busy} className="min-h-16 text-xl">
        {busy ? t("report.sending") : t("report.send")}
      </BigButton>
    </div>
  );
}
