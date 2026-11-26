import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import type { IgPost } from "../lib/instagram";
import type { PhotoBlock } from "../types";
import Lightbox from "./Lightbox";
import Photo from "./Photo";

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

interface Props {
  post: IgPost;
  prev: IgPost | null; // older
  next: IgPost | null; // newer
  onBack: () => void;
  onOpen: (p: IgPost) => void;
}

export default function InstagramView({ post, prev, next, onBack, onOpen }: Props) {
  const [slide, setSlide] = useState(0);
  const [lb, setLb] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const photos: PhotoBlock[] = post.slides.flatMap((s) =>
    s.type === "photo" ? [{ type: "photo" as const, src: s.src, alt: `${post.dateLabel} Instagram 照片`, width: s.width, height: s.height }] : [],
  );
  const count = post.slides.length;

  const go = (i: number) => {
    const el = track.current;
    const n = Math.max(0, Math.min(count - 1, i));
    if (el) el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
    setSlide(n);
  };

  // Keep the dot indicator in sync with swipes.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setSlide(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  let photoIdx = -1;
  return (
    <article className="post ig-post" aria-labelledby="ig-title">
      <div className="post-nav top">
        <button type="button" className="pill" onClick={onBack}>
          ← 返回 Instagram
        </button>
        <a className="pill ghost" href={post.permalink} target="_blank" rel="noopener noreferrer">
          在 Instagram 開啟 ↗
        </a>
      </div>

      <header className="post-head">
        <h2 id="ig-title" className="post-date">
          {post.dateLabel}
        </h2>
      </header>

      <div className="ig-carousel" aria-roledescription="carousel" aria-label="貼文照片">
        <div className="ig-track" ref={track}>
          {post.slides.map((s, i) => {
            if (s.type === "video") {
              return (
                <div className="ig-slide ig-video" key={i} aria-roledescription="slide" aria-label={`${i + 1} / ${count}`}>
                  <p>這一張是影片，無法存檔。</p>
                  <a className="pill" href={post.permalink} target="_blank" rel="noopener noreferrer">
                    在 Instagram 觀看 ↗
                  </a>
                </div>
              );
            }
            photoIdx += 1;
            const idx = photoIdx;
            return (
              <div className="ig-slide" key={i} aria-roledescription="slide" aria-label={`${i + 1} / ${count}`}>
                <button type="button" className="photo-btn" onClick={() => setLb(idx)} aria-label="放大照片">
                  <Photo src={s.src} alt={photos[idx].alt ?? ""} width={s.width ?? undefined} height={s.height ?? undefined} size="full" priority={i === 0} />
                </button>
              </div>
            );
          })}
        </div>
        {count > 1 && (
          <div className="ig-controls">
            <button type="button" className="ig-arrow" onClick={() => go(slide - 1)} disabled={slide === 0} aria-label="上一張">
              ‹
            </button>
            <span className="ig-dots" aria-live="polite">
              {post.slides.map((_, i) => (
                <span key={i} className={"ig-dot" + (i === slide ? " on" : "")} />
              ))}
              <span className="visually-hidden">
                第 {slide + 1} 張，共 {count} 張
              </span>
            </span>
            <button type="button" className="ig-arrow" onClick={() => go(slide + 1)} disabled={slide === count - 1} aria-label="下一張">
              ›
            </button>
          </div>
        )}
      </div>

      {post.caption && (
        <div className="post-body ig-caption" lang="ja">
          {post.caption.split("\n").map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {linkify(line)}
            </Fragment>
          ))}
        </div>
      )}

      <nav className="post-nav bottom" aria-label="其他貼文">
        {next ? (
          <button type="button" className="adj" onClick={() => onOpen(next)}>
            <span className="adj-label">← 較新的貼文</span>
            <span className="adj-title">{next.dateLabel}</span>
          </button>
        ) : (
          <span />
        )}
        {prev ? (
          <button type="button" className="adj older" onClick={() => onOpen(prev)}>
            <span className="adj-label">較舊的貼文 →</span>
            <span className="adj-title">{prev.dateLabel}</span>
          </button>
        ) : (
          <span />
        )}
      </nav>
      <Lightbox photos={photos} index={lb} onIndex={setLb} />
    </article>
  );
}
