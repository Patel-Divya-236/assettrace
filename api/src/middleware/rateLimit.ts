import { rateLimit } from "express-rate-limit";
import { env } from "../config/env";

// Limits are per IP (req.ip, correct behind Render's proxy because of `trust proxy`).
// Stored in memory: fine for one instance; at scale use a shared Redis store.
const tooMany = (message: string) => ({
  error: { code: "RATE_LIMITED", message },
});

// Public reads: asset page, nearby, tracking.
export const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.RATE_LIMIT_PUBLIC_READS_PER_MIN,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany("Too many requests. Please wait a minute and try again."),
});

// Filing reports: stops one person flooding the queue.
export const reportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: env.RATE_LIMIT_REPORTS_PER_10_MIN,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany("You have sent several reports already. Please try again in 10 minutes."),
});

// Login: slows down password guessing.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany("Too many login attempts. Please wait 15 minutes and try again."),
});
