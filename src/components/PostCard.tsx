import Photo from "./Photo";
import { isNew, postPath } from "../lib/posts";
import type { Post } from "../types";

export default function PostCard({ post, onOpen, read }: { post: Post; onOpen: (p: Post) => void; read: boolean }) {
  return (
    <li className={"card" + (read ? " read" : "")}>
      <a
        className="card-btn"
        href={postPath(post.id)}
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
            />
          ) : (
            <span className="thumb-fallback" aria-hidden="true">菜那</span>
          )}
          {isNew(post) && (
            <span className="badge-new" aria-label="NEW">
              NEW
            </span>
          )}
          {read && (
            <span className="badge-read" aria-label="已讀">
              已讀
            </span>
          )}
          {post.photo_count > 1 && <span className="badge-count" aria-label={`${post.photo_count} 張照片`}>📷 {post.photo_count}</span>}
        </span>
        <span className="card-body">
          <span className="card-date">{post.dateLabel}</span>
          <span className="card-title">{post.title_zh}</span>
          {post.title_jp && <span className="card-jp" lang="ja">{post.title_jp}</span>}
          {post.excerpt && <span className="card-excerpt">{post.excerpt}</span>}
        </span>
      </a>
    </li>
  );
}
