/**
 * Data layer. The UI only calls `fetchPosts()`.
 * - With VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (publishable key) set at build time,
 *   rows come from Supabase `public.blog_posts` (RLS: published rows only).
 * - Otherwise, or on error/timeout, the bundled src/data/posts.json is used.
 */
import raw from "../data/posts.json";
import type { Block, DataSource, PhotoBlock, Post, PostRow } from "../types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const SUPABASE_TIMEOUT_MS = 4000;
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

const GREETING = /^(おやっとさ|歡迎來到我的部落格|ようこそ)/;
const SAFE_SRC = /^\/photos\/[\w-]+\/[\w.-]+$|^https:\/\//;

function cleanBlocks(body: unknown): Block[] {
  if (!Array.isArray(body)) return [];
  const out: Block[] = [];
  for (const b of body) {
    if (b && b.type === "text" && typeof b.text === "string") out.push({ type: "text", text: b.text });
    else if (b && b.type === "photo" && typeof b.src === "string" && SAFE_SRC.test(b.src))
      out.push({ type: "photo", src: b.src, alt: b.alt ?? null, width: b.width ?? null, height: b.height ?? null });
  }
  return out;
}

export function normalize(row: PostRow): Post | null {
  if (!row || !row.id || row.published === false) return null;
  const body = cleanBlocks(row.body);
  const photos = body.filter((b): b is PhotoBlock => b.type === "photo");
  const text = body.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
  // Excerpt skips the fixed opening greeting lines so cards show what the post is about.
  const lines = text.split("\n");
  while (lines.length && (/^\s*$/.test(lines[0]) || GREETING.test(lines[0]))) lines.shift();
  const flat = lines.join("\n").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  return {
    ...row,
    title_zh: row.title_zh?.trim() || "未命名文章",
    title_jp: row.title_jp?.trim() || null,
    body,
    photos,
    cover: photos[0] ?? null,
    dateLabel: row.post_date ? row.post_date.replace(/-/g, ".") : "",
    excerpt: flat.length > 90 ? flat.slice(0, 90) + "…" : flat,
    searchText: [row.title_zh, row.title_jp, row.post_date, row.post_date?.replace(/-/g, "."), text]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

/** Newest post first (post date, then id). */
export const sortPosts = (list: Post[]) =>
  [...list].sort((a, b) => (b.post_date ?? "").localeCompare(a.post_date ?? "") || b.id.localeCompare(a.id, "en", { numeric: true }));

const toPosts = (rows: PostRow[]) => sortPosts(rows.map(normalize).filter((p): p is Post => p !== null));

export const jsonRows = (): PostRow[] => (raw as unknown as { posts: PostRow[] }).posts ?? [];

async function fetchFromSupabase(): Promise<PostRow[]> {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(SUPABASE_URL!, SUPABASE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client
    .from("blog_posts")
    .select("id, title_zh, title_jp, post_date, original_url, body, photo_count, added_at, published")
    .eq("published", true)
    .order("post_date", { ascending: false })
    .abortSignal(AbortSignal.timeout(SUPABASE_TIMEOUT_MS));
  if (error) throw new Error(error.message);
  return (data ?? []) as PostRow[];
}

export interface FetchResult {
  posts: Post[];
  source: DataSource;
  warning?: string;
}

export async function fetchPosts(): Promise<FetchResult> {
  if (supabaseConfigured) {
    try {
      const rows = await Promise.race([
        fetchFromSupabase(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), SUPABASE_TIMEOUT_MS + 500)),
      ]);
      if (rows.length) return { posts: toPosts(rows), source: "supabase" };
      throw new Error("empty");
    } catch (err) {
      console.warn("Supabase fetch failed; using bundled posts.json", err);
      return { posts: toPosts(jsonRows()), source: "json", warning: "資料庫暫時無法連線，以下為備份內容。" };
    }
  }
  return { posts: toPosts(jsonRows()), source: "json" };
}

export function filterPosts(list: Post[], query: string): Post[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return terms.length ? list.filter((p) => terms.every((t) => p.searchText.includes(t))) : list;
}

const NEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
export const isNew = (p: Post, now = Date.now()) => {
  const t = Date.parse(p.post_date ? p.post_date + "T00:00:00+09:00" : "");
  return !Number.isNaN(t) && now - t < NEW_WINDOW_MS;
};
