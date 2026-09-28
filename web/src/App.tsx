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

// The map pulls in Leaflet, so it is loaded only when opened (CLAUDE.md 8.10).
const MapPage = lazy(() => Promise.resolve({ default: () => <Todo titleKey="map.title" /> }));

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
        <Route index element={<Todo titleKey="dashboard.title" />} />
        <Route path="assets" element={<Todo titleKey="assets.title" />} />
        <Route
          path="map"
          element={
            <Suspense fallback={<Loading />}>
              <MapPage />
            </Suspense>
          }
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
              <Todo titleKey="types.title" />
            </RequireRole>
          }
        />
        <Route
          path="import"
          element={
            <RequireRole roles={["ADMIN"]}>
              <Todo titleKey="import.title" />
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
