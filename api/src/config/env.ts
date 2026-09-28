import { z } from "zod";

// Load api/.env in local development. In production (Render) there is no
// .env file; the variables come from the dashboard, so a missing file is fine.
try {
  process.loadEnvFile();
} catch {
  // no .env file
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().min(1).default("8h"),
  FRONTEND_URL: z.url(),
  // "http://a.com,http://b.com" -> ["http://a.com", "http://b.com"]
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  PORT: z.coerce.number().int().positive().default(4000),
});

const parsed = envSchema.safeParse(process.env);

// Fail fast: better to crash at startup with a clear list than to fail
// later on the first request that needs a missing value.
if (!parsed.success) {
  console.error("Invalid or missing environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error("Copy api/.env.example to api/.env and fill in the values.");
  process.exit(1);
}

export const env = parsed.data;
