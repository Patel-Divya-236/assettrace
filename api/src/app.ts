import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requireAuth } from "./middleware/auth";
import { requireRole, requireStaff } from "./middleware/requireRole";
import { publicReadLimiter } from "./middleware/rateLimit";
import { assetsRouter } from "./modules/assets/assets.routes";
import { assetTypesRouter } from "./modules/assetTypes/assetTypes.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { citizenRouter } from "./modules/citizen/citizen.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { importsRouter } from "./modules/imports/imports.routes";
import { lifecycleRouter } from "./modules/lifecycle/lifecycle.routes";
import { maintenanceRouter } from "./modules/maintenance/maintenance.routes";
import { publicRouter } from "./modules/public/public.routes";
import { qrRouter } from "./modules/qr/qr.routes";
import { reportsRouter } from "./modules/reports/reports.routes";
import { usersRouter } from "./modules/users/users.routes";

export const app = express();

// Render (and most hosts) put a proxy in front of the app. Trusting one hop
// makes req.ip the real client IP, which per-IP rate limits depend on.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGINS }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);

// Public routes: no login, rate-limited, safe fields only, can only file reports.
app.use("/api/public", publicReadLimiter, publicRouter);

// Citizen routes: login required, CITIZEN accounts only.
app.use("/api/citizen", requireAuth, requireRole("CITIZEN"), citizenRouter);

// Staff routes: valid token + a staff role (citizen accounts are refused); routers add finer role checks.
app.use("/api/asset-types", requireAuth, requireStaff, assetTypesRouter);
app.use("/api/assets", requireAuth, requireStaff, assetsRouter);
app.use("/api/assets", requireAuth, requireStaff, lifecycleRouter);
app.use("/api/assets", requireAuth, requireStaff, qrRouter);
app.use("/api/tickets", requireAuth, requireStaff, maintenanceRouter);
app.use("/api/imports", requireAuth, requireStaff, importsRouter);
app.use("/api/reports", requireAuth, requireStaff, reportsRouter);
app.use("/api/users", requireAuth, requireStaff, usersRouter);
app.use("/api/dashboard", requireAuth, requireStaff, dashboardRouter);

// Must be last: unknown routes, then errors.
app.use(notFoundHandler);
app.use(errorHandler);

// Vercel picks src/app.ts as the Express entrypoint and runs its default export.
export default app;
