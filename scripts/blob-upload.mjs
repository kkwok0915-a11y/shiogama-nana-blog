// Upload local photos to the public Vercel Blob store, keeping their paths.
//   public/photos/21671/1.webp      ->  photos/21671/1.webp
//   public/photos/ig/<code>/2.jpg   ->  photos/ig/<code>/2.jpg
//
// Usage: node scripts/blob-upload.mjs [--dir public/photos] [--dry-run] [--force] [--webp-only] [--if-configured]
//
// Safe to re-run: files already in the store with the same size are skipped (--force uploads them anyway).
// Needs BLOB_READ_WRITE_TOKEN in the shell or in .env.local (gitignored). Never commit the token.
// --dry-run needs no token and no network: it only counts what would be uploaded.
// --if-configured exits quietly (code 0) when there is no token, so add-post / ig-ingest keep working
// before the migration is finished.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const dirIdx = args.indexOf("--dir");
const DIR = resolve(ROOT, dirIdx >= 0 ? args[dirIdx + 1] : "public/photos");
const DRY = has("--dry-run");
const FORCE = has("--force");
const WEBP_ONLY = has("--webp-only");
const IF_CONFIGURED = has("--if-configured");
const CONCURRENCY = 6;
const ONE_YEAR = 60 * 60 * 24 * 365;
const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

if (!process.env.BLOB_READ_WRITE_TOKEN && existsSync(join(ROOT, ".env.local"))) {
  try {
    process.loadEnvFile(join(ROOT, ".env.local"));
  } catch {
    /* unreadable .env.local: treated as no token below */
  }
}
const token = process.env.BLOB_READ_WRITE_TOKEN;

if (!DRY && !token) {
  const msg = "blob-upload: no BLOB_READ_WRITE_TOKEN (shell or .env.local).";
  if (IF_CONFIGURED) {
    console.log(`${msg} Skipped; photos stay local.`);
    process.exit(0);
  }
  console.error(`${msg} Create a read-write token for the store in the Vercel dashboard and put it in .env.local.`);
  process.exit(1);
}
if (!existsSync(DIR)) {
  console.log(`blob-upload: ${DIR} does not exist; nothing to do.`);
  process.exit(0);
}

const walk = (d) =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

// Pathname inside the store always starts with photos/ and uses forward slashes.
const toPathname = (file) => {
  const rel = relative(DIR, file).split(sep).join("/");
  return `photos/${rel}`;
};

const files = walk(DIR)
  .filter((f) => TYPES[extname(f).toLowerCase()])
  .filter((f) => !(WEBP_ONLY && extname(f).toLowerCase() !== ".webp"))
  .map((file) => ({ file, pathname: toPathname(file), size: statSync(file).size }))
  .sort((a, b) => a.pathname.localeCompare(b.pathname));

const mb = (n) => (n / 1048576).toFixed(1);
const byExt = {};
for (const f of files) {
  const e = extname(f.file).toLowerCase();
  byExt[e] ??= { n: 0, bytes: 0 };
  byExt[e].n++;
  byExt[e].bytes += f.size;
}
const total = files.reduce((n, f) => n + f.size, 0);
console.log(`blob-upload: ${files.length} files, ${mb(total)} MB under ${relative(ROOT, DIR) || "."}`);
for (const [e, v] of Object.entries(byExt)) console.log(`  ${e}: ${v.n} files, ${mb(v.bytes)} MB`);

if (DRY) {
  console.log("dry run: nothing uploaded.");
  process.exit(0);
}

const { put, list } = await import("@vercel/blob").catch(() => {
  console.error("blob-upload: @vercel/blob is not installed. Run: npm install --save-dev @vercel/blob");
  process.exit(1);
});

// What is already in the store (pathname -> size).
const existing = new Map();
let cursor;
do {
  const page = await list({ prefix: "photos/", limit: 1000, cursor, token });
  for (const b of page.blobs) existing.set(b.pathname, b.size);
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);
console.log(`store already has ${existing.size} files under photos/`);

const todo = files.filter((f) => FORCE || existing.get(f.pathname) !== f.size);
console.log(`${files.length - todo.length} unchanged (skipped), ${todo.length} to upload (${mb(todo.reduce((n, f) => n + f.size, 0))} MB)`);

let done = 0;
let origin = null;
const failed = [];
async function upload(f) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await put(f.pathname, readFileSync(f.file), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: ONE_YEAR,
        contentType: TYPES[extname(f.file).toLowerCase()],
        token,
      });
      origin ??= new URL(res.url).origin;
      done++;
      if (done % 25 === 0 || done === todo.length) console.log(`  uploaded ${done}/${todo.length}`);
      return;
    } catch (err) {
      if (attempt === 3) failed.push(`${f.pathname}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

const queue = [...todo];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await upload(queue.shift());
  }),
);

if (origin) console.log(`\nStore public origin: ${origin}\nSet PHOTOS_BASE_URL=${origin} when running \`npm run pack\`.`);
if (failed.length) {
  console.error(`\n${failed.length} upload(s) failed:`);
  for (const line of failed) console.error(`  ${line}`);
  process.exit(1);
}
console.log("blob-upload: done.");
