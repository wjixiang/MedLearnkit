import matter from "gray-matter";

export interface FrontmatterResult {
  title?: string;
  tags?: string[];
  aliases?: string[];
  parent?: string;
  content: string;
}

export function parseFrontmatter(rawContent: string): FrontmatterResult {
  const { data, content } = matter(rawContent);
  return {
    title: data.title as string | undefined,
    tags: Array.isArray(data.tags) ? data.tags : typeof data.tags === "string" ? [data.tags] : undefined,
    aliases: Array.isArray(data.aliases) ? data.aliases : undefined,
    parent: data.parent as string | undefined,
    content: content.trim(),
  };
}
