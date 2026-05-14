import { eq, isNull, and, desc, sql, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { wikiPages, wikiRevisions, wikiPageLinks, wikiPageTags, wikiTags } from "../db/schema.js";
import { slugify, computeContentHash } from "../utils/slugify.js";
import { extractWikilinks, wikilinkTargetToSlug } from "../utils/wikilinkParser.js";
import type { PageCreateInput, PageUpdateInput, PageResponse, PageTreeItem } from "../types/index.js";

export async function createPage(input: PageCreateInput, authorId: string, authorName: string): Promise<PageResponse> {
  const slug = slugify(input.title);
  const contentHash = computeContentHash(input.content);

  const [page] = await db
    .insert(wikiPages)
    .values({
      slug,
      title: input.title,
      ...(input.parentId ? { parentId: input.parentId } : {}),
    })
    .returning();

  const [revision] = await db
    .insert(wikiRevisions)
    .values({
      pageId: page.id,
      revisionNumber: 1,
      title: input.title,
      content: input.content,
      contentHash,
      message: input.message || "Initial revision",
      authorId,
      authorName,
    })
    .returning();

  await upsertPageLinks(page.id, input.content);

  return toPageResponse(page, revision);
}

export async function getPage(slug: string, rev?: number): Promise<PageResponse | null> {
  const [page] = await db
    .select()
    .from(wikiPages)
    .where(and(eq(wikiPages.slug, slug), isNull(wikiPages.deletedAt)));

  if (!page) return null;

  let revision;
  if (rev) {
    [revision] = await db
      .select()
      .from(wikiRevisions)
      .where(and(eq(wikiRevisions.pageId, page.id), eq(wikiRevisions.revisionNumber, rev)));
  } else {
    [revision] = await db
      .select()
      .from(wikiRevisions)
      .where(eq(wikiRevisions.pageId, page.id))
      .orderBy(desc(wikiRevisions.revisionNumber))
      .limit(1);
  }

  if (!revision) return null;

  const tags = await getPageTags(page.id);
  return toPageResponse(page, revision, tags);
}

export async function updatePage(
  slug: string,
  input: PageUpdateInput,
  authorId: string,
  authorName: string,
): Promise<PageResponse | null> {
  const [page] = await db
    .select()
    .from(wikiPages)
    .where(and(eq(wikiPages.slug, slug), isNull(wikiPages.deletedAt)));

  if (!page) return null;

  const contentHash = computeContentHash(input.content);

  const [latestRev] = await db
    .select()
    .from(wikiRevisions)
    .where(eq(wikiRevisions.pageId, page.id))
    .orderBy(desc(wikiRevisions.revisionNumber))
    .limit(1);

  if (latestRev?.contentHash === contentHash && (!input.title || input.title === page.title)) {
    const tags = await getPageTags(page.id);
    return toPageResponse(page, latestRev, tags);
  }

  const newTitle = input.title || page.title;
  const newRevNum = (latestRev?.revisionNumber ?? 0) + 1;

  const [revision] = await db
    .insert(wikiRevisions)
    .values({
      pageId: page.id,
      revisionNumber: newRevNum,
      title: newTitle,
      content: input.content,
      contentHash,
      message: input.message || "",
      authorId,
      authorName,
    })
    .returning();

  await db
    .update(wikiPages)
    .set({ title: newTitle, updatedAt: new Date() })
    .where(eq(wikiPages.id, page.id));

  await upsertPageLinks(page.id, input.content);

  const tags = await getPageTags(page.id);
  const [updatedPage] = await db.select().from(wikiPages).where(eq(wikiPages.id, page.id));
  return toPageResponse(updatedPage, revision, tags);
}

export async function deletePage(slug: string): Promise<boolean> {
  const result = await db
    .update(wikiPages)
    .set({ deletedAt: new Date() })
    .where(and(eq(wikiPages.slug, slug), isNull(wikiPages.deletedAt)))
    .returning();
  return result.length > 0;
}

export async function movePage(slug: string, parentId: string | null, position?: number): Promise<PageResponse | null> {
  const [page] = await db
    .select()
    .from(wikiPages)
    .where(and(eq(wikiPages.slug, slug), isNull(wikiPages.deletedAt)));

  if (!page) return null;

  await db
    .update(wikiPages)
    .set({
      parentId: parentId || null,
      position: position ?? page.position,
      updatedAt: new Date(),
    })
    .where(eq(wikiPages.id, page.id));

  return getPage(slug);
}

export async function getPageTree(parentId?: string | null): Promise<PageTreeItem[]> {
  const pages = await db
    .select({
      id: wikiPages.id,
      slug: wikiPages.slug,
      title: wikiPages.title,
      parentId: wikiPages.parentId,
      position: wikiPages.position,
      updatedAt: wikiPages.updatedAt,
    })
    .from(wikiPages)
    .where(isNull(wikiPages.deletedAt))
    .orderBy(wikiPages.position, wikiPages.title);

  const childrenMap = new Map<string | null, PageTreeItem[]>();
  for (const p of pages) {
    const key = p.parentId || null;
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key)!.push({
      id: p.id,
      slug: p.slug,
      title: p.title,
      parentId: p.parentId,
      position: p.position,
      hasChildren: false,
      updatedAt: p.updatedAt.toISOString(),
    });
  }

  function buildTree(parent: string | null): PageTreeItem[] {
    const items = childrenMap.get(parent) || [];
    return items.map((item) => {
      const children = buildTree(item.id);
      return { ...item, hasChildren: children.length > 0, children };
    });
  }

  if (parentId) return buildTree(parentId);
  return buildTree(null);
}

