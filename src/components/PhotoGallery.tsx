import { useEffect, useMemo, useState } from "react";
import { groupByMonth } from "../lib/posts";
import type { IgPost } from "../lib/instagram";
import type { PhotoBlock, Post } from "../types";
import Lightbox from "./Lightbox";
import Photo from "./Photo";

export type GallerySource = "all" | "blog" | "ig";

export type GalleryItem =
  | { kind: "blog"; key: string; photo: PhotoBlock; post: Post; post_date: string | null; label: string }
  | { kind: "ig"; key: string; photo: PhotoBlock; ig: IgPost; post_date: string | null; label: string };

interface Props {
  /** Items to show (already filtered by source and date). */
  items: GalleryItem[];
  counts: Record<GallerySource, number>;
  showSourceFilter: boolean;
  source: GallerySource;
  onSource: (s: GallerySource) => void;
  onOpenPost: (p: Post) => void;
  onOpenIg: (p: IgPost) => void;
}

/** YYYY-MM-DD (JST) from an IgPost date label "2026.11.20 21:05 JST". */
const igDay = (p: IgPost) => p.dateLabel.slice(0, 10).replace(/\./g, "-");

export function galleryItems(posts: Post[], igPosts: IgPost[]): GalleryItem[] {
  const blog: GalleryItem[] = posts.flatMap((post) =>
    post.photos.map((photo) => ({
      kind: "blog" as const,
      key: `b-${post.id}-${photo.src}`,
      photo,
      post,
      post_date: post.post_date,
      label: `${post.dateLabel} ${post.title_zh} 的照片`,
    })),
  );
  const ig: GalleryItem[] = igPosts.flatMap((p) =>
    p.slides.flatMap((s, i) =>
      s.type === "photo"
        ? [
            {
              kind: "ig" as const,
              key: `i-${p.code}-${i}`,
              photo: { type: "photo" as const, src: s.src, alt: "", width: s.width, height: s.height },
              ig: p,
              post_date: igDay(p),
              label: `Instagram ${p.dateLabel} 第 ${i + 1} 張照片`,
            },
          ]
        : [],
    ),
  );
  // Newest first by post date; on the same day, blog photos come before Instagram (stable sort).
  return [...blog, ...ig].sort((a, b) => (b.post_date ?? "").localeCompare(a.post_date ?? ""));
}

const SOURCES: { id: GallerySource; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "blog", label: "Blog" },
  { id: "ig", label: "Instagram" },
];

export default function PhotoGallery({ items, counts, showSourceFilter, source, onSource, onOpenPost, onOpenIg }: Props) {
  const months = useMemo(() => groupByMonth(items), [items]);
  const [lb, setLb] = useState<number | null>(null);
  const photos = useMemo(() => items.map((it) => it.photo), [items]);
  const current = lb !== null ? items[lb] : null;
  // Close the viewer if the list underneath changes (source or date filter).
  useEffect(() => setLb(null), [items]);

  const filterBar = showSourceFilter && (
    <div className="chip-row gallery-filter" role="group" aria-label="照片來源">
      {SOURCES.map((s) => (
        <button
          key={s.id}
          type="button"
          className={"chip" + (source === s.id ? " current" : "")}
          aria-pressed={source === s.id}
          onClick={() => {
            setLb(null);
            onSource(s.id);
          }}
        >
          {s.label}
          <span className="count">{counts[s.id]}</span>
        </button>
      ))}
    </div>
  );

  if (!items.length) {
    return (
      <>
        {filterBar}
        <div className="empty" role="status">
          <p>這個範圍還沒有照片。</p>
        </div>
      </>
    );
  }

  return (
    <>
      {filterBar}
      {months.map((m) => (
        <section key={m.key} className="month-section" aria-labelledby={`gallery-month-${m.key}`}>
          <h2 className="month-heading" id={`gallery-month-${m.key}`}>
            {m.label}
            <span className="month-count">（{m.count}）</span>
          </h2>
          <ul className="gallery">
            {m.items.map((it) => {
              const idx = items.indexOf(it);
              return (
                <li key={it.key}>
                  <button type="button" className="gallery-btn" onClick={() => setLb(idx)} aria-label={it.label}>
                    <Photo
                      src={it.photo.src}
                      alt={it.photo.alt ?? ""}
                      width={it.photo.width ?? undefined}
                      height={it.photo.height ?? undefined}
                      size="sm"
                    />
                    {it.kind === "ig" && source !== "ig" && (
                      <span className="badge-src" aria-hidden="true">
                        IG
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <Lightbox
        photos={photos}
        index={lb}
        onIndex={setLb}
        action={
          current
            ? current.kind === "blog"
              ? {
                  label: "查看文章",
                  onClick: () => {
                    setLb(null);
                    onOpenPost(current.post);
                  },
                }
              : {
                  label: "查看貼文",
                  onClick: () => {
                    setLb(null);
                    onOpenIg(current.ig);
                  },
                }
            : null
        }
        link={current?.kind === "ig" ? { label: "Instagram ↗", href: current.ig.permalink } : null}
      />
    </>
  );
}
