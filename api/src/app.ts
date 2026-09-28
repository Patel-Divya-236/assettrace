import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requireAuth } from "./middleware/auth";
import { publicReadLimiter } from "./middleware/rateLimit";
import { assetsRouter } from "./modules/assets/assets.routes";
import { assetTypesRouter } from "./modules/assetTypes/assetTypes.routes";
import { authRouter } from "./modules/auth/auth.routes";
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

// Staff routes: every request needs a valid token; routers add role checks.
app.use("/api/asset-types", requireAuth, assetTypesRouter);
app.use("/api/assets", requireAuth, assetsRouter);
app.use("/api/assets", requireAuth, lifecycleRouter);
app.use("/api/assets", requireAuth, qrRouter);
app.use("/api/tickets", requireAuth, maintenanceRouter);
app.use("/api/imports", requireAuth, importsRouter);
app.use("/api/reports", requireAuth, reportsRouter);
app.use("/api/users", requireAuth, usersRouter);
app.use("/api/dashboard", requireAuth, dashboardRouter);

// Must be last: unknown routes, then errors.
app.use(notFoundHandler);
app.use(errorHandler);

// Vercel picks src/app.ts as the Express entrypoint and runs its default export.
export default app;
