import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  char,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

export const wikiPages = pgTable(
  "wiki_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 512 }).notNull().unique(),
    title: varchar("title", { length: 512 }).notNull(),
    parentId: uuid("parent_id"),
    position: integer("position").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_wiki_pages_parent").on(table.parentId),
    index("idx_wiki_pages_slug").on(table.slug),
  ],
);

export const wikiRevisions = pgTable(
  "wiki_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => wikiPages.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    title: varchar("title", { length: 512 }).notNull(),
    content: text("content").notNull().default(""),
    contentHash: char("content_hash", { length: 64 }).notNull(),
    message: varchar("message", { length: 1024 }).default(""),
    authorId: uuid("author_id").notNull(),
    authorName: varchar("author_name", { length: 256 }).default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("idx_wiki_revisions_page_rev").on(table.pageId, table.revisionNumber)],
);

export const wikiPageLinks = pgTable(
  "wiki_page_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourcePageId: uuid("source_page_id")
      .notNull()
      .references(() => wikiPages.id, { onDelete: "cascade" }),
    targetSlug: varchar("target_slug", { length: 512 }).notNull(),
    targetPageId: uuid("target_page_id").references(() => wikiPages.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("idx_wiki_page_links_unique").on(table.sourcePageId, table.targetSlug)],
);

export const wikiAttachments = pgTable("wiki_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  pageId: uuid("page_id").references(() => wikiPages.id, { onDelete: "set null" }),
  filename: varchar("filename", { length: 512 }).notNull(),
  ossKey: varchar("oss_key", { length: 1024 }).notNull(),
  mimeType: varchar("mime_type", { length: 128 }).notNull().default("application/octet-stream"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  uploadedBy: uuid("uploaded_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wikiTags = pgTable("wiki_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull().unique(),
});

export const wikiPageTags = pgTable(
  "wiki_page_tags",
  {
    pageId: uuid("page_id")
      .notNull()
      .references(() => wikiPages.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => wikiTags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.pageId, table.tagId] })],
);

export const wikiImportJobs = pgTable("wiki_import_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  totalFiles: integer("total_files").notNull().default(0),
  imported: integer("imported").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  errors: jsonb("errors").default([]),
  triggeredBy: uuid("triggered_by").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
