import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requireAuth } from "./middleware/auth";
import { assetsRouter } from "./modules/assets/assets.routes";
import { assetTypesRouter } from "./modules/assetTypes/assetTypes.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { lifecycleRouter } from "./modules/lifecycle/lifecycle.routes";

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

// Staff routes: every request needs a valid token; routers add role checks.
app.use("/api/asset-types", requireAuth, assetTypesRouter);
app.use("/api/assets", requireAuth, assetsRouter);
app.use("/api/assets", requireAuth, lifecycleRouter);

// Must be last: unknown routes, then errors.
app.use(notFoundHandler);
app.use(errorHandler);
