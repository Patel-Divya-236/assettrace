import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { BigButton, Card, ErrorBox, Field, inputClass, Loading, PageHeader } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { useCan } from "../../lib/auth";
import { errorMessage, formatMoney } from "../../lib/format";
import { useApi } from "../../lib/useApi";

type BudgetRow = { ward: string; allocated: number; committed: number; spent: number; remaining: number };
type Summary = { year: number; approvalLimit: number; items: BudgetRow[] };
type Contractor = { id: string; name: string; firm: string | null; phone: string; workType: string | null };

export default function Budget() {
  const { t } = useTranslation();
  const toast = useToast();
  const isAdmin = useCan("ADMIN");
  const canAddContractor = useCan("ADMIN", "OFFICER");
  const summary = useApi(() => api<Summary>("/api/budgets"), []);
  const contractors = useApi(() => api<{ items: Contractor[] }>("/api/contractors"), []);
  const [form, setForm] = useState({ name: "", firm: "", phone: "", workType: "" });
  const [error, setError] = useState<unknown>(null);

  const save = async (fn: () => Promise<unknown>, reload: () => void) => {
    try {
      await fn();
      toast("success", t("work.saved"));
      reload();
    } catch (err) {
      toast("error", errorMessage(err));
    }
  };

  async function addContractor(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/contractors", { body: { ...form, firm: form.firm || undefined, workType: form.workType || undefined } });
      setForm({ name: "", firm: "", phone: "", workType: "" });
      toast("success", t("work.saved"));
      contractors.reload();
    } catch (err) {
      setError(err);
    }
  }

  if (!summary.data) return summary.error ? <ErrorBox message={errorMessage(summary.error)} onRetry={summary.reload} /> : <Loading />;
  const s = summary.data;

  return (
    <>
      <PageHeader title={t("budget.title")} />
      <Card className="mb-4">
        <h2 className="mb-3 text-lg font-bold">{t("budget.year", { year: `${s.year}-${String(s.year + 1).slice(2)}` })}</h2>
        <div className="flex flex-col gap-3">
          {s.items.map((r) => {
            const used = r.allocated ? Math.min(100, ((r.spent + r.committed) / r.allocated) * 100) : 100;
            const over = r.remaining < 0;
            return (
              <div key={r.ward} className="rounded-xl p-3 ring-1 ring-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-lg">{r.ward}</strong>
                  <span className={`font-semibold ${over ? "text-red-800" : "text-green-800"}`}>
                    {over ? `⚠ ${t("budget.over")}: ` : `${t("budget.remaining")}: `}
                    {formatMoney(Math.abs(r.remaining))}
                  </span>
                </div>
                {/* bar: spent (dark) + committed (light) out of allocated, with numbers as text */}
                <div className="my-2 h-3 w-full overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
                  <div className={`h-full ${over ? "bg-red-600" : "bg-blue-700"}`} style={{ width: `${used}%` }} />
                </div>
                <p className="text-sm text-gray-700">
                  {t("budget.allocated")} {formatMoney(r.allocated)} · {t("budget.spent")} {formatMoney(r.spent)} · {t("budget.committed")} {formatMoney(r.committed)}
                </p>
                {isAdmin && (
                  <form
                    className="mt-2 flex flex-wrap items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = Number(new FormData(e.currentTarget).get("amount"));
                      void save(() => api("/api/budgets", { method: "PUT", body: { ward: r.ward, amount: v } }), summary.reload);
                    }}
                  >
                    <Field label={`${t("budget.allocated")} (₹)`}>{(id) => <input id={id} name="amount" type="number" min={0} defaultValue={r.allocated} className={`${inputClass} w-48`} />}</Field>
                    <BigButton type="submit" variant="secondary">
                      {t("common.save")}
                    </BigButton>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-1 text-lg font-bold">{t("budget.limit")}</h2>
        <p className="mb-2 text-gray-700">{t("budget.limitHelp")}</p>
        {isAdmin ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = Number(new FormData(e.currentTarget).get("limit"));
              void save(() => api("/api/settings/approval-limit", { method: "PUT", body: { value: v } }), summary.reload);
            }}
          >
            <Field label="₹">{(id) => <input id={id} name="limit" type="number" min={0} defaultValue={s.approvalLimit} className={`${inputClass} w-48`} />}</Field>
            <BigButton type="submit" variant="secondary">
              {t("common.save")}
            </BigButton>
          </form>
        ) : (
          <p className="text-xl font-bold">{formatMoney(s.approvalLimit)}</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-bold">{t("budget.contractors")}</h2>
        <ul className="mb-4 divide-y divide-gray-200">
          {contractors.data?.items.map((c) => (
            <li key={c.id} className="py-2">
              <strong>{c.name}</strong>
              {c.firm && ` · ${c.firm}`} · ☎ {c.phone}
              {c.workType && <span className="text-gray-600"> · {c.workType}</span>}
            </li>
          ))}
        </ul>
        {canAddContractor && (
          <form onSubmit={addContractor} className="grid gap-3 sm:grid-cols-2">
            <Field label={t("budget.name")}>{(id) => <input id={id} required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />}</Field>
            <Field label={t("budget.firm")}>{(id) => <input id={id} value={form.firm} onChange={(e) => setForm({ ...form, firm: e.target.value })} className={inputClass} />}</Field>
            <Field label={t("budget.phone")}>{(id) => <input id={id} required type="tel" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} className={inputClass} />}</Field>
            <Field label={t("budget.workType")}>{(id) => <input id={id} value={form.workType} onChange={(e) => setForm({ ...form, workType: e.target.value })} className={inputClass} />}</Field>
            {error != null && <ErrorBox message={errorMessage(error)} />}
            <BigButton type="submit" icon="plus" className="sm:col-span-2">
              {t("budget.addContractor")}
            </BigButton>
          </form>
        )}
      </Card>
    </>
  );
}
