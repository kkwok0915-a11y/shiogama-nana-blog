import { useEffect, useRef } from "react";
import Photo, { preloadPhoto } from "./Photo";
import { useDialogFocus } from "../lib/modalFocus";
import type { PhotoBlock } from "../types";

interface Props {
  photos: PhotoBlock[];
  index: number | null;
  onIndex: (i: number | null) => void;
  action?: { label: string; onClick: () => void } | null;
  /** Optional external link (e.g. the Instagram permalink), opened in a new tab. */
  link?: { label: string; href: string } | null;
}

export default function Lightbox({ photos, index, onIndex, action, link }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const indexRef = useRef(index);
  const photosRef = useRef(photos);
  const onIndexRef = useRef(onIndex);
  indexRef.current = index;
  photosRef.current = photos;
  onIndexRef.current = onIndex;
  const open = index !== null && photos[index] !== undefined;

  useDialogFocus(open, ref);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    document.body.classList.toggle("modal-open", open);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onIndex(Math.min(photos.length - 1, index! + 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onIndex(Math.max(0, index! - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, photos.length, onIndex]);

  // Swipe left/right on the photo viewer (mobile).
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    let x0 = 0;
    let y0 = 0;
    let tracking = false;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      tracking = true;
    };
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      const i = indexRef.current;
      const list = photosRef.current;
      if (i === null) return;
      if (dx < 0 && i < list.length - 1) onIndexRef.current(i + 1);
      if (dx > 0 && i > 0) onIndexRef.current(i - 1);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [open]);

  useEffect(() => {
    if (index === null) return;
    if (index > 0) preloadPhoto(photos[index - 1].src, "full");
    if (index < photos.length - 1) preloadPhoto(photos[index + 1].src, "full");
  }, [index, photos]);

  const p = open ? photos[index!] : null;
  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-label="照片檢視"
      onClose={() => onIndex(null)}
      onClick={(e) => e.target === e.currentTarget && onIndex(null)}
    >
      {p && (
        <>
          <Photo src={p.src} alt={p.alt ?? ""} width={p.width ?? undefined} height={p.height ?? undefined} size="full" priority />
          <div className="lb-bar">
            <button type="button" className="lb-btn" onClick={() => onIndex(index! - 1)} disabled={index === 0} aria-label="上一張">
              ‹
            </button>
            <span className="lb-count">
              {index! + 1} / {photos.length}
            </span>
            <button
              type="button"
              className="lb-btn"
              onClick={() => onIndex(index! + 1)}
              disabled={index === photos.length - 1}
              aria-label="下一張"
            >
              ›
            </button>
            {action && (
              <button type="button" className="lb-action" onClick={action.onClick}>
                {action.label}
              </button>
            )}
            {link && (
              <a className="lb-action lb-link" href={link.href} target="_blank" rel="noopener noreferrer">
                {link.label}
              </a>
            )}
            <button type="button" className="lb-btn lb-close" onClick={() => onIndex(null)} aria-label="關閉">
              ✕
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
