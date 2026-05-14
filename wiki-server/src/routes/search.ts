import { Hono } from "hono";
import { sql, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { wikiPages, wikiRevisions } from "../db/schema.js";

const search = new Hono();

search.get("/", async (c) => {
  const q = c.req.query("q") || "";
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);

  if (!q.trim()) return c.json({ items: [], total: 0 });

  const offset = (page - 1) * limit;

  const results = await db.execute(sql`
    SELECT
      p.slug,
      latest.title,
      ts_headline(
        'simple',
        latest.content,
        plainto_tsquery('simple', ${q}),
        'MaxWords=35, MinWords=10, ShortWord=3, MaxFragments=3'
      ) as excerpt,
      ts_rank(
        to_tsvector('simple', coalesce(latest.title, '') || ' ' || coalesce(latest.content, '')),
        plainto_tsquery('simple', ${q})
      ) as score
    FROM ${wikiPages} p
    INNER JOIN LATERAL (
      SELECT r.title, r.content
      FROM ${wikiRevisions} r
      WHERE r.page_id = p.id
      ORDER BY r.revision_number DESC
      LIMIT 1
    ) latest ON true
    WHERE p.deleted_at IS NULL
    AND (
      to_tsvector('simple', coalesce(latest.title, '') || ' ' || coalesce(latest.content, ''))
      @@ plainto_tsquery('simple', ${q})
      OR latest.title ILIKE ${"%" + q + "%"}
    )
    ORDER BY score DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  const rows = results as unknown as Array<{ slug: string; title: string; excerpt: string; score: string }>;

  return c.json({
    items: rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt,
      score: Number(r.score),
    })),
    total: rows.length,
  });
});

export default search;
