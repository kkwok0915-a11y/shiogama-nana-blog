import { useLayoutEffect, useRef, useState } from "react";

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

type LoadState = "loading" | "in" | "done";

/**
 * While loading, the <img> box (sized by width/height, so nothing jumps) shows a shimmer, or for
 * full-size photos the small -sm.webp (usually already cached from a card) as a blurred preview.
 * Once decoded it fades in from a light blur. Cached images skip the animation.
 */
function PhotoImg({ src, alt, width, height, size = "full", priority }: Props) {
  const webp = photoSrc(src, size);
  const preview = size === "full" && webp !== src ? photoSrc(src, "sm") : null;
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<LoadState>("loading");
  useLayoutEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth > 0) setState("done");
  }, []);
  const cls = state === "loading" ? (preview ? "ph ph-preview" : "ph ph-shimmer") : state === "in" ? "ph-in" : undefined;
  return (
    <picture>
      {webp !== src && <source type="image/webp" srcSet={webp} />}
      <img
        ref={ref}
        className={cls}
        style={state === "loading" && preview ? { backgroundImage: `url("${preview}")` } : undefined}
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        width={width}
        height={height}
        onLoad={() => setState((s) => (s === "loading" ? "in" : s))}
        onError={() => setState("done")}
      />
    </picture>
  );
}

export default function Photo(props: Props) {
  // Remount per source so a viewer switching photos restarts the loading state.
  return <PhotoImg key={props.src} {...props} />;
}
