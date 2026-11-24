// Shared helpers: parse a translation .md into a blog_posts row, copy its photos,
// regenerate the bundled fallback JSON, and build the Supabase upsert SQL.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const ROOT = new URL("..", import.meta.url).pathname;
export const WATCH = process.env.BLOG_WATCH_DIR ?? "/workspace/blog-watch";
export const TRANSLATIONS = join(WATCH, "translations");
export const PHOTOS = join(WATCH, "photos");
export const PUBLIC_PHOTOS = join(ROOT, "public", "photos");
export const FALLBACK = join(ROOT, "src", "data", "posts.json");

const IMG = /［圖片\s*(\d+)］/g;
const EXTS = [".jpg", ".jpeg", ".png", ".webp", ".JPG", ".JPEG", ".PNG"];

/** Width/height from a JPEG/PNG/WebP header (no dependencies). */
export function imageSize(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const fmt = buf.toString("ascii", 12, 16);
    if (fmt === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (fmt === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (fmt === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return { width: null, height: null };
}

function findPhoto(id, n, listed) {
  const cands = [];
  if (listed) cands.push(listed);
  for (const e of EXTS) cands.push(join(PHOTOS, id, `${n}${e}`), join(WATCH, `shiogama-nana-${id}-${n}${e}`), join(WATCH, `${id}-${n}${e}`));
  return cands.find((p) => existsSync(p)) ?? null;
}

const dateIso = (s) => {
  const p = (s ?? "").match(/\d+/g);
  return p && p.length >= 3 ? `${p[0]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}` : null;
};

/** Parse translations/<id>.md -> { row, photos: [{n, src}] , missing }. */
export function parsePost(id) {
  const path = join(TRANSLATIONS, `${id}.md`);
  if (!existsSync(path)) throw new Error(`missing ${path}`);
  const text = readFileSync(path, "utf8");
  const title_zh = (text.match(/^#\s+(.+)$/m)?.[1] ?? id).trim();
  const meta = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^-\s*([^:：]+)\s*[:：]\s*(.*)$/);
    if (m) meta[m[1].trim()] = m[2].trim();
  }
  const body = (text.match(/##\s*翻譯\s*\n([\s\S]*?)(?=\n##\s|$)/)?.[1] ?? "").trim();
  const listed = {};
  const photoSec = text.match(/##\s*照片\s*\n([\s\S]*)/)?.[1] ?? "";
  for (const m of photoSec.matchAll(/^-\s*(\d+)\s*:\s*(.+)$/gm)) listed[+m[1]] = m[2].trim();

  const nums = new Set(Object.keys(listed).map(Number));
  for (const m of body.matchAll(IMG)) nums.add(+m[1]);
  const dir = join(PHOTOS, id);
  if (existsSync(dir)) for (const f of readdirSync(dir)) { const m = f.match(/^(\d+)\.(jpe?g|png|webp)$/i); if (m) nums.add(+m[1]); }

  const photos = new Map();
  const missing = [];
  for (const n of [...nums].sort((a, b) => a - b)) {
    const src = findPhoto(id, n, listed[n]);
    if (!src) { missing.push(n); continue; }
    const ext = src.toLowerCase().endsWith(".png") ? ".png" : src.toLowerCase().endsWith(".webp") ? ".webp" : ".jpg";
    photos.set(n, { n, src, file: `${n}${ext}`, ...imageSize(readFileSync(src)) });
  }

  const blocks = [];
  const pushText = (t) => { t = t.trim(); if (t) blocks.push({ type: "text", text: t }); };
  const photoBlock = (p) => ({ type: "photo", src: `/photos/${id}/${p.file}`, alt: `部落格照片 ${p.n}`, width: p.width, height: p.height });
  const used = new Set();
  let last = 0;
  for (const m of body.matchAll(IMG)) {
    pushText(body.slice(last, m.index));
    const p = photos.get(+m[1]);
    if (p) { blocks.push(photoBlock(p)); used.add(p.n); }
    last = m.index + m[0].length;
  }
  pushText(body.slice(last));
  for (const p of photos.values()) if (!used.has(p.n)) blocks.push(photoBlock(p));

  const row = {
    id,
    title_zh,
    title_jp: meta["原文標題"] || null,
    post_date: dateIso(meta["日期"]),
    original_url: meta["網址"] || null,
    body: blocks,
    photo_count: photos.size,
    published: true,
  };
  return { row, photos: [...photos.values()], missing };
}

export function copyPhotos(id, photos) {
  const out = join(PUBLIC_PHOTOS, id);
  mkdirSync(out, { recursive: true });
  for (const p of photos) copyFileSync(p.src, join(out, p.file));
}

export const allIds = () =>
  existsSync(TRANSLATIONS) ? readdirSync(TRANSLATIONS).filter((f) => /^\d+\.md$/.test(f)).map((f) => f.slice(0, -3)) : [];

/** Rewrite src/data/posts.json (bundled fallback), keeping existing added_at values. */
export function writeFallback(rows) {
  let prev = {};
  if (existsSync(FALLBACK)) for (const p of JSON.parse(readFileSync(FALLBACK, "utf8")).posts ?? []) prev[p.id] = p;
  const now = new Date().toISOString();
  const posts = rows
    .map((r) => ({ ...r, added_at: prev[r.id]?.added_at ?? now }))
    .sort((a, b) => (b.post_date ?? "").localeCompare(a.post_date ?? "") || b.id.localeCompare(a.id));
  mkdirSync(join(ROOT, "src", "data"), { recursive: true });
  writeFileSync(FALLBACK, JSON.stringify({ generated_at: now, posts }, null, 2) + "\n");
  return posts;
}

/** Dollar-quote a value with a tag that cannot appear inside it. */
function dq(v) {
  if (v === null || v === undefined) return "null";
  const s = String(v);
  let tag = "q";
  while (s.includes(`$${tag}$`)) tag += "q";
  return `$${tag}$${s}$${tag}$`;
}

/** Idempotent upsert for public.blog_posts (keeps added_at of an existing row). */
export function upsertSql(rows) {
  const values = rows
    .map((r) => `  (${dq(r.id)}, ${dq(r.title_zh)}, ${dq(r.title_jp)}, ${r.post_date ? dq(r.post_date) + "::date" : "null"}, ${dq(r.original_url)}, ${dq(JSON.stringify(r.body))}::jsonb, ${r.photo_count}, ${r.published ? "true" : "false"})`)
    .join(",\n");
  return `insert into public.blog_posts (id, title_zh, title_jp, post_date, original_url, body, photo_count, published)
values
${values}
on conflict (id) do update set
  title_zh = excluded.title_zh,
  title_jp = excluded.title_jp,
  post_date = excluded.post_date,
  original_url = excluded.original_url,
  body = excluded.body,
  photo_count = excluded.photo_count,
  published = excluded.published;
`;
}
