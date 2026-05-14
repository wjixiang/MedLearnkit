import type { Context, Next } from "hono";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types/index.js";
import { config } from "../config.js";

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing authorization token" }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    c.set("userId", payload.sub);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

export function getUserId(c: Context): string | undefined {
  return c.get("userId");
}
