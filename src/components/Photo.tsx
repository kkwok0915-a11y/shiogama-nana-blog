interface Props {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  /** "sm" for cards and the gallery; "full" for the post body and lightbox. */
  size?: "sm" | "full";
  /** First-screen images should load immediately so LCP is not delayed by loading=lazy. */
  priority?: boolean;
}

/** Use a resized WebP when present, and keep the original file as the fallback. */
export function photoSrc(src: string, size: "sm" | "full" = "full"): string {
  const m = src.match(/^(\/photos\/(?:\d+|ig\/[A-Za-z0-9_-]+)\/\d+)\.(jpe?g|png|webp)$/i);
  if (!m) return src;
  return size === "sm" ? `${m[1]}-sm.webp` : `${m[1]}.webp`;
}

export default function Photo({ src, alt, width, height, size = "full", priority }: Props) {
  const webp = photoSrc(src, size);
  return (
    <picture>
      {webp !== src && <source type="image/webp" srcSet={webp} />}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        width={width}
        height={height}
      />
    </picture>
  );
}
