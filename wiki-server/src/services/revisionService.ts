import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { wikiRevisions, wikiPages } from "../db/schema.js";
import { computeContentHash } from "../utils/slugify.js";
import * as Diff from "diff";
import type { RevisionListItem, DiffResult, DiffOperation } from "../types/index.js";

export async function listRevisions(slug: string, page = 1, limit = 20) {
  const [pageRow] = await db
    .select({ id: wikiPages.id })
    .from(wikiPages)
    .where(eq(wikiPages.slug, slug));

  if (!pageRow) return { items: [], total: 0 };

  const revisions = await db
    .select({
      revisionNumber: wikiRevisions.revisionNumber,
      title: wikiRevisions.title,
      message: wikiRevisions.message,
      authorName: wikiRevisions.authorName,
      contentHash: wikiRevisions.contentHash,
      createdAt: wikiRevisions.createdAt,
    })
    .from(wikiRevisions)
    .where(eq(wikiRevisions.pageId, pageRow.id))
    .orderBy(desc(wikiRevisions.revisionNumber))
    .limit(limit)
    .offset((page - 1) * limit);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(wikiRevisions)
    .where(eq(wikiRevisions.pageId, pageRow.id));

  const total = Number(countResult[0]?.count ?? 0);

  return {
    items: revisions.map((r) => ({
      ...r,
      contentHash: r.contentHash,
      createdAt: r.createdAt.toISOString(),
    })) as RevisionListItem[],
    total,
  };
}

export async function getRevision(slug: string, rev: number) {
  const [pageRow] = await db
    .select({ id: wikiPages.id })
    .from(wikiPages)
    .where(eq(wikiPages.slug, slug));

  if (!pageRow) return null;

  const [revision] = await db
    .select()
    .from(wikiRevisions)
    .where(and(eq(wikiRevisions.pageId, pageRow.id), eq(wikiRevisions.revisionNumber, rev)));

  if (!revision) return null;

  return {
    ...revision,
    createdAt: revision.createdAt.toISOString(),
  };
}

export async function getDiff(slug: string, fromRev: number, toRev: number): Promise<DiffResult | null> {
  const fromRevision = await getRevision(slug, fromRev);
  const toRevision = await getRevision(slug, toRev);

  if (!fromRevision || !toRevision) return null;

  const patch = Diff.createPatch("content", fromRevision.content, toRevision.content);
  const changes = Diff.diffLines(fromRevision.content, toRevision.content);

  const operations: DiffOperation[] = [];
  let lineNumber = 1;

  for (const change of changes) {
    const lines = change.value.split("\n");
    if (change.value.endsWith("\n")) lines.pop();

    for (const line of lines) {
      operations.push({
        type: change.added ? "insert" : change.removed ? "delete" : "equal",
        content: line,
        lineNumber: lineNumber++,
      });
    }

    if (!change.added) {
      // lineNumber already incremented
    }
  }

  return {
    fromRevision: fromRev,
    toRevision: toRev,
    fromTitle: fromRevision.title,
    toTitle: toRevision.title,
    titleChanged: fromRevision.title !== toRevision.title,
    unifiedDiff: patch,
    operations,
  };
}

export async function revertToRevision(
  slug: string,
  rev: number,
  authorId: string,
  authorName: string,
) {
  const revision = await getRevision(slug, rev);
  if (!revision) return null;

  const pageService = await import("./pageService.js");
  return pageService.updatePage(
    slug,
    {
      title: revision.title,
      content: revision.content,
      message: `Reverted to revision ${rev}`,
    },
    authorId,
    authorName,
  );
}
