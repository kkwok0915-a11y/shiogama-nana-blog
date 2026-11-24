// Regenerate public/photos/<id>/N.jpg and src/data/posts.json from every translation .md.
// Writes supabase/seed.sql (full upsert). If the translations folder is missing
// (e.g. a fresh clone elsewhere), keeps the committed posts.json and exits 0.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, TRANSLATIONS, allIds, copyPhotos, parsePost, upsertSql, writeFallback } from "./posts-lib.mjs";

const ids = allIds();
if (!ids.length) {
  console.log(`gen-posts: no posts in ${TRANSLATIONS}; keeping committed src/data/posts.json`);
  process.exit(0);
}
const rows = [];
for (const id of ids) {
  const { row, photos, missing } = parsePost(id);
  copyPhotos(id, photos);
  if (missing.length) console.warn(`warning: ${id} missing photos ${missing.join(",")}`);
  rows.push(row);
}
const posts = writeFallback(rows);
writeFileSync(join(ROOT, "supabase", "seed.sql"), upsertSql(posts));
console.log(`gen-posts: ${posts.length} posts -> src/data/posts.json, supabase/seed.sql`);
for (const p of posts) console.log(`  ${p.post_date}  ${p.id}  ${p.title_zh}  (${p.photo_count} photos)`);
