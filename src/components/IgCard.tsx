import Photo from "./Photo";
import { captionLines } from "../lib/feed";
import { igPath, type IgPost } from "../lib/instagram";

/** Instagram post in the 動態 feed; same card geometry as PostCard. */
export default function IgCard({ post, onOpen, priority }: { post: IgPost; onOpen: (p: IgPost) => void; priority?: boolean }) {
  const lines = captionLines(post.caption);
  const title = lines[0] ?? "Instagram 貼文";
  const rest = lines.slice(1).join(" ");
  return (
    <li className="card card-ig">
      <a
        className="card-btn"
        href={igPath(post.code)}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          onOpen(post);
        }}
      >
        <span className="thumb">
          {post.cover ? (
            <Photo
              src={post.cover.src}
              alt=""
              width={post.cover.width ?? undefined}
              height={post.cover.height ?? undefined}
              size="sm"
              priority={priority}
            />
          ) : (
            <span className="thumb-fallback" aria-hidden="true">IG</span>
          )}
          {post.slides.length > 1 && (
            <span className="badge-count" aria-label={`${post.slides.length} 張`}>
              📷 {post.slides.length}
            </span>
          )}
        </span>
        <span className="card-body">
          <span className="card-meta">
            <span className="card-date">{post.dateLabel.slice(0, 10)}</span>
            <span className="src-badge src-ig">IG</span>
          </span>
          <span className="card-title card-title-ig" lang="ja">{title}</span>
          {rest && <span className="card-excerpt" lang="ja">{rest}</span>}
        </span>
      </a>
    </li>
  );
}
