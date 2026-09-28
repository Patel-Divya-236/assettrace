import { env } from "./config/env";
import { app } from "./app";

// Local server. On Vercel, src/app.ts is the entrypoint instead (see its default export).
app.listen(env.PORT, () => {
  console.log(`AssetTrace API listening on http://localhost:${env.PORT}`);
});
