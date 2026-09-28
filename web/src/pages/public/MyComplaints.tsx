import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { api, type Page } from "../../api/client";
import type { ReportCategory, ReportStatus } from "../../api/types";
import Icon from "../../components/Icon";
import { EmptyState, ErrorBox, Loading, StatusBadge } from "../../components/ui";
import { errorMessage, timeAgo } from "../../lib/format";
import { typeIcon } from "../../lib/status";
import { useApi } from "../../lib/useApi";

type MyReport = {
  trackingCode: string;
  status: ReportStatus;
  category: ReportCategory;
  rejectReason: string | null;
  createdAt: string;
  asset: { assetCode: string; locationText: string; type: { name: string; icon: string | null } };
};

/** Every complaint the logged-in citizen has filed, with its current status. */
export default function MyComplaints() {
  const { t } = useTranslation();
  const list = useApi(() => api<Page<MyReport>>("/api/citizen/reports", { query: { pageSize: 50 } }), []);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-bold">{t("my.title")}</h1>
      {list.error ? (
        <ErrorBox message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !list.data ? (
        <Loading />
      ) : list.data.items.length === 0 ? (
        <EmptyState icon="message" message={t("my.none")} action={<Link to="/nearby" className="min-h-12 content-center font-bold text-blue-900 underline">{t("public.nearby")}</Link>} />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.data.items.map((r) => (
            <li key={r.trackingCode}>
              <Link to={`/track?code=${r.trackingCode}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-gray-200 active:bg-blue-50">
                <Icon name={typeIcon(r.asset.type.icon)} className="h-9 w-9 text-blue-900" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="font-bold">
                    {t(`category.${r.category}`)} · <span className="font-mono">{r.asset.assetCode}</span>
                  </p>
                  <p className="truncate text-base text-gray-700">{r.asset.locationText}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge kind="report" status={r.status} />
                    <span className="text-base text-gray-700">{t("my.filed", { when: timeAgo(r.createdAt) })}</span>
                  </div>
                  <p className="font-mono text-base text-gray-600">{t("reports.tracking", { code: r.trackingCode })}</p>
                </div>
                <Icon name="chevronRight" className="h-6 w-6 text-gray-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
