import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, type Page } from "../../api/client";
import { ASSET_STATUSES, type DashboardSummary, type StaffReport } from "../../api/types";
import Icon from "../../components/Icon";
import { Card, EmptyState, ErrorBox, Loading, PageHeader, StatusBadge } from "../../components/ui";
import { useCan } from "../../lib/auth";
import { errorMessage, formatDate, formatNumber, timeAgo } from "../../lib/format";
import { STATUS_HEX, typeIcon } from "../../lib/status";
import { useApi } from "../../lib/useApi";

function Metric({ icon, label, value, tone, to }: { icon: string; label: string; value: number; tone: string; to: string }) {
  return (
    <Link to={to} className={`flex flex-col gap-2 rounded-2xl p-4 ring-1 ring-inset hover:shadow ${tone}`}>
      <Icon name={icon} className="h-7 w-7" />
      <span className="text-3xl font-bold">{formatNumber(value)}</span>
      <span className="font-semibold">{label}</span>
    </Link>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const canSeeReports = useCan("ADMIN", "FIELD_OFFICER");
  const summary = useApi(() => api<DashboardSummary>("/api/dashboard/summary"), []);
  const reports = useApi(
    () =>
      canSeeReports
        ? api<Page<StaffReport>>("/api/reports", { query: { status: "RECEIVED", pageSize: 5 } })
        : Promise.resolve(null),
    [canSeeReports],
  );

  if (summary.loading && !summary.data) return <Loading />;
  if (summary.error) return <ErrorBox message={errorMessage(summary.error)} onRetry={summary.reload} />;
  const d = summary.data!;
  const count = (s: string) => d.byStatus.find((x) => x.status === s)?.count ?? 0;

  // One stacked bar: each stage is a segment, in lifecycle order.
  const stageRow = [Object.fromEntries(ASSET_STATUSES.map((s) => [s, count(s)]))];

  return (
    <>
      <PageHeader title={t("dashboard.title")} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon="layers" label={t("dashboard.total")} value={d.totalAssets} tone="bg-white ring-gray-200 text-gray-900" to="/app/assets" />
        <Metric icon="checkCircle" label={t("dashboard.working")} value={count("IN_OPERATION")} tone="bg-green-50 ring-green-300 text-green-900" to="/app/assets?status=IN_OPERATION" />
        <Metric icon="wrench" label={t("dashboard.underRepair")} value={count("UNDER_MAINTENANCE")} tone="bg-amber-50 ring-amber-300 text-amber-900" to="/app/assets?status=UNDER_MAINTENANCE" />
        <Metric icon="clock" label={t("dashboard.overdue")} value={d.overdueMaintenance} tone="bg-red-50 ring-red-300 text-red-900" to="/app/assets?overdue=true" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-bold">{t("dashboard.stages")}</h2>
          <div className="h-16" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageRow} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis type="number" hide domain={[0, d.totalAssets || 1]} />
                <YAxis type="category" hide />
                {ASSET_STATUSES.map((s) => (
                  <Bar key={s} dataKey={s} stackId="stages" fill={STATUS_HEX[s]} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* The legend is the accessible version: badge (icon + word) + number */}
          <ul className="mt-3 flex flex-col gap-2">
            {ASSET_STATUSES.map((s) => (
              <li key={s} className="flex items-center justify-between gap-2">
                <Link to={`/app/assets?status=${s}`} className="flex min-h-10 items-center gap-2">
                  <span className="h-3 w-3 rounded-sm" style={{ background: STATUS_HEX[s] }} aria-hidden="true" />
                  <StatusBadge status={s} />
                </Link>
                <span className="font-semibold tabular-nums">{formatNumber(count(s))}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-bold">{t("dashboard.byType")}</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.byType} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 14 }} />
                <YAxis tick={{ fontSize: 14 }} width={48} />
                <Tooltip formatter={(v) => formatNumber(Number(v))} />
                <Bar dataKey="count" name={t("dashboard.total")} isAnimationActive={false}>
                  {d.byType.map((row) => (
                    <Cell key={row.typeId} fill="#1e40af" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 flex flex-wrap gap-3 text-base">
            {d.byType.map((row) => (
              <li key={row.typeId}>
                <Link to={`/app/assets?typeId=${row.typeId}`} className="inline-flex min-h-10 items-center gap-1.5 font-semibold text-blue-900 underline">
                  <Icon name={typeIcon(row.icon)} /> {row.name}: {formatNumber(row.count)}
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{t("dashboard.overdueList")}</h2>
            <Link to="/app/assets?overdue=true" className="min-h-10 content-center font-semibold text-blue-900 underline">
              {t("dashboard.seeAll")}
            </Link>
          </div>
          {d.topOverdue.length === 0 ? (
            <EmptyState icon="checkCircle" message={t("dashboard.noOverdue")} />
          ) : (
            <ul className="divide-y divide-gray-200">
              {d.topOverdue.map((a) => (
                <li key={a.id}>
                  <Link to={`/app/assets/${a.id}`} className="flex min-h-14 items-center gap-3 py-2 hover:bg-gray-50">
                    <Icon name={typeIcon(a.type.icon)} className="h-6 w-6 text-gray-600" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {a.assetCode} · {a.name}
                      </p>
                      <p className="truncate text-sm text-gray-600">{a.locationText}</p>
                    </div>
                    <span className="text-sm font-semibold text-red-800">{t("dashboard.dueSince", { date: formatDate(a.nextMaintenanceDate) })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {canSeeReports && (
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {t("dashboard.newReports")} ({formatNumber(d.newPublicReports)})
              </h2>
              <Link to="/app/reports" className="min-h-10 content-center font-semibold text-blue-900 underline">
                {t("dashboard.seeAll")}
              </Link>
            </div>
            {!reports.data || reports.data.items.length === 0 ? (
              <EmptyState icon="message" message={t("dashboard.noReports")} />
            ) : (
              <ul className="divide-y divide-gray-200">
                {reports.data.items.map((r) => (
                  <li key={r.id}>
                    <Link to="/app/reports" className="flex min-h-14 items-center gap-3 py-2 hover:bg-gray-50">
                      <Icon name="message" className="h-6 w-6 text-gray-600" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {r.asset.assetCode} · {t(`category.${r.category}`)}
                        </p>
                        <p className="truncate text-sm text-gray-600">{r.asset.locationText}</p>
                      </div>
                      <span className="text-sm text-gray-600">{timeAgo(r.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      <p className="mt-4 text-base text-gray-700">
        <Link to="/app/tickets?status=ACTIVE" className="inline-flex min-h-10 items-center gap-2 font-semibold text-blue-900 underline">
          <Icon name="wrench" /> {t("dashboard.openTickets")}: {formatNumber(d.openTickets)}
        </Link>
      </p>
    </>
  );
}
