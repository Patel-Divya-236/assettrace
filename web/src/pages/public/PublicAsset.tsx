import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { ApiError } from "../../api/client";
import { getPublicAsset } from "../../api/public";
import Icon from "../../components/Icon";
import { ErrorBox, Loading } from "../../components/ui";
import { errorMessage, formatDate } from "../../lib/format";
import { PUBLIC_LOOK, typeIcon } from "../../lib/status";
import { useApi } from "../../lib/useApi";

export default function PublicAsset() {
  const { t } = useTranslation();
  const { assetCode = "" } = useParams();
  const asset = useApi(() => getPublicAsset(assetCode), [assetCode]);

  if (asset.error) {
    const notFound = asset.error instanceof ApiError && asset.error.status === 404;
    return notFound ? (
      <div className="flex flex-col items-center gap-4 text-center">
        <Icon name="help" className="h-16 w-16 text-gray-500" />
        <h1 className="text-2xl font-bold">{t("public.notFoundTitle")}</h1>
        <p className="font-mono text-xl">{assetCode}</p>
        <p className="text-lg">{t("public.notFoundHelp")}</p>
        <Link to="/" className="flex min-h-14 items-center rounded-xl bg-blue-800 px-6 text-lg font-bold text-white">
          {t("public.home")}
        </Link>
      </div>
    ) : (
      <ErrorBox message={errorMessage(asset.error)} onRetry={asset.reload} />
    );
  }
  if (!asset.data) return <Loading />;
  const a = asset.data;
  const look = PUBLIC_LOOK[a.publicStatus];

  return (
    <div className="flex flex-col gap-5">
      {/* One large status block: icon + colour + word */}
      <div className={`flex flex-col items-center gap-2 rounded-2xl p-6 text-center ring-2 ring-inset ${look.className}`} role="status">
        <Icon name={look.icon} className="h-16 w-16" />
        <p className="text-3xl font-bold">{t(look.key)}</p>
      </div>

      <dl className="flex flex-col gap-3 rounded-2xl bg-white p-4 text-lg ring-1 ring-gray-200">
        <div>
          <dt className="text-base text-gray-600">{t("public.type")}</dt>
          <dd className="flex items-center gap-2 font-semibold">
            <Icon name={typeIcon(a.type.icon)} /> {a.type.name}
          </dd>
        </div>
        <div>
          <dt className="text-base text-gray-600">{t("public.location")}</dt>
          <dd className="font-semibold">
            {a.locationText}
            {a.ward && ` · ${a.ward}`}
          </dd>
        </div>
        <div>
          <dt className="text-base text-gray-600">{t("public.lastRepaired")}</dt>
          <dd className="font-semibold">{a.lastRepairedAt ? formatDate(a.lastRepairedAt) : t("public.never")}</dd>
        </div>
        <div>
          <dt className="text-base text-gray-600">{t("public.assetNumber")}</dt>
          <dd className="font-mono text-xl font-bold tracking-wider">{a.assetCode}</dd>
        </div>
      </dl>

      {a.canReport ? (
        <Link to={`/a/${a.assetCode}/report`} className="flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-red-700 px-6 text-xl font-bold text-white shadow hover:bg-red-800">
          <Icon name="alert" className="h-8 w-8" /> {t("public.reportProblem")}
        </Link>
      ) : (
        <p className="rounded-2xl bg-gray-100 p-4 text-lg">{t("public.notInServiceHelp")}</p>
      )}
    </div>
  );
}
