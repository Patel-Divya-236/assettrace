import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Route, Routes } from "react-router";
import { PublicLayout, StaffLayout } from "./components/Layout";
import { Loading, PageHeader } from "./components/ui";
import { RequireRole } from "./lib/auth";
import Home from "./pages/public/Home";
import Login from "./pages/staff/Login";

// Placeholder until each page is built (P12-P17).
function Todo({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return <PageHeader title={t(titleKey)} />;
}

// Staff pages are split out of the public bundle, so a citizen scanning a QR code
// on a slow phone never downloads charts, maps or admin screens (CLAUDE.md 8.10).
const Dashboard = lazy(() => import("./pages/staff/Dashboard"));
const AssetList = lazy(() => import("./pages/staff/AssetList"));
const AssetDetail = lazy(() => import("./pages/staff/AssetDetail"));
const AssetForm = lazy(() => import("./pages/staff/AssetForm"));
const AssetTypes = lazy(() => import("./pages/staff/AssetTypes"));
const Import = lazy(() => import("./pages/staff/Import"));
const MapPage = lazy(() => Promise.resolve({ default: () => <Todo titleKey="map.title" /> }));

const page = (el: React.ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>;

export default function App() {
  return (
    <Routes>
      {/* Public: no login */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/a/:assetCode" element={<Todo titleKey="public.assetNumber" />} />
        <Route path="/a/:assetCode/report" element={<Todo titleKey="report.title" />} />
        <Route path="/done/:trackingCode" element={<Todo titleKey="done.title" />} />
        <Route path="/track" element={<Todo titleKey="track.title" />} />
        <Route path="/nearby" element={<Todo titleKey="nearby.title" />} />
      </Route>

      <Route path="/login" element={<Login />} />

      {/* Staff: login required; some pages need a role */}
      <Route
        path="/app"
        element={
          <RequireRole>
            <StaffLayout />
          </RequireRole>
        }
      >
        <Route index element={page(<Dashboard />)} />
        <Route path="assets" element={page(<AssetList />)} />
        <Route path="assets/new" element={<RequireRole roles={["ADMIN"]}>{page(<AssetForm />)}</RequireRole>} />
        <Route path="assets/:id" element={page(<AssetDetail />)} />
        <Route path="assets/:id/edit" element={<RequireRole roles={["ADMIN"]}>{page(<AssetForm />)}</RequireRole>} />
        <Route
          path="map"
          element={page(<MapPage />)}
        />
        <Route path="tickets" element={<Todo titleKey="tickets.title" />} />
        <Route
          path="reports"
          element={
            <RequireRole roles={["ADMIN", "FIELD_OFFICER"]}>
              <Todo titleKey="reports.title" />
            </RequireRole>
          }
        />
        <Route
          path="asset-types"
          element={
            <RequireRole roles={["ADMIN"]}>
              {page(<AssetTypes />)}
            </RequireRole>
          }
        />
        <Route
          path="import"
          element={
            <RequireRole roles={["ADMIN"]}>
              {page(<Import />)}
            </RequireRole>
          }
        />
      </Route>

      <Route path="*" element={<PublicLayout />}>
        <Route path="*" element={<Todo titleKey="public.notFoundTitle" />} />
      </Route>
    </Routes>
  );
}
