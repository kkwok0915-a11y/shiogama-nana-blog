interface Props {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  /** "sm" for cards and the gallery; "full" for the post body and lightbox. */
  size?: "sm" | "full";
}

/** Use a resized WebP when present, and keep the original file as the fallback. */
export function photoSrc(src: string, size: "sm" | "full" = "full"): string {
  const m = src.match(/^(\/photos\/\d+\/\d+)\.(jpe?g|png|webp)$/i);
  if (!m) return src;
  return size === "sm" ? `${m[1]}-sm.webp` : `${m[1]}.webp`;
}

export default function Photo({ src, alt, width, height, size = "full" }: Props) {
  const webp = photoSrc(src, size);
  return (
    <picture>
      {webp !== src && <source type="image/webp" srcSet={webp} />}
      <img src={src} alt={alt} loading="lazy" decoding="async" width={width} height={height} />
    </picture>
  );
}
