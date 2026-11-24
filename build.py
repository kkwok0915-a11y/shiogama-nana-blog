#!/usr/bin/env python3
"""Rebuild the 塩釜菜那 blog archive static site from translations and photos."""

from __future__ import annotations

import hashlib
import html
import json
import re
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WATCH = Path("/workspace/blog-watch")
TRANSLATIONS = WATCH / "translations"
PHOTOS_DIR = WATCH / "photos"
PUBLIC = ROOT / "public"
STYLES_SRC = ROOT / "styles.css"
VERCEL_JSON_SRC = ROOT / "vercel.json"
MANIFEST = ROOT / "deploy-manifest.json"

IMG_PLACEHOLDER = re.compile(r"［圖片\s*(\d+)］")
META_LINE = re.compile(r"^-\s*([^:：]+)\s*[:：]\s*(.*)$")
URL_RE = re.compile(r"(https?://[^\s<>）)\]]+)")
ADELAIDE = timezone(timedelta(hours=10, minutes=30))


def find_photo(post_id: str, n: int, listed: Path | None = None) -> Path | None:
    candidates: list[Path] = []
    if listed is not None:
        candidates.append(listed)
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".JPG", ".JPEG", ".PNG"):
        candidates.append(PHOTOS_DIR / post_id / f"{n}{ext}")
        candidates.append(WATCH / f"shiogama-nana-{post_id}-{n}{ext}")
        candidates.append(WATCH / f"{post_id}-{n}{ext}")
    seen: set[Path] = set()
    for path in candidates:
        try:
            resolved = path.resolve()
        except OSError:
            continue
        if resolved in seen:
            continue
        seen.add(resolved)
        if path.is_file():
            return path
    return None


def discover_photo_numbers(post_id: str, body: str, listed: dict[int, Path]) -> list[int]:
    numbers = set(listed)
    numbers.update(int(m.group(1)) for m in IMG_PLACEHOLDER.finditer(body))
    post_dir = PHOTOS_DIR / post_id
    if post_dir.is_dir():
        for path in post_dir.iterdir():
            m = re.fullmatch(r"(\d+)\.(?:jpe?g|png|webp)", path.name, re.I)
            if m:
                numbers.add(int(m.group(1)))
    for path in WATCH.glob(f"shiogama-nana-{post_id}-*"):
        m = re.fullmatch(
            rf"shiogama-nana-{re.escape(post_id)}-(\d+)\.(?:jpe?g|png|webp)",
            path.name,
            re.I,
        )
        if m:
            numbers.add(int(m.group(1)))
    return sorted(numbers)


