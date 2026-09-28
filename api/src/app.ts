import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

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

// Must be last: unknown routes, then errors.
app.use(notFoundHandler);
app.use(errorHandler);
