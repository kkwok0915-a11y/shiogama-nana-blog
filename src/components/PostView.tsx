import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { postShareUrl } from "../lib/posts";
import type { Post } from "../types";
import Lightbox from "./Lightbox";
import Photo, { preloadPhoto } from "./Photo";

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

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
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
  const copiedTimer = useRef(0);
  const prevRef = useRef(prev);
  const nextRef = useRef(next);
  const onOpenRef = useRef(onOpen);
  prevRef.current = prev;
  nextRef.current = next;
  onOpenRef.current = onOpen;
  let photoIdx = -1;

  useEffect(() => {
    return () => window.clearTimeout(copiedTimer.current);
  }, []);

  // Arrow keys switch posts when the photo viewer is closed (it uses the same keys).
  useEffect(() => {
    if (lb !== null) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft" && nextRef.current) {
        e.preventDefault();
        onOpenRef.current(nextRef.current);
      } else if (e.key === "ArrowRight" && prevRef.current) {
        e.preventDefault();
        onOpenRef.current(prevRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lb]);

  const share = async () => {
    await copyText(postShareUrl(post.id));
    setCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="post" aria-labelledby="post-title">
      <div className="post-nav top">
        <button type="button" className="pill" onClick={onBack}>
          ← 返回動態
        </button>
        <button type="button" className="pill ghost copy-link" onClick={share}>
          複製連結
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
            閱讀官方原文 ↗
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
              <button type="button" className="photo-btn" onClick={() => setLb(idx)} onMouseEnter={() => preloadPhoto(b.src, "full")} onTouchStart={() => preloadPhoto(b.src, "full")} aria-label={`放大 ${b.alt ?? "照片"}`}>
                <Photo
                  src={b.src}
                  alt={b.alt ?? ""}
                  width={b.width ?? undefined}
                  height={b.height ?? undefined}
                  size="full"
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
      {copied && (
        <div className="toast" role="status">
          已複製連結
        </div>
      )}
    </article>
  );
}
