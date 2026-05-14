import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as revisionService from "../services/revisionService.js";
import { authMiddleware, getUserId } from "../middleware/auth.js";

const revisions = new Hono();

// List revisions for a page
revisions.get("/:slug/revisions", async (c) => {
  const slug = c.req.param("slug");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const result = await revisionService.listRevisions(slug, page, limit);
  return c.json(result);
});

// Get specific revision
revisions.get("/:slug/revisions/:rev", async (c) => {
  const slug = c.req.param("slug");
  const rev = parseInt(c.req.param("rev"));
  const revision = await revisionService.getRevision(slug, rev);
  if (!revision) return c.json({ error: "Revision not found" }, 404);
  return c.json(revision);
});

// Diff between two revisions
revisions.get("/:slug/diff", async (c) => {
  const slug = c.req.param("slug");
  const from = parseInt(c.req.query("from") || "1");
  const to = parseInt(c.req.query("to") || "2");
  const diff = await revisionService.getDiff(slug, from, to);
  if (!diff) return c.json({ error: "Could not compute diff" }, 404);
  return c.json(diff);
});

// Revert to a specific revision
revisions.post("/:slug/revert/:rev", authMiddleware, async (c) => {
  const slug = c.req.param("slug");
  const revStr = c.req.param("rev");
  if (!slug || !revStr) return c.json({ error: "Missing parameters" }, 400);
  const rev = parseInt(revStr);
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const userName = c.req.header("X-User-Name") || "";
  const page = await revisionService.revertToRevision(slug, rev, userId, userName);
  if (!page) return c.json({ error: "Cannot revert" }, 404);
  return c.json(page);
});

export default revisions;
