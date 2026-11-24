import { useEffect, useRef } from "react";
import type { PhotoBlock } from "../types";

interface Props {
  photos: PhotoBlock[];
  index: number | null;
  onIndex: (i: number | null) => void;
}

export default function Lightbox({ photos, index, onIndex }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = index !== null && photos[index] !== undefined;

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
      if (e.key === "ArrowRight") onIndex(Math.min(photos.length - 1, index! + 1));
      if (e.key === "ArrowLeft") onIndex(Math.max(0, index! - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, photos.length, onIndex]);

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
          <img src={p.src} alt={p.alt ?? ""} />
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
            <button type="button" className="lb-btn lb-close" onClick={() => onIndex(null)} aria-label="關閉">
              ✕
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
