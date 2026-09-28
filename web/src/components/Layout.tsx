import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet } from "react-router";
import type { Role } from "../api/types";
import { isStaff, useAuth } from "../lib/auth";
import Icon from "./Icon";
import LanguageSwitch from "./LanguageSwitch";

type NavItem = { to: string; key: string; icon: string; roles?: Role[]; end?: boolean };

const NAV: NavItem[] = [
  { to: "/app", key: "nav.dashboard", icon: "grid", end: true },
  { to: "/app/assets", key: "nav.assets", icon: "list" },
  { to: "/app/map", key: "nav.map", icon: "map" },
  { to: "/app/tickets", key: "nav.tickets", icon: "wrench" },
  { to: "/app/reports", key: "nav.reports", icon: "message", roles: ["ADMIN", "OFFICER", "FIELD_OFFICER"] },
  { to: "/app/asset-types", key: "nav.assetTypes", icon: "layers", roles: ["ADMIN"] },
  { to: "/app/import", key: "nav.import", icon: "upload", roles: ["ADMIN"] },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-12 items-center gap-3 rounded-xl px-3 font-semibold ${
    isActive ? "bg-blue-800 text-white" : "text-gray-800 hover:bg-blue-50"
  }`;

/** Staff layout: sidebar on desktop, bottom navigation on phones. */
export function StaffLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const items = NAV.filter((n) => !n.roles || (user && n.roles.includes(user.role)));
  const bottom = items.slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">
        {t("common.skip")}
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col gap-1 border-r border-gray-200 bg-white p-3 md:flex">
        <Link to="/app" className="mb-4 flex items-center gap-2 px-2 py-3 text-xl font-bold text-blue-900">
          <Icon name="mapPin" className="h-7 w-7" /> {t("app.name")}
        </Link>
        <nav aria-label={t("nav.main")} className="flex flex-col gap-1">
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
              <Icon name={n.icon} /> {t(n.key)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar: language + user, always visible */}
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2">
          <Link to="/app" className="flex items-center gap-2 text-lg font-bold text-blue-900 md:hidden">
            <Icon name="mapPin" className="h-6 w-6" /> {t("app.name")}
          </Link>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <LanguageSwitch />
            {user && (
              <details className="relative">
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-lg px-3 font-semibold text-gray-800 hover:bg-gray-100">
                  <Icon name="user" />
                  <span className="hidden sm:inline">{user.name}</span>
                  <span className="sr-only sm:hidden">{user.name}</span>
                </summary>
                <div className="absolute right-0 z-40 mt-1 flex w-64 flex-col gap-1 rounded-xl bg-white p-2 shadow-lg ring-1 ring-gray-200">
                  <p className="px-3 py-2 text-sm text-gray-600">
                    {user.email}
                    <br />
                    {t(`roles.${user.role}`)}
                  </p>
                  {/* Links that don't fit in the phone's bottom bar */}
                  {items.slice(5).map((n) => (
                    <NavLink key={n.to} to={n.to} className={`${linkClass({ isActive: false })} md:hidden`}>
                      <Icon name={n.icon} /> {t(n.key)}
                    </NavLink>
                  ))}
                  <Link to="/" className={linkClass({ isActive: false })}>
                    <Icon name="globe" /> {t("nav.publicSite")}
                  </Link>
                  <button type="button" onClick={logout} className={`${linkClass({ isActive: false })} w-full text-left`}>
                    <Icon name="logout" /> {t("nav.logout")}
                  </button>
                </div>
              </details>
            )}
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-28 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Phone bottom navigation */}
      <nav
        aria-label={t("nav.main")}
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-gray-200 bg-white md:hidden"
        style={{ gridTemplateColumns: `repeat(${bottom.length}, minmax(0, 1fr))` }}
      >
        {bottom.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-xs font-semibold ${
                isActive ? "text-blue-800" : "text-gray-600"
              }`
            }
          >
            <Icon name={n.icon} className="h-6 w-6" />
            <span className="w-full truncate text-center">{t(n.key)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Public layout: big text (>= 18px), language switch at the top of every page. */
export function PublicLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const pill = "flex min-h-12 items-center gap-1.5 rounded-lg px-3 text-base font-semibold text-blue-900 ring-1 ring-inset ring-blue-300 hover:bg-blue-50";
  return (
    <div className="min-h-screen bg-gray-50 text-lg">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Link to="/" className="flex min-h-12 items-center gap-2 text-xl font-bold text-blue-900">
            <Icon name="mapPin" className="h-7 w-7" /> {t("app.name")}
          </Link>
          <LanguageSwitch />
        </div>
        {/* Account bar: citizens log in to file complaints and see their own list */}
        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-end gap-2 px-4 pb-2">
          {!user ? (
            <Link to="/login" className={pill}>
              <Icon name="user" /> {t("nav.login")}
            </Link>
          ) : isStaff(user) ? (
            <Link to="/app" className={pill}>
              <Icon name="grid" /> {t("nav.staffArea")}
            </Link>
          ) : (
            <>
              <span className="text-base text-gray-700">{user.name}</span>
              <Link to="/my" className={pill}>
                <Icon name="message" /> {t("nav.myComplaints")}
              </Link>
              <button type="button" onClick={logout} className={pill}>
                <Icon name="logout" /> {t("nav.logout")}
              </button>
            </>
          )}
        </div>
      </header>
      <main id="main" className="mx-auto max-w-xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
