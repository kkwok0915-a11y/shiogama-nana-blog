import { Fragment, useState, type ReactNode } from "react";
import type { Post } from "../types";
import Lightbox from "./Lightbox";

const URL_RE = /(https?:\/\/[^\s<>）)\]」]+)/g;

function linkify(line: string): ReactNode[] {
  return line.split(URL_RE).map((part, i) =>
    i % 2 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .map((c) => c.trim())
        .filter(Boolean)
        .map((chunk, i) => (
          <p key={i}>
            {chunk.split("\n").map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {linkify(line)}
              </Fragment>
            ))}
          </p>
        ))}
    </>
  );
}

interface Props {
  post: Post;
  prev: Post | null; // older
  next: Post | null; // newer
  onBack: () => void;
  onOpen: (p: Post) => void;
}

export default function PostView({ post, prev, next, onBack, onOpen }: Props) {
  const [lb, setLb] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  let photoIdx = -1;

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}#p=${encodeURIComponent(post.id)}`;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ title: post.title_zh, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <article className="post" aria-labelledby="post-title">
      <div className="post-nav top">
        <button type="button" className="pill" onClick={onBack}>
          ← 返回文章列表
        </button>
        <button type="button" className="pill ghost" onClick={share}>
          {copied ? "已複製連結 ✓" : "分享連結"}
        </button>
      </div>

      <header className="post-head">
        <p className="post-date">{post.dateLabel}</p>
        <h2 id="post-title">{post.title_zh}</h2>
        {post.title_jp && (
          <p className="post-jp" lang="ja">
            原文標題：{post.title_jp}
          </p>
        )}
        {post.original_url && (
          <a className="original" href={post.original_url} target="_blank" rel="noopener noreferrer">
            閱讀日文原文 ↗
          </a>
        )}
      </header>

      <div className="post-body">
        {post.body.map((b, i) => {
          if (b.type === "text") return <Paragraphs key={i} text={b.text} />;
          photoIdx += 1;
          const idx = photoIdx;
          return (
            <figure className="photo" key={i}>
              <button type="button" className="photo-btn" onClick={() => setLb(idx)} aria-label={`放大 ${b.alt ?? "照片"}`}>
                <img
                  src={b.src}
                  alt={b.alt ?? ""}
                  loading="lazy"
                  decoding="async"
                  width={b.width ?? undefined}
                  height={b.height ?? undefined}
                />
              </button>
            </figure>
          );
        })}
      </div>

      <nav className="post-nav bottom" aria-label="其他文章">
        {next ? (
          <button type="button" className="adj" onClick={() => onOpen(next)}>
            <span className="adj-label">← 較新的文章</span>
            <span className="adj-title">{next.title_zh}</span>
          </button>
        ) : (
          <span />
        )}
        {prev ? (
          <button type="button" className="adj older" onClick={() => onOpen(prev)}>
            <span className="adj-label">較舊的文章 →</span>
            <span className="adj-title">{prev.title_zh}</span>
          </button>
        ) : (
          <span />
        )}
      </nav>

      <Lightbox photos={post.photos} index={lb} onIndex={setLb} />
    </article>
  );
}
