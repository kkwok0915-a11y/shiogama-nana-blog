#!/usr/bin/env python3
"""Generate resized WebP companions next to each blog photo. No paid services."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "public" / "photos"

# Card/gallery vs post-body / lightbox sizes.
SIZES = {
    "sm": (640, 80, "-sm.webp"),
    "full": (1280, 82, ".webp"),
}


def variants(src: Path) -> list[tuple[Path, int, int]]:
    stem = src.stem  # "1" from 1.jpg
    if stem.endswith("-sm"):
        return []
    out = []
    for key, (max_w, quality, suffix) in SIZES.items():
        dest = src.with_name(f"{stem}{suffix}" if key == "full" else f"{stem}{suffix}")
        # full: 1.webp ; sm: 1-sm.webp
        out.append((dest, max_w, quality))
    return out


def fit(im: Image.Image, max_w: int) -> Image.Image:
    if im.width <= max_w:
        return im
    h = round(im.height * (max_w / im.width))
    return im.resize((max_w, h), Image.Resampling.LANCZOS)


def optimize_one(src: Path) -> int:
    written = 0
    try:
        with Image.open(src) as im:
            im = im.convert("RGB")
            for dest, max_w, quality in variants(src):
                if dest.exists() and dest.stat().st_mtime >= src.stat().st_mtime:
                    continue
                out = fit(im, max_w)
                out.save(dest, "WEBP", quality=quality, method=6)
                written += 1
    except Exception as e:
        print(f"warning: skip {src}: {e}", file=sys.stderr)
    return written


def main() -> int:
    if not PHOTOS.is_dir():
        print(f"optimize-photos: no {PHOTOS}")
        return 0
    written = 0
    n = 0
    for src in sorted(PHOTOS.rglob("*")):
        if src.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        if src.name.endswith("-sm.webp") or (src.suffix.lower() == ".webp" and not src.stem.endswith("-sm") and src.name[0].isdigit() and src.with_suffix(".jpg").exists()):
            # Don't re-optimize generated webps as sources when a jpg original exists.
            if src.suffix.lower() == ".webp":
                continue
        n += 1
        written += optimize_one(src)
    print(f"optimize-photos: {written} webp files written from {n} originals")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
