import OSS from "ali-oss";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { wikiPages, wikiRevisions, wikiPageLinks, wikiImportJobs } from "../db/schema.js";
import { slugify, computeContentHash } from "../utils/slugify.js";
import { extractWikilinks, wikilinkTargetToSlug } from "../utils/wikilinkParser.js";
import { parseFrontmatter } from "../utils/frontmatter.js";
import { config } from "../config.js";

function createOssClient(): OSS {
  return new OSS({
    region: config.oss.region,
    accessKeyId: config.oss.accessKeyId,
    accessKeySecret: config.oss.accessKeySecret,
    bucket: config.oss.bucket,
    endpoint: config.oss.endpoint,
  });
}

interface ImportProgress {
  totalFiles: number;
  imported: number;
  skipped: number;
  errors: Array<{ file: string; error: string }>;
}

export async function importFromOSS(jobId: string, prefix: string, dryRun: boolean): Promise<void> {
  await db
    .update(wikiImportJobs)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(wikiImportJobs.id, jobId));

  const progress: ImportProgress = { totalFiles: 0, imported: 0, skipped: 0, errors: [] };

  try {
    const client = createOssClient();
    const files = await listMarkdownFiles(client, prefix);
    progress.totalFiles = files.length;

    if (dryRun) {
      await db
        .update(wikiImportJobs)
        .set({
          status: "completed",
          totalFiles: progress.totalFiles,
          imported: 0,
          skipped: progress.totalFiles,
          completedAt: new Date(),
        })
        .where(eq(wikiImportJobs.id, jobId));
      return;
    }

    // First pass: create all pages (to resolve parent-child from folder structure)
    const slugToPageId = new Map<string, string>();

    for (const file of files) {
      try {
        const result = await client.get(file.name);
        const rawContent = result.content.toString("utf-8");
        const parsed = parseFrontmatter(rawContent);

        // Derive slug from folder path + title
        const relativePath = file.name.slice(prefix.length);
        const pathParts = relativePath.split("/").filter(Boolean);

        // Ensure parent pages exist for folder structure
        let parentId: string | null = null;
        if (pathParts.length > 1) {
          // Create parent pages for intermediate folders
          for (let i = 0; i < pathParts.length - 1; i++) {
            const folderName = pathParts[i];
            const parentSlug = pathParts.slice(0, i + 1).map((p) => slugify(p.replace(/\.md$/, ""))).join("/");

            if (!slugToPageId.has(parentSlug)) {
              const [existing] = await db
                .select({ id: wikiPages.id })
                .from(wikiPages)
                .where(eq(wikiPages.slug, parentSlug));

              if (existing) {
                slugToPageId.set(parentSlug, existing.id);
              } else {
                const [created] = await db
                  .insert(wikiPages)
                  .values({
                    slug: parentSlug,
                    title: folderName,
                    parentId,
                  })
                  .returning();
                slugToPageId.set(parentSlug, created.id);

                // Create initial revision for folder page
                await db.insert(wikiRevisions).values({
                  pageId: created.id,
                  revisionNumber: 1,
                  title: folderName,
                  content: "",
                  contentHash: computeContentHash(""),
                  message: "Auto-created during import",
                  authorId: "00000000-0000-0000-0000-000000000000",
                  authorName: "Import",
                });
              }
            }
            parentId = slugToPageId.get(parentSlug)!;
          }
        }

        const title = parsed.title || pathParts[pathParts.length - 1].replace(/\.md$/, "");
        const pageSlug = pathParts
          .map((p) => slugify(p.replace(/\.md$/, "")))
          .join("/");

        // Check if page already exists
        const [existing] = await db
          .select({ id: wikiPages.id })
          .from(wikiPages)
          .where(eq(wikiPages.slug, pageSlug));

        const contentHash = computeContentHash(parsed.content);

        if (existing) {
          // Check if content changed
          const [latestRev] = await db
            .select()
            .from(wikiRevisions)
            .where(eq(wikiRevisions.pageId, existing.id))
            .orderBy(sql`${wikiRevisions.revisionNumber} DESC`)
            .limit(1);

          if (latestRev && latestRev.contentHash === contentHash) {
            progress.skipped++;
            slugToPageId.set(pageSlug, existing.id);
            continue;
          }

          // Create new revision
          const newRevNum = (latestRev?.revisionNumber ?? 0) + 1;
          await db.insert(wikiRevisions).values({
            pageId: existing.id,
            revisionNumber: newRevNum,
            title,
            content: parsed.content,
            contentHash,
            message: "Updated via OSS import",
            authorId: "00000000-0000-0000-0000-000000000000",
            authorName: "Import",
          });

          await db
            .update(wikiPages)
            .set({ title, updatedAt: new Date() })
            .where(eq(wikiPages.id, existing.id));

          slugToPageId.set(pageSlug, existing.id);
          progress.imported++;
        } else {
          // Create new page
          const [page] = await db
            .insert(wikiPages)
            .values({ slug: pageSlug, title, parentId })
            .returning();

          await db.insert(wikiRevisions).values({
            pageId: page.id,
            revisionNumber: 1,
            title,
            content: parsed.content,
            contentHash,
            message: "Imported from OSS",
            authorId: "00000000-0000-0000-0000-000000000000",
            authorName: "Import",
          });

          slugToPageId.set(pageSlug, page.id);
          progress.imported++;
        }

        // Update progress periodically
        await db
          .update(wikiImportJobs)
          .set({
            totalFiles: progress.totalFiles,
            imported: progress.imported,
            skipped: progress.skipped,
          })
          .where(eq(wikiImportJobs.id, jobId));
      } catch (err: any) {
        progress.errors.push({ file: file.name, error: err.message });
      }
    }

    // Second pass: rebuild wikilinks now that all pages exist
    for (const [pageSlug, pageId] of slugToPageId) {
      try {
        const [rev] = await db
          .select()
          .from(wikiRevisions)
          .where(eq(wikiRevisions.pageId, pageId))
          .orderBy(sql`${wikiRevisions.revisionNumber} DESC`)
          .limit(1);

        if (!rev) continue;

        const links = extractWikilinks(rev.content);
        if (links.length === 0) continue;

        await db.delete(wikiPageLinks).where(eq(wikiPageLinks.sourcePageId, pageId));

        const linkValues = links.map((link) => ({
          sourcePageId: pageId,
          targetSlug: wikilinkTargetToSlug(link.target),
          targetPageId: null as string | null,
        }));

        const targetSlugs = linkValues.map((v) => v.targetSlug);
        const targets = await db
          .select({ id: wikiPages.id, slug: wikiPages.slug })
          .from(wikiPages)
          .where(sql`${wikiPages.slug} = ANY(${targetSlugs})`);

        const slugToId = new Map(targets.map((t) => [t.slug, t.id]));
        for (const v of linkValues) {
          v.targetPageId = slugToId.get(v.targetSlug) || null;
        }

        await db.insert(wikiPageLinks).values(linkValues).onConflictDoNothing();
      } catch {
        // Skip link errors
      }
    }

    await db
      .update(wikiImportJobs)
      .set({
        status: "completed",
        totalFiles: progress.totalFiles,
        imported: progress.imported,
        skipped: progress.skipped,
        errors: progress.errors.length > 0 ? progress.errors : undefined,
        completedAt: new Date(),
      })
      .where(eq(wikiImportJobs.id, jobId));
  } catch (err: any) {
    await db
      .update(wikiImportJobs)
      .set({
        status: "failed",
        totalFiles: progress.totalFiles,
        imported: progress.imported,
        skipped: progress.skipped,
        errors: [{ file: "general", error: err.message }],
        completedAt: new Date(),
      })
      .where(eq(wikiImportJobs.id, jobId));
  }
}

async function listMarkdownFiles(
  client: OSS,
  prefix: string,
): Promise<Array<{ name: string; size: number }>> {
  const files: Array<{ name: string; size: number }> = [];
  let marker: string | undefined;

  do {
    const result = await client.list(
      {
        prefix: prefix.endsWith("/") ? prefix : prefix + "/",
        marker,
        "max-keys": 100,
      },
      {},
    );

    for (const obj of result.objects || []) {
      if (obj.name.endsWith(".md")) {
        files.push({ name: obj.name, size: obj.size });
      }
    }

    marker = result.isTruncated ? result.nextMarker : undefined;
  } while (marker);

  return files;
}
