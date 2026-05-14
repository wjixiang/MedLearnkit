import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import pages from "./routes/pages.js";
import revisions from "./routes/revisions.js";
import search from "./routes/search.js";
import importRoutes from "./routes/import.js";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  }),
);

app.onError(errorHandler);

// Health check
app.get("/api/wiki/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Routes
app.route("/api/wiki/pages", pages);
app.route("/api/wiki", revisions);
app.route("/api/wiki/search", search);
app.route("/api/wiki/import", importRoutes);

serve(
  {
    fetch: app.fetch,
    port: config.server.port,
    hostname: config.server.host,
  },
  (info) => {
    console.log(`Wiki server running on http://${info.address}:${info.port}`);
  },
);
