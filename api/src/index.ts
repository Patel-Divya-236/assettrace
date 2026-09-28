import { env } from "./config/env";
import { app } from "./app";

// Locally this starts a server. On Vercel the same file is the entrypoint of one
// Vercel Function (zero-config Express); the default export is what it runs.
app.listen(env.PORT, () => {
  console.log(`AssetTrace API listening on http://localhost:${env.PORT}`);
});

export default app;
