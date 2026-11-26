/**
 * Instagram archive data layer.
 * - Rows come from GET /api/instagram (server-side Supabase; published only), newest first.
 * - If the API fails or times out, the bundled src/data/instagram.json is used.
 * Photos are our own copies at /photos/ig/<code>/<n>.jpg; Instagram CDN URLs are never used.
 */
import { useCallback, useEffect, useState } from "react";
import raw from "../data/instagram.json";

const API_TIMEOUT_MS = 4000;
const SAFE_SRC = /^\/photos\/ig\/[A-Za-z0-9_-]+\/\d+\.(jpe?g|png|webp)$/i;
const CODE_RE = /^[A-Za-z0-9_-]{5,40}$/;

export type IgSlide =
  | { type: "photo"; src: string; width: number | null; height: number | null }
  | { type: "video"; src: null };

export interface IgRow {
  code: string;
  taken_at: string;
  caption: string;
  permalink: string;
  slides: unknown;
  photo_count?: number;
  added_at?: string;
}

export interface IgPost {
  code: string;
  taken_at: string;
  caption: string;
  permalink: string;
  slides: IgSlide[];
  cover: Extract<IgSlide, { type: "photo" }> | null;
  hasVideo: boolean;
  dateLabel: string; // 2026.11.20 21:05 JST
  monthKey: string; // YYYY-MM (JST)
  searchText: string;
}

const JST = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function jstParts(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const get = (t: string) => JST.formatToParts(d).find((p) => p.type === t)?.value ?? "";
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute") };
}

function cleanSlides(v: unknown): IgSlide[] {
  if (!Array.isArray(v)) return [];
  const out: IgSlide[] = [];
  for (const s of v) {
    if (s && s.type === "video") out.push({ type: "video", src: null });
    else if (s && s.type === "photo" && typeof s.src === "string" && SAFE_SRC.test(s.src))
      out.push({ type: "photo", src: s.src, width: s.width ?? null, height: s.height ?? null });
  }
  return out;
}

export function normalizeIg(row: IgRow): IgPost | null {
  if (!row || typeof row.code !== "string" || !CODE_RE.test(row.code)) return null;
  const p = jstParts(row.taken_at);
  if (!p) return null;
  const slides = cleanSlides(row.slides);
  const caption = typeof row.caption === "string" ? row.caption : "";
  const dateLabel = `${p.y}.${p.m}.${p.d} ${p.h}:${p.min} JST`;
  return {
    code: row.code,
    taken_at: row.taken_at,
    caption,
    permalink: `https://www.instagram.com/p/${row.code}/`,
    slides,
    cover: (slides.find((s) => s.type === "photo") as IgPost["cover"]) ?? null,
    hasVideo: slides.some((s) => s.type === "video"),
    dateLabel,
    monthKey: `${p.y}-${p.m}`,
    searchText: [caption, dateLabel, `${p.y}-${p.m}-${p.d}`].join(" ").toLowerCase(),
  };
}

const toPosts = (rows: IgRow[]) =>
  rows
    .map(normalizeIg)
    .filter((p): p is IgPost => p !== null)
    .sort((a, b) => b.taken_at.localeCompare(a.taken_at));

export const bundledIg = (): IgPost[] => {
  try {
    return toPosts((raw as unknown as { posts: IgRow[] }).posts ?? []);
  } catch {
    return [];
  }
};

export async function fetchIg(): Promise<IgPost[]> {
  try {
    const res = await fetch("/api/instagram", { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`api ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("bad payload");
    const posts = toPosts(data as IgRow[]);
    if (!posts.length) throw new Error("empty");
    return posts;
  } catch (err) {
    console.warn("Instagram API failed; using bundled instagram.json", err);
    return bundledIg();
  }
}

/** Paints the bundled list first, then refreshes from /api/instagram. */
export function useInstagram(): { posts: IgPost[]; loaded: boolean } {
  const [posts, setPosts] = useState<IgPost[]>(bundledIg);
  const [loaded, setLoaded] = useState(false);
  const apply = useCallback((next: IgPost[]) => {
    setPosts((prev) =>
      prev.length === next.length && prev.every((p, i) => p.code === next[i].code && p.caption === next[i].caption && p.slides.length === next[i].slides.length)
        ? prev
        : next,
    );
    setLoaded(true);
  }, []);
  useEffect(() => {
    let alive = true;
    fetchIg().then((p) => alive && apply(p));
    return () => {
      alive = false;
    };
  }, [apply]);
  return { posts, loaded };
}

export function filterIg(list: IgPost[], query: string): IgPost[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return terms.length ? list.filter((p) => terms.every((t) => p.searchText.includes(t))) : list;
}

export const igPath = (code: string) => `/?ig=${encodeURIComponent(code)}`;
export const IG_LIST_PATH = "/?tab=ig";

export function igCodeFromLocation(loc: Location = window.location): string | null {
  const c = new URLSearchParams(loc.search).get("ig");
  return c && CODE_RE.test(c) ? c : null;
}

export const igTabFromLocation = (loc: Location = window.location) => new URLSearchParams(loc.search).get("tab") === "ig";
