const WIKILINK_REGEX = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

export interface WikilinkMatch {
  target: string;
  display?: string;
}

export function extractWikilinks(content: string): WikilinkMatch[] {
  const matches: WikilinkMatch[] = [];
  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = WIKILINK_REGEX.exec(content)) !== null) {
    const target = match[1].trim();
    if (!seen.has(target)) {
      seen.add(target);
      matches.push({ target, display: match[2]?.trim() });
    }
  }

  return matches;
}

export function wikilinkTargetToSlug(target: string): string {
  return target
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w一-鿿㐀-䶿\-/]/g, "");
}
