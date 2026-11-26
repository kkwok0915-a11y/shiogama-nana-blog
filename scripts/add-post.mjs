// Add (or update) one post:  npm run add-post -- <id>
// 1. parses /workspace/blog-watch/translations/<id>.md (+ photos/<id>/N.jpg)
// 2. copies photos to public/photos/<id>/
// 3. regenerates the bundled fallback src/data/posts.json (all posts)
// 4. writes supabase/upserts/<id>.sql and prints it between markers, for the
//    Supabase connector's execute_sql on project shiogama-nana-blog.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, allIds, copyPhotos, parsePost, upsertSql, writeFallback } from "./posts-lib.mjs";

const id = process.argv[2];
if (!id || !/^\d+$/.test(id)) {
  console.error("usage: npm run add-post -- <numeric post id>");
  process.exit(2);
}
const target = parsePost(id);
copyPhotos(id, target.photos);
const rows = allIds().map((x) => (x === id ? target.row : parsePost(x).row));
writeFallback(rows);
const sql = upsertSql([target.row]);
const dir = join(ROOT, "supabase", "upserts");
mkdirSync(dir, { recursive: true });
const file = join(dir, `${id}.sql`);
writeFileSync(file, sql);
if (target.missing.length) console.warn(`warning: missing photos ${target.missing.join(",")}`);
console.log(`post ${id}: "${target.row.title_zh}" ${target.row.post_date}, ${target.row.photo_count} photos`);
console.log(`photos -> public/photos/${id}/   fallback -> src/data/posts.json   sql -> ${file}`);
console.log(target.row.photo_count ? "NEW PHOTOS: uploaded to Blob below when a token is set (no redeploy); otherwise redeploy for images to load." : "Text-only: no redeploy needed once the SQL runs.");
console.log("-----BEGIN SQL-----");
process.stdout.write(sql);
console.log("-----END SQL-----");

const here = dirname(fileURLToPath(import.meta.url));
spawnSync("python3", [join(here, "optimize-photos.py")], { stdio: "inherit" });
// Send new/changed photos to the Vercel Blob store (skipped quietly when no BLOB_READ_WRITE_TOKEN is set).
spawnSync("node", [join(here, "blob-upload.mjs"), "--if-configured"], { stdio: "inherit" });
