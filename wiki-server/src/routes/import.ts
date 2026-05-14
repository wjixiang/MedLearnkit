import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db/index.js";
import { wikiImportJobs } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, getUserId } from "../middleware/auth.js";
import { importFromOSS } from "../services/importService.js";

const importRoutes = new Hono();

const triggerSchema = z.object({
  prefix: z.string().min(1),
  dry_run: z.boolean().optional().default(false),
});

importRoutes.post("/oss", authMiddleware, zValidator("json", triggerSchema), async (c) => {
  const { prefix, dry_run } = c.req.valid("json");
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const [job] = await db
    .insert(wikiImportJobs)
    .values({
      status: "pending",
      triggeredBy: userId,
    })
    .returning();

  if (!dry_run) {
    importFromOSS(job.id, prefix, false).catch(console.error);
  } else {
    importFromOSS(job.id, prefix, true).catch(console.error);
  }

  return c.json({
    id: job.id,
    status: "pending",
    message: dry_run ? "Dry run started" : "Import started",
  });
});

importRoutes.get("/jobs", authMiddleware, async (c) => {
  const jobs = await db
    .select()
    .from(wikiImportJobs)
    .orderBy(desc(wikiImportJobs.createdAt))
    .limit(20);
  return c.json(jobs);
});

importRoutes.get("/jobs/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing job id" }, 400);
  const [job] = await db.select().from(wikiImportJobs).where(eq(wikiImportJobs.id, id));
  if (!job) return c.json({ error: "Job not found" }, 404);
  return c.json(job);
});

export default importRoutes;