export async function getBacklinks(slug: string): Promise<{ id: string; slug: string; title: string; updatedAt: string }[]> {
  const [page] = await db
    .select({ id: wikiPages.id })
    .from(wikiPages)
    .where(and(eq(wikiPages.slug, slug), isNull(wikiPages.deletedAt)));

  if (!page) return [];

  return db
    .select({
      id: wikiPages.id,
      slug: wikiPages.slug,
      title: wikiPages.title,
      updatedAt: sql<string>`${wikiPages.updatedAt}::text`,
    })
    .from(wikiPageLinks)
    .innerJoin(wikiPages, eq(wikiPageLinks.sourcePageId, wikiPages.id))
    .where(and(eq(wikiPageLinks.targetPageId, page.id), isNull(wikiPages.deletedAt)));
}

async function upsertPageLinks(pageId: string, content: string): Promise<void> {
  await db.delete(wikiPageLinks).where(eq(wikiPageLinks.sourcePageId, pageId));

  const links = extractWikilinks(content);
  if (links.length === 0) return;

  const values = links.map((link) => ({
    sourcePageId: pageId,
    targetSlug: wikilinkTargetToSlug(link.target),
    targetPageId: null as string | null,
  }));

  const slugs = values.map((v) => v.targetSlug);
  const targets = slugs.length > 0
    ? await db
        .select({ id: wikiPages.id, slug: wikiPages.slug })
        .from(wikiPages)
        .where(and(inArray(wikiPages.slug, slugs), isNull(wikiPages.deletedAt)))
    : [];

  const slugToId = new Map(targets.map((t) => [t.slug, t.id]));
  for (const v of values) {
    v.targetPageId = slugToId.get(v.targetSlug) || null;
  }

  await db.insert(wikiPageLinks).values(values).onConflictDoNothing();
}

async function getPageTags(pageId: string): Promise<string[]> {
  const rows = await db
    .select({ name: wikiTags.name })
    .from(wikiPageTags)
    .innerJoin(wikiTags, eq(wikiPageTags.tagId, wikiTags.id))
    .where(eq(wikiPageTags.pageId, pageId));
  return rows.map((r) => r.name);
}

function toPageResponse(
  page: typeof wikiPages.$inferSelect,
  revision: typeof wikiRevisions.$inferSelect,
  tags: string[] = [],
): PageResponse {
  return {
    id: page.id,
    slug: page.slug,
    title: revision.title,
    content: revision.content,
    parentId: page.parentId,
    position: page.position,
    tags,
    revisionNumber: revision.revisionNumber,
    authorName: revision.authorName || "",
    updatedAt: page.updatedAt.toISOString(),
    createdAt: page.createdAt.toISOString(),
  };
}
