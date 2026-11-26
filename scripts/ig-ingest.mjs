// Idempotent Instagram archive ingest.
// Usage: node scripts/ig-ingest.mjs <batch.json> [--photos <dir>] [--no-download]
//
// batch.json: [{ code, taken_at, caption, slides: [{ type: "image"|"photo"|"video", url? }] }]
// Photos are read from <dir>/<code>/<n>.jpg (n = 1-based slide position). A missing photo is
// downloaded once from its slide url with a plain GET (no cookies). The signed Instagram CDN url
// is never written anywhere public: only our copy at /photos/ig/<code>/<n>.jpg is referenced.
//
// Writes public/photos/ig/<code>/<n>.jpg (+ WebP via optimize-photos.py), merges
// src/data/instagram.json (bundled fallback), and prints an idempotent upsert for
// public.instagram_posts (also saved to supabase/upserts/ig-<batch>.sql) to run with the
// Supabase connector on project jqsyymshdlrghyqtbcmp.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { imageSize } from "./posts-lib.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const FALLBACK = join(ROOT, "src", "data", "instagram.json");
const PUBLIC_IG = join(ROOT, "public", "photos", "ig");
const CODE_RE = /^[A-Za-z0-9_-]{5,40}$/;

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const noDownload = args.includes("--no-download");
const photosDir = flag("--photos") ?? "/workspace/ig-archive/photos";
const batchPath = args.find((a) => !a.startsWith("--"));
if (!batchPath) {
  console.error("usage: node scripts/ig-ingest.mjs <batch.json> [--photos <dir>] [--no-download]");
  process.exit(1);
}

function toIso(v) {
  if (typeof v === "number" || /^\d+$/.test(String(v))) {
    const n = Number(v);
    return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  }
  const t = Date.parse(String(v));
  if (Number.isNaN(t)) throw new Error(`bad taken_at: ${v}`);
  return new Date(t).toISOString();
}

function download(url, dest) {
  const r = spawnSync("curl", ["-fsSL", "--retry", "2", "--max-time", "60", "-A", "Mozilla/5.0", "-o", dest, url], { stdio: ["ignore", "ignore", "pipe"] });
  if (r.status !== 0) {
    try { if (existsSync(dest) && statSync(dest).size === 0) spawnSync("rm", ["-f", dest]); } catch {}
    return r.stderr?.toString().trim() || `curl exit ${r.status}`;
  }
  const buf = readFileSync(dest);
  if (!(buf[0] === 0xff && buf[1] === 0xd8) && !(buf[0] === 0x89 && buf[1] === 0x50) && buf.toString("ascii", 8, 12) !== "WEBP") {
    spawnSync("rm", ["-f", dest]);
    return "not an image";
  }
  return null;
}

/** Dollar-quote a value with a tag that cannot appear inside it. */
function dq(v) {
  if (v === null || v === undefined) return "null";
  const s = String(v);
  let tag = "q";
  while (s.includes(`$${tag}$`)) tag += "q";
  return `$${tag}$${s}$${tag}$`;
}

const batch = JSON.parse(readFileSync(batchPath, "utf8"));
if (!Array.isArray(batch)) throw new Error("batch must be a JSON array");

const rows = [];
const problems = [];
for (const post of batch) {
  const code = String(post.code ?? "");
  if (!CODE_RE.test(code)) {
    problems.push(`skip: bad code ${JSON.stringify(post.code)}`);
    continue;
  }
  const slides = [];
  (post.slides ?? []).forEach((s, i) => {
    const n = i + 1;
    const type = s?.type === "video" ? "video" : "photo";
    if (type === "video") {
      slides.push({ type: "video", src: null });
      return;
    }
    const srcFile = join(photosDir, code, `${n}.jpg`);
    if (!existsSync(srcFile)) {
      mkdirSync(join(photosDir, code), { recursive: true });
      const err = !s?.url ? "no url" : noDownload ? "download disabled" : download(s.url, srcFile);
      if (err) {
        problems.push(`${code} slide ${n}: photo missing (${err})`);
        slides.push({ type: "photo", src: null, width: null, height: null });
        return;
      }
    }
    const destDir = join(PUBLIC_IG, code);
    mkdirSync(destDir, { recursive: true });
    copyFileSync(srcFile, join(destDir, `${n}.jpg`));
    const { width, height } = imageSize(readFileSync(srcFile));
    slides.push({ type: "photo", src: `/photos/ig/${code}/${n}.jpg`, width, height });
  });
  rows.push({
    code,
    taken_at: toIso(post.taken_at),
    caption: typeof post.caption === "string" ? post.caption : "",
    permalink: `https://www.instagram.com/p/${code}/`,
    slides,
    photo_count: slides.filter((s) => s.type === "photo" && s.src).length,
  });
}

// Bundled fallback (keeps added_at of rows already there).
const prev = existsSync(FALLBACK) ? JSON.parse(readFileSync(FALLBACK, "utf8")).posts ?? [] : [];
const byCode = new Map(prev.map((p) => [p.code, p]));
const now = new Date().toISOString();
for (const r of rows) byCode.set(r.code, { ...r, added_at: byCode.get(r.code)?.added_at ?? now });
const posts = [...byCode.values()].sort((a, b) => b.taken_at.localeCompare(a.taken_at));
mkdirSync(join(ROOT, "src", "data"), { recursive: true });
writeFileSync(FALLBACK, JSON.stringify({ posts }, null, 2) + "\n");

// WebP companions (same optimizer as the blog photos; skips files already done).
spawnSync("python3", [join(ROOT, "scripts", "optimize-photos.py")], { stdio: "inherit" });

const sql = rows.length
  ? `insert into public.instagram_posts (code, taken_at, caption, permalink, slides, photo_count, published)
values
${rows.map((r) => `  (${dq(r.code)}, ${dq(r.taken_at)}::timestamptz, ${dq(r.caption)}, ${dq(r.permalink)}, ${dq(JSON.stringify(r.slides))}::jsonb, ${r.photo_count}, true)`).join(",\n")}
on conflict (code) do update set
  taken_at = excluded.taken_at,
  caption = excluded.caption,
  permalink = excluded.permalink,
  slides = excluded.slides,
  photo_count = excluded.photo_count,
  published = excluded.published;
`
  : "-- nothing to upsert\n";
const upserts = join(ROOT, "supabase", "upserts");
mkdirSync(upserts, { recursive: true });
const sqlPath = join(upserts, `ig-${basename(batchPath).replace(/\.json$/, "")}.sql`);
writeFileSync(sqlPath, sql);

console.log(`ig-ingest: ${rows.length} posts, ${rows.reduce((n, r) => n + r.photo_count, 0)} photos; fallback has ${posts.length} posts`);
for (const p of problems) console.log(`WARN ${p}`);
console.log(`SQL saved to ${sqlPath}`);
console.log("-----BEGIN SQL-----");
process.stdout.write(sql);
console.log("-----END SQL-----");
