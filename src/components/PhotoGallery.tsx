import { useMemo, useState } from "react";
import { groupByMonth } from "../lib/posts";
import type { PhotoBlock, Post } from "../types";
import Lightbox from "./Lightbox";
import Photo from "./Photo";
import MonthNav from "./MonthNav";

interface Item {
  photo: PhotoBlock;
  post: Post;
  post_date: string | null;
}

interface Props {
  posts: Post[];
  onOpenPost: (p: Post) => void;
}

export default function PhotoGallery({ posts, onOpenPost }: Props) {
  const items = useMemo<Item[]>(
    () => posts.flatMap((post) => post.photos.map((photo) => ({ photo, post, post_date: post.post_date }))),
    [posts],
  );
  const months = useMemo(() => groupByMonth(items), [items]);
  const [lb, setLb] = useState<number | null>(null);
  const photos = items.map((it) => it.photo);
  const current = lb !== null ? items[lb] : null;

  if (!items.length) {
    return (
      <div className="empty" role="status">
        <p>這個範圍還沒有照片。</p>
      </div>
    );
  }

  return (
    <>
      <MonthNav months={months} prefix="gallery-month" />
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
                <li key={`${it.post.id}-${it.photo.src}`}>
                  <button
                    type="button"
                    className="gallery-btn"
                    onClick={() => setLb(idx)}
                    aria-label={`${it.post.dateLabel} ${it.post.title_zh} 的照片`}
                  >
                    <Photo
                      src={it.photo.src}
                      alt={it.photo.alt ?? ""}
                      width={it.photo.width ?? undefined}
                      height={it.photo.height ?? undefined}
                      size="sm"
                    />
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
            ? {
                label: "查看文章",
                onClick: () => {
                  setLb(null);
                  onOpenPost(current.post);
                },
              }
            : null
        }
      />
    </>
  );
}
