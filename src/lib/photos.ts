/** Public origin of the Vercel Blob store. Image tags point here directly to skip the /photos redirect. */
const DEFAULT_PHOTOS_BASE = "https://oulym35m6pqzgo1d.public.blob.vercel-storage.com";

const PHOTO_PATH = /^(\/photos\/(?:\d+|ig\/[A-Za-z0-9_-]+)\/\d+)\.(jpe?g|png|webp)$/i;

const preloaded = new Set<string>();

/** Empty VITE_PHOTOS_BASE keeps site-relative /photos URLs (local files). Unset uses the Blob origin. */
export function photosBase(): string {
  const raw = import.meta.env.VITE_PHOTOS_BASE;
  if (raw === "") return "";
  return (raw ?? DEFAULT_PHOTOS_BASE).replace(/\/$/, "");
}

function asPath(src: string): string {
  if (src.startsWith("/")) return src;
  try {
    return new URL(src).pathname;
  } catch {
    return src;
  }
}

/** Turn a /photos/... path into a URL on the Blob origin (or leave it site-relative). */
export function photoUrl(src: string): string {
  const path = asPath(src);
  if (!path.startsWith("/photos/")) return src;
  const base = photosBase();
  return base ? `${base}${path}` : path;
}

/** Resized WebP when the path is one of ours; otherwise the original URL. */
export function photoSrc(src: string, size: "sm" | "full" = "full"): string {
  const m = asPath(src).match(PHOTO_PATH);
  if (!m) return photoUrl(src);
  return photoUrl(size === "sm" ? `${m[1]}-sm.webp` : `${m[1]}.webp`);
}

/** Blog and archived IG photos have a matching -sm.webp in the store. */
export function hasSmPreview(src: string): boolean {
  return PHOTO_PATH.test(asPath(src));
}

export function preloadPhoto(src: string, size: "sm" | "full" = "full"): void {
  if (typeof window === "undefined") return;
  const url = photoSrc(src, size);
  if (preloaded.has(url)) return;
  preloaded.add(url);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}
