import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { listAssets, listTypes } from "../../api/assets";
import { ASSET_STATUSES } from "../../api/types";
import Icon from "../../components/Icon";
import { BigButton, EmptyState, ErrorBox, Field, inputClass, Loading, PageHeader, Pagination, StatusBadge } from "../../components/ui";
import { useCan } from "../../lib/auth";
import { errorMessage, formatDate, formatNumber } from "../../lib/format";
import { typeIcon } from "../../lib/status";
import { useApi } from "../../lib/useApi";

const FILTER_KEYS = ["q", "typeId", "status", "ward", "overdue"] as const;

export default function AssetList() {
  const { t } = useTranslation();
  const isAdmin = useCan("ADMIN");
  // Filters live in the URL, so a filtered list can be shared, bookmarked and survives Back.
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) ?? "";
  const page = Number(params.get("page") ?? 1);
  const [search, setSearch] = useState(get("q"));
  const [more, setMore] = useState(!!(get("ward") || get("overdue")));

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page"); // any filter change starts from page 1
    setParams(next, { replace: true });
  };

  // Debounce typing: search 300 ms after the user stops.
  useEffect(() => {
    const id = setTimeout(() => {
      if (search !== get("q")) setFilter("q", search.trim());
    }, 300);
    return () => clearTimeout(id);
  }, [search]); // only re-run when the typed text changes

  const types = useApi(listTypes, []);
  const query = Object.fromEntries(FILTER_KEYS.map((k) => [k, get(k) || undefined]));
  const result = useApi(() => listAssets({ ...query, page }), [params.toString()]);
  const hasFilters = FILTER_KEYS.some((k) => get(k));

  return (
    <>
      <PageHeader
        title={t("assets.title")}
        actions={
          isAdmin && (
            <Link to="/app/assets/new">
              <BigButton icon="plus" tabIndex={-1}>
                {t("assets.add")}
              </BigButton>
            </Link>
          )
        }
      />

      {/* Simple by default: search + type + stage. Ward and overdue behind "More filters". */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-gray-200">
        <Field label={t("assets.searchLabel")}>
          {(id) => (
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute top-3.5 left-3 h-5 w-5 text-gray-500" />
              <input
                id={id}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("assets.searchPlaceholder")}
                className={`${inputClass} pl-10`}
              />
            </div>
          )}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("assets.type")}>
            {(id) => (
              <select id={id} value={get("typeId")} onChange={(e) => setFilter("typeId", e.target.value)} className={inputClass}>
                <option value="">{t("common.all")}</option>
                {types.data?.items.map((ty) => (
                  <option key={ty.id} value={ty.id}>
                    {ty.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("assets.status")}>
            {(id) => (
              <select id={id} value={get("status")} onChange={(e) => setFilter("status", e.target.value)} className={inputClass}>
                <option value="">{t("common.all")}</option>
                {ASSET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}.label`)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        {more && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("assets.ward")}>
              {(id) => (
                <input id={id} defaultValue={get("ward")} onBlur={(e) => setFilter("ward", e.target.value.trim())} className={inputClass} />
              )}
            </Field>
            <label className="flex min-h-12 items-center gap-3 self-end font-semibold">
              <input type="checkbox" className="h-6 w-6" checked={get("overdue") === "true"} onChange={(e) => setFilter("overdue", e.target.checked ? "true" : "")} />
              {t("assets.overdueOnly")}
            </label>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <BigButton variant="ghost" icon={more ? "chevronLeft" : "plus"} onClick={() => setMore(!more)} aria-expanded={more}>
            {more ? t("common.fewerFilters") : t("common.moreFilters")}
          </BigButton>
          {hasFilters && (
            <BigButton
              variant="ghost"
              icon="x"
              onClick={() => {
                setSearch("");
                setParams({}, { replace: true });
              }}
            >
              {t("assets.clear")}
            </BigButton>
          )}
        </div>
      </div>

      {result.error ? (
        <ErrorBox message={errorMessage(result.error)} onRetry={result.reload} />
      ) : !result.data ? (
        <Loading />
      ) : result.data.items.length === 0 ? (
        <EmptyState icon="search" message={t("assets.noResults")} />
      ) : (
        <>
          <p className="mb-2 text-base text-gray-700" aria-live="polite">
            {t("assets.count", { count: formatNumber(result.data.total) })}
          </p>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl bg-white ring-1 ring-gray-200 md:block">
            <table className="w-full text-left">
              <thead className="bg-gray-100 text-sm text-gray-700">
                <tr>
                  <th className="p-3">{t("assets.code")}</th>
                  <th className="p-3">{t("assets.name")}</th>
                  <th className="p-3">{t("assets.status")}</th>
                  <th className="p-3">{t("assets.location")}</th>
                  <th className="p-3">{t("assets.nextService")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {result.data.items.map((a) => (
                  <tr key={a.id} className="hover:bg-blue-50">
                    <td className="p-3 font-mono font-semibold">
                      <Link to={`/app/assets/${a.id}`} className="inline-flex min-h-12 items-center gap-2 text-blue-900 underline">
                        <Icon name={typeIcon(a.type.icon)} /> {a.assetCode}
                      </Link>
                    </td>
                    <td className="p-3">{a.name}</td>
                    <td className="p-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="p-3 text-gray-700">
                      {a.locationText}
                      {a.ward && <span className="text-gray-500"> · {a.ward}</span>}
                    </td>
                    <td className="p-3 text-gray-700">{a.nextMaintenanceDate ? formatDate(a.nextMaintenanceDate) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {result.data.items.map((a) => (
              <li key={a.id}>
                <Link to={`/app/assets/${a.id}`} className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-gray-200 active:bg-blue-50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-mono text-lg font-bold text-blue-900">
                      <Icon name={typeIcon(a.type.icon)} /> {a.assetCode}
                    </span>
                    <Icon name="chevronRight" className="h-5 w-5 text-gray-400" />
                  </div>
                  <span className="font-semibold">{a.name}</span>
                  <StatusBadge status={a.status} />
                  <span className="text-gray-700">
                    {a.locationText}
                    {a.ward && ` · ${a.ward}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={result.data.page}
            pageSize={result.data.pageSize}
            total={result.data.total}
            onPage={(p) => {
              const next = new URLSearchParams(params);
              next.set("page", String(p));
              setParams(next);
              window.scrollTo(0, 0);
            }}
          />
        </>
      )}
    </>
  );
}
