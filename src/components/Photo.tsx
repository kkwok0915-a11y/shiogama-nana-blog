import { useLayoutEffect, useRef, useState } from "react";
import { hasSmPreview, photoSrc, photoUrl } from "../lib/photos";

export { photoSrc, photoUrl, preloadPhoto } from "../lib/photos";

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

type LoadState = "loading" | "in" | "done";

/**
 * While a full-size photo loads, the already-cached -sm.webp (or a light placeholder) sits
 * underneath; the full image then fades in. Cached images skip the animation.
 */
function PhotoImg({ src, alt, width, height, size = "full", priority }: Props) {
  const fallback = photoUrl(src);
  const webp = photoSrc(src, size);
  const preview = size === "full" && hasSmPreview(src) ? photoSrc(src, "sm") : null;
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [previewFailed, setPreviewFailed] = useState(false);
  useLayoutEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth > 0) setState("done");
  }, []);

  const cls = state === "loading" ? (preview && !previewFailed ? undefined : "ph ph-shimmer") : state === "in" ? "ph-in" : undefined;

  const imgEl = (
    <picture>
      {webp !== fallback && <source type="image/webp" srcSet={webp} />}
      <img
        ref={ref}
        className={["ph-full", cls].filter(Boolean).join(" ") || undefined}
        src={fallback}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        width={width}
        height={height}
        onLoad={() => {
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          setState((s) => (s === "loading" ? (reduce ? "done" : "in") : s));
        }}
        onError={() => setState("done")}
        onAnimationEnd={() => setState("done")}
      />
    </picture>
  );

  if (size !== "full") return imgEl;

  const showPreview = preview && !previewFailed && state !== "done";
  const showPlaceholder = (!preview || previewFailed) && state === "loading";

  return (
    <span className="ph-frame">
      {showPreview && (
        <img
          className="ph-thumb"
          src={preview}
          alt=""
          aria-hidden="true"
          width={width}
          height={height}
          onError={() => setPreviewFailed(true)}
        />
      )}
      {showPlaceholder && <span className="ph-placeholder" />}
      {imgEl}
    </span>
  );
}

export default function Photo(props: Props) {
  // Remount per source so a viewer switching photos restarts the loading state.
  return <PhotoImg key={props.src} {...props} />;
}