def parse_post(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    post_id = path.stem
    title_m = re.search(r"^#\s+(.+)$", text, re.M)
    title_zh = title_m.group(1).strip() if title_m else post_id

    meta: dict[str, str] = {}
    for line in text.splitlines():
        m = META_LINE.match(line)
        if m:
            meta[m.group(1).strip()] = m.group(2).strip()

    body_m = re.search(r"##\s*翻譯\s*\n(.*?)(?=\n##\s|\Z)", text, re.S)
    body = body_m.group(1).strip() if body_m else ""

    listed: dict[int, Path] = {}
    photos_m = re.search(r"##\s*照片\s*\n(.*)", text, re.S)
    if photos_m:
        for m in re.finditer(r"^-\s*(\d+)\s*:\s*(.+)$", photos_m.group(1), re.M):
            listed[int(m.group(1))] = Path(m.group(2).strip())

    numbers = discover_photo_numbers(post_id, body, listed)
    photos: dict[int, Path] = {}
    missing: list[int] = []
    for n in numbers:
        found = find_photo(post_id, n, listed.get(n))
        if found:
            photos[n] = found
        else:
            missing.append(n)

    return {
        "id": post_id,
        "title_zh": title_zh,
        "title_jp": meta.get("原文標題", ""),
        "date": meta.get("日期", ""),
        "url": meta.get("網址", ""),
        "body": body,
        "photos": photos,
        "missing": missing,
    }


def date_sort_key(post: dict) -> tuple:
    raw = post["date"].replace("/", ".").replace("-", ".")
    parts = re.findall(r"\d+", raw)
    if len(parts) >= 3:
        return tuple(int(p) for p in parts[:3])
    return (0, 0, 0)


def format_paragraphs(text: str) -> str:
    chunks = re.split(r"\n\s*\n", text.strip())
    out: list[str] = []
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        escaped = html.escape(chunk)
        escaped = URL_RE.sub(
            r'<a href="\1" target="_blank" rel="noopener noreferrer">\1</a>',
            escaped,
        )
        escaped = escaped.replace("\n", "<br>\n")
        out.append(f"<p>{escaped}</p>")
    return "\n".join(out)


def photo_dest_name(post_id: str, n: int, src: Path) -> str:
    ext = src.suffix.lower()
    if ext == ".jpeg":
        ext = ".jpg"
    return f"{post_id}-{n}{ext}"


def render_figure(post_id: str, n: int, src: Path) -> str:
    dest = photo_dest_name(post_id, n, src)
    alt = html.escape(f"部落格照片 {n}")
    return (
        f'<figure class="photo">\n'
        f'  <img src="photos/{html.escape(dest)}" alt="{alt}" loading="lazy">\n'
        f'  <figcaption>照片 {n}</figcaption>\n'
        f"</figure>"
    )


def render_body(post: dict) -> str:
    body = post["body"]
    photos: dict[int, Path] = post["photos"]
    parts: list[str] = []
    used: set[int] = set()
    last = 0
    for m in IMG_PLACEHOLDER.finditer(body):
        before = body[last : m.start()].strip()
        if before:
            parts.append(format_paragraphs(before))
        n = int(m.group(1))
        used.add(n)
        if n in photos:
            parts.append(render_figure(post["id"], n, photos[n]))
        last = m.end()
    rest = body[last:].strip()
    if rest:
        parts.append(format_paragraphs(rest))
    for n in sorted(photos):
        if n not in used:
            parts.append(render_figure(post["id"], n, photos[n]))
    return "\n".join(parts)


def render_index(posts: list[dict]) -> str:
    toc_items = []
    articles = []
    for post in posts:
        pid = html.escape(post["id"])
        title = html.escape(post["title_zh"])
        date = html.escape(post["date"])
        title_jp = html.escape(post["title_jp"])
        toc_items.append(
            f'      <li><a href="#post-{pid}">'
            f'<span class="toc-date">{date}</span>'
            f'<span class="toc-title">{title}</span></a></li>'
        )
        meta_bits = []
        if post["date"]:
            meta_bits.append(f'<span class="date">{date}</span>')
        if post["title_jp"]:
            meta_bits.append(f'<span class="jp">原文：{title_jp}</span>')
        original = ""
        if post["url"]:
            href = html.escape(post["url"], quote=True)
            original = (
                f'<p><a class="original" href="{href}" '
                f'target="_blank" rel="noopener noreferrer">閱讀原文</a></p>'
            )
        articles.append(
            f'    <article class="post" id="post-{pid}">\n'
            f"      <h2>{title}</h2>\n"
            f'      <div class="meta">{"".join(meta_bits)}</div>\n'
            f"      {original}\n"
            f'      <div class="body">\n{render_body(post)}\n      </div>\n'
            f"    </article>"
        )

    generated = datetime.now(ADELAIDE).strftime("%Y-%m-%d %H:%M")
    return f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>塩釜菜那 部落格 中文翻譯</title>
  <meta name="description" content="塩釜菜那在僕青（僕が見たかった青空）部落格的繁體中文翻譯，由新到舊排列。">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body id="top">
  <div class="wrap">
    <header class="site">
      <p class="kicker">僕が見たかった青空</p>
      <h1>塩釜菜那 部落格 中文翻譯</h1>
      <p class="lede">塩釜菜那官方部落格的繁體中文翻譯，最新文章在最上面。</p>
    </header>
    <nav class="toc" aria-label="文章目錄">
      <h2>文章目錄</h2>
      <ol>
{chr(10).join(toc_items)}
      </ol>
    </nav>
{chr(10).join(articles)}
    <footer class="site">
      <p>翻譯存檔，最近更新：{html.escape(generated)}（澳洲阿德萊德時間）</p>
      <a class="to-top" href="#top">回到最上</a>
    </footer>
  </div>
</body>
</html>
"""


def sha1_file(path: Path) -> str:
    h = hashlib.sha1()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def build() -> list[dict]:
    if not TRANSLATIONS.is_dir():
        raise SystemExit(f"Missing translations folder: {TRANSLATIONS}")

    posts = [parse_post(p) for p in sorted(TRANSLATIONS.glob("*.md"))]
    if not posts:
        raise SystemExit(f"No markdown posts in {TRANSLATIONS}")
    posts.sort(key=date_sort_key, reverse=True)

    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)
    photos_out = PUBLIC / "photos"
    photos_out.mkdir(parents=True)

    shutil.copy2(STYLES_SRC, PUBLIC / "styles.css")
    if VERCEL_JSON_SRC.is_file():
        shutil.copy2(VERCEL_JSON_SRC, PUBLIC / "vercel.json")

    copied = 0
    for post in posts:
        for n, src in post["photos"].items():
            dest = photos_out / photo_dest_name(post["id"], n, src)
            shutil.copy2(src, dest)
            copied += 1
        if post["missing"]:
            print(
                f"warning: post {post['id']} missing photos: {post['missing']}",
                flush=True,
            )

    (PUBLIC / "index.html").write_text(render_index(posts), encoding="utf-8")

    files = []
    for path in sorted(PUBLIC.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(PUBLIC).as_posix()
        files.append(
            {
                "file": rel,
                "path": str(path),
                "sha": sha1_file(path),
                "size": path.stat().st_size,
            }
        )
    MANIFEST.write_text(
        json.dumps(
            {
                "project": "shiogama-nana-blog",
                "teamId": "team_MpzOmojkBvxnWwiQW63WOOQH",
                "teamSlug": "kkwok0915-a11ys-projects",
                "publicDir": str(PUBLIC),
                "files": files,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"built {len(posts)} posts, {copied} photos, {len(files)} files -> {PUBLIC}")
    for post in posts:
        print(
            f"  {post['date']}  {post['id']}  {post['title_zh']}  "
            f"({len(post['photos'])} photos)",
            flush=True,
        )
    return posts


if __name__ == "__main__":
    build()
