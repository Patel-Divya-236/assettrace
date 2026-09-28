// Small shared building blocks. Every interactive element is >= 48px tall (3rem).
import { type ButtonHTMLAttributes, type ReactNode, useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { AssetStatus, PublicStatus, ReportStatus } from "../api/types";
import { PUBLIC_LOOK, REPORT_LOOK, STATUS_LOOK } from "../lib/status";
import Icon from "./Icon";

// ---------- StatusBadge: icon + colour + word, never colour alone ----------
type BadgeProps =
  | { kind?: "staff"; status: AssetStatus; size?: "md" | "lg"; showDesc?: boolean }
  | { kind: "public"; status: PublicStatus; size?: "md" | "lg"; showDesc?: boolean }
  | { kind: "report"; status: ReportStatus; size?: "md" | "lg"; showDesc?: boolean };

export function StatusBadge(props: BadgeProps) {
  const { t } = useTranslation();
  const look =
    props.kind === "public"
      ? PUBLIC_LOOK[props.status]
      : props.kind === "report"
        ? REPORT_LOOK[props.status]
        : STATUS_LOOK[props.status];
  const staff = !props.kind || props.kind === "staff";
  const label = t(staff ? `${look.key}.label` : look.key);
  const big = props.size === "lg";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset ${look.className} ${
        big ? "px-4 py-2 text-lg" : "px-2.5 py-1 text-sm"
      }`}
      title={staff ? t(`${look.key}.desc`) : undefined}
    >
      <Icon name={look.icon} className={big ? "h-6 w-6" : "h-4 w-4"} />
      {label}
      {props.showDesc && staff && <span className="font-normal opacity-80">· {t(`${look.key}.desc`)}</span>}
    </span>
  );
}

// ---------- Buttons ----------
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  icon?: string;
  big?: boolean;
  full?: boolean;
};

const VARIANTS = {
  primary: "bg-blue-800 text-white hover:bg-blue-900 disabled:bg-blue-300",
  secondary: "bg-white text-blue-900 ring-2 ring-inset ring-blue-800 hover:bg-blue-50 disabled:opacity-50",
  danger: "bg-red-700 text-white hover:bg-red-800 disabled:bg-red-300",
  ghost: "bg-transparent text-blue-900 hover:bg-blue-50 disabled:opacity-50",
};

export function BigButton({ variant = "primary", icon, big, full, className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${
        big ? "min-h-14 px-6 text-lg" : "min-h-12 px-4 text-base"
      } ${full ? "w-full" : ""} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} className={big ? "h-6 w-6" : "h-5 w-5"} />}
      {children}
    </button>
  );
}

// ---------- ConfirmDialog (native <dialog>: focus trap + Esc for free) ----------
type ConfirmProps = {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, children, confirmLabel, danger, busy, onConfirm, onCancel }: ConfirmProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-xl backdrop:bg-black/50"
    >
      <form
        method="dialog"
        className="flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm();
        }}
      >
        <h2 id={titleId} className="text-xl font-bold text-gray-900">
          {title}
        </h2>
        {children}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <BigButton variant="secondary" onClick={onCancel} disabled={busy}>
            {t("common.cancel")}
          </BigButton>
          <BigButton type="submit" variant={danger ? "danger" : "primary"} disabled={busy}>
            {busy ? t("common.loading") : confirmLabel}
          </BigButton>
        </div>
      </form>
    </dialog>
  );
}

// ---------- Page structure ----------
export function PageHeader({ title, actions, back }: { title: string; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {back}
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5 ${className}`}>{children}</section>;
}

export function EmptyState({ icon = "box", message, action }: { icon?: string; message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 p-8 text-center text-gray-700">
      <Icon name={icon} className="h-10 w-10 text-gray-400" />
      <p className="text-base">{message}</p>
      {action}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl bg-red-50 p-4 text-red-900 ring-1 ring-red-200 sm:flex-row sm:items-center">
      <Icon name="alert" className="h-6 w-6" />
      <p className="flex-1">{message}</p>
      {onRetry && (
        <BigButton variant="secondary" onClick={onRetry}>
          {t("common.retry")}
        </BigButton>
      )}
    </div>
  );
}

export function Skeleton({ className = "h-6" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} aria-hidden="true" />;
}

export function Loading() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">{t("common.loading")}</span>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-2" aria-label={t("common.pageOf", { page, pages })}>
      <BigButton variant="secondary" icon="chevronLeft" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <span className="hidden sm:inline">{t("common.previous")}</span>
      </BigButton>
      <span className="text-base text-gray-700">{t("common.pageOf", { page, pages })}</span>
      <BigButton variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={t("common.nextPage")}>
        <span className="hidden sm:inline">{t("common.nextPage")}</span>
        <Icon name="chevronRight" />
      </BigButton>
    </nav>
  );
}

// ---------- Form fields: every input has a visible label ----------
type FieldProps = { label: string; error?: string; hint?: string; children: (id: string, describedBy?: string) => ReactNode };

export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hint && hintId, error && errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold text-gray-900">
        {label}
      </label>
      {children(id, describedBy)}
      {hint && (
        <p id={hintId} className="text-sm text-gray-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "min-h-12 w-full rounded-xl border-2 border-gray-400 bg-white px-3 text-base text-gray-900 placeholder:text-gray-500 focus:border-blue-800";
