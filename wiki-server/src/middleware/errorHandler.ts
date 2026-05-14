import type { Context } from "hono";

export function errorHandler(err: Error, c: Context) {
  console.error(`[Error] ${err.message}`, err.stack);

  const msg = err.message || "Internal server error";
  if (msg.includes("unique") || msg.includes("duplicate") || msg.includes("UNIQUE")) {
    return c.json({ error: "A resource with this identifier already exists" }, 409);
  }

  return c.json({ error: msg }, 500);
}
