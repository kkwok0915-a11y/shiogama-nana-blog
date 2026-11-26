import type { IgPost } from "../lib/instagram";
import Photo from "./Photo";

interface Props {
  posts: IgPost[];
  onOpen: (p: IgPost) => void;
}

/** Newest-first square grid of Instagram posts (cover photo + slide count). */
export default function InstagramGrid({ posts, onOpen }: Props) {
  if (!posts.length) {
    return (
      <div className="empty" role="status">
        <p>找不到符合的 Instagram 貼文。</p>
      </div>
    );
  }
  return (
    <ul className="ig-grid">
      {posts.map((p, i) => (
        <li key={p.code}>
          <button
            type="button"
            className="ig-tile"
            onClick={() => onOpen(p)}
            aria-label={`${p.dateLabel} 的 Instagram 貼文${p.slides.length > 1 ? `（${p.slides.length} 張）` : ""}`}
          >
            {p.cover ? (
              <Photo src={p.cover.src} alt="" width={p.cover.width ?? undefined} height={p.cover.height ?? undefined} size="sm" priority={i < 6} />
            ) : (
              <span className="thumb-fallback">IG</span>
            )}
            {p.slides.length > 1 && <span className="badge-count">{p.slides.length}</span>}
            <span className="ig-tile-date">{p.dateLabel.slice(0, 10)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
