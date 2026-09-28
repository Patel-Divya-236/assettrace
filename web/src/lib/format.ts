import i18n from "../i18n";
import { ApiError } from "../api/client";

const locale = () => (i18n.language === "en" ? "en-IN" : `${i18n.language}-IN`);

export function formatDate(iso: string | null | undefined) {
  if (!iso) return i18n.t("common.notRecorded");
  return new Date(iso).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(locale(), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return i18n.t("common.notRecorded");
  return new Intl.NumberFormat(locale(), { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value));
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat(locale()).format(n);
}

export function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return i18n.t("time.justNow");
  if (minutes < 60) return i18n.t("time.minutes", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return i18n.t("time.hours", { count: hours });
  return i18n.t("time.days", { count: Math.round(hours / 24) });
}

/** Plain-language message for any error, translated by its code (CLAUDE.md section 7). */
export function errorMessage(err: unknown) {
  if (err instanceof ApiError) return i18n.t(`errors.${err.code}`, { defaultValue: err.message });
  return i18n.t("common.somethingWrong");
}

/** Field-level messages from a validation error, if any. */
export function fieldErrors(err: unknown): Record<string, string> {
  return err instanceof ApiError ? (err.details?.fields ?? {}) : {};
}
