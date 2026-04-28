import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { runMigrations } from "./db/client.js";
import { deploymentsRouter } from "./routes/deployments.js";
import { logsRouter } from "./routes/logs.js";
import { initCaddy } from "./pipeline/caddy.js";

const PORT = Number(process.env.PORT ?? 3001);

runMigrations();

const app = new Hono();

app.use("*", cors());
app.use("*", logger());

app.get("/healthz", (c) => c.text("ok"));

app.route("/api/deployments", deploymentsRouter);
app.route("/api/deployments", logsRouter);

// Initialize Caddy's HTTP server config on startup (non-blocking)
initCaddy().catch((err) => {
  console.error("Caddy init failed:", err.message);
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Backend listening on :${PORT}`);
});
