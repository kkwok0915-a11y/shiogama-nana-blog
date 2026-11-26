/** 動態: one newest-first timeline of blog posts and Instagram posts. */
import type { IgPost } from "./instagram";
import type { Post } from "../types";

export type FeedItem =
  | { kind: "blog"; key: string; post: Post; post_date: string | null }
  | { kind: "ig"; key: string; ig: IgPost; post_date: string | null };

/** YYYY-MM-DD (JST) from an IgPost date label "2026.11.20 21:05 JST". */
export const igDay = (p: IgPost) => p.dateLabel.slice(0, 10).replace(/\./g, "-");

export function feedItems(posts: Post[], igPosts: IgPost[]): FeedItem[] {
  const blog: FeedItem[] = posts.map((post) => ({ kind: "blog", key: `b-${post.id}`, post, post_date: post.post_date }));
  const ig: FeedItem[] = igPosts.map((p) => ({ kind: "ig", key: `i-${p.code}`, ig: p, post_date: igDay(p) }));
  // Newest first by post date (JST); on the same day the blog post comes first (stable sort).
  return [...blog, ...ig].sort((a, b) => (b.post_date ?? "").localeCompare(a.post_date ?? ""));
}

const HAS_TEXT = /[\p{L}\p{N}]/u;

/** First meaningful caption lines (skips "・" spacer lines and hashtag-only lines). */
export function captionLines(caption: string): string[] {
  return caption
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => HAS_TEXT.test(l) && !/^(#\S+\s*)+$/.test(l));
}
