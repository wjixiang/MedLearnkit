import crypto from "node:crypto";

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w一-鿿㐀-䶿\-/]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function computeContentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}
