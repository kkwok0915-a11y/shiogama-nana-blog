/**
 * Data layer. The UI only calls `fetchPosts()`.
 * - Rows come from GET /api/posts (server-side Supabase; published only).
 * - If the API fails, times out, or returns nothing, the bundled src/data/posts.json is used.
 */
import raw from "../data/posts.json";
import type { Block, DataSource, PhotoBlock, Post, PostRow } from "../types";

const API_TIMEOUT_MS = 4000;

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

async function fetchFromApi(): Promise<PostRow[]> {
  const res = await fetch("/api/posts", { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`api ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("bad payload");
  return data as PostRow[];
}

export interface FetchResult {
  posts: Post[];
  source: DataSource;
  warning?: string;
}

export async function fetchPosts(): Promise<FetchResult> {
  try {
    const rows = await Promise.race([
      fetchFromApi(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), API_TIMEOUT_MS + 500)),
    ]);
    if (rows.length) return { posts: toPosts(rows), source: "supabase" };
    throw new Error("empty");
  } catch (err) {
    console.warn("API fetch failed; using bundled posts.json", err);
    return { posts: toPosts(jsonRows()), source: "json", warning: "資料庫暫時無法連線，以下為備份內容。" };
  }
}

export function filterPosts(list: Post[], query: string): Post[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return terms.length ? list.filter((p) => terms.every((t) => p.searchText.includes(t))) : list;
}

const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** True when the post was added to this site within the last 7 days. */
export const isNew = (p: Post, now = Date.now()) => {
  const t = Date.parse(p.added_at);
  return !Number.isNaN(t) && now - t >= 0 && now - t < NEW_WINDOW_MS;
};

/** Shareable list/post URLs use `?p=<id>` (hash and path routes are not used). */
export function postPath(id: string): string {
  return `/?p=${encodeURIComponent(id)}`;
}

export function postShareUrl(id: string, origin = window.location.origin): string {
  return `${origin}${postPath(id)}`;
}

export function postIdFromLocation(loc: Location = window.location): string | null {
  const q = new URLSearchParams(loc.search).get("p");
  if (q) return q;
  const h = loc.hash;
  if (h.startsWith("#p=")) return decodeURIComponent(h.slice(3)) || null;
  return null;
}

export function historyHasPostState(): boolean {
  return Boolean(window.history.state && typeof window.history.state === "object" && "p" in window.history.state);
}

export function monthKey(date: string | null): string {
  return (date || "").slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  if (!y || !m) return "其他";
  return `${y}年${Number(m)}月`;
}

export interface MonthGroup<T = Post> {
  key: string;
  label: string;
  count: number;
  items: T[];
}

/** Group already-sorted (newest first) items by YYYY-MM, preserving month order. */
export function groupByMonth<T extends { post_date: string | null }>(list: T[]): MonthGroup<T>[] {
  const map = new Map<string, T[]>();
  const order: string[] = [];
  for (const item of list) {
    const key = monthKey(item.post_date) || "unknown";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(item);
  }
  return order.map((key) => ({
    key,
    label: key === "unknown" ? "其他" : monthLabel(key),
    count: map.get(key)!.length,
    items: map.get(key)!,
  }));
}
