import fs from "node:fs";
import path from "node:path";

// Posts are Markdown files in content/blog/ (see _template.md there).
const POSTS_DIR = path.join(process.cwd(), "content", "blog");

export type Post = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  cover?: string;
  body: string;
};

function parseFrontmatter(raw: string) {
  const meta: Record<string, string> = {};
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { meta, body: raw };
  for (const line of match[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (k) meta[k] = v;
  }
  return { meta, body: raw.slice(match[0].length) };
}

function titleFromSlug(slug: string) {
  const s = slug.replace(/[-_]+/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function readPost(file: string): Post {
  const slug = file.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
  const { meta, body } = parseFrontmatter(raw);
  return {
    slug,
    title: meta.title || titleFromSlug(slug),
    date: meta.date || "",
    summary: meta.summary || "",
    cover: meta.cover || undefined,
    body,
  };
}

function postFiles() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
}

export function getPosts(): Post[] {
  return postFiles()
    .map(readPost)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPost(slug: string): Post | undefined {
  const file = `${slug}.md`;
  return postFiles().includes(file) ? readPost(file) : undefined;
}

export function formatDate(date: string) {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
