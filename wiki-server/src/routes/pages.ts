import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as pageService from "../services/pageService.js";
import { authMiddleware, getUserId } from "../middleware/auth.js";

const pages = new Hono();

const createSchema = z.object({
  title: z.string().min(1).max(512),
  content: z.string(),
  parentId: z.string().uuid().optional(),
  message: z.string().max(1024).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(512).optional(),
  content: z.string(),
  message: z.string().max(1024).optional(),
});

const moveSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).optional(),
});

// Public: list page tree
pages.get("/", async (c) => {
  const parentId = c.req.query("parent_id");
  const tree = await pageService.getPageTree(parentId || null);
  return c.json(tree);
});

// Public: get page by slug
pages.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const rev = c.req.query("rev");
  const page = await pageService.getPage(slug, rev ? parseInt(rev) : undefined);
  if (!page) return c.json({ error: "Page not found" }, 404);
  return c.json(page);
});

// Protected: create page
pages.post("/", authMiddleware, zValidator("json", createSchema), async (c) => {
  const input = c.req.valid("json");
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const userName = c.req.header("X-User-Name") || "";
  const page = await pageService.createPage(input, userId, userName);
  return c.json(page, 201);
});

// Protected: update page (new revision)
pages.put("/:slug", authMiddleware, zValidator("json", updateSchema), async (c) => {
  const slug = c.req.param("slug");
  const input = c.req.valid("json");
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const userName = c.req.header("X-User-Name") || "";
  const page = await pageService.updatePage(slug, input, userId, userName);
  if (!page) return c.json({ error: "Page not found" }, 404);
  return c.json(page);
});

// Protected: soft delete
pages.delete("/:slug", authMiddleware, async (c) => {
  const slug = c.req.param("slug");
  if (!slug) return c.json({ error: "Missing slug" }, 400);
  const deleted = await pageService.deletePage(slug);
  if (!deleted) return c.json({ error: "Page not found" }, 404);
  return c.json({ success: true });
});

// Public: backlinks
pages.get("/:slug/backlinks", async (c) => {
  const slug = c.req.param("slug");
  const backlinks = await pageService.getBacklinks(slug);
  return c.json(backlinks);
});

// Protected: move page
pages.put("/:slug/move", authMiddleware, zValidator("json", moveSchema), async (c) => {
  const slug = c.req.param("slug");
  const { parentId, position } = c.req.valid("json");
  const page = await pageService.movePage(slug, parentId ?? null, position);
  if (!page) return c.json({ error: "Page not found" }, 404);
  return c.json(page);
});

export default pages;
