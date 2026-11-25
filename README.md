# 塩釜菜那 部落格 中文翻譯

Archive of Traditional Chinese translations of 塩釜菜那's Bokuao blog.
Vite + React + TypeScript, no trackers, system fonts only.

- Production: https://shiogama-nana-blog.vercel.app (use this `*.vercel.app` domain; team-scoped aliases are SSO-protected)
- Vercel project `shiogama-nana-blog` (`prj_QdKqzkmsYJOO8JpIl8Ci45DrvnCN`), team `team_MpzOmojkBvxnWwiQW63WOOQH`
- Videos for all members live on a separate site: https://bokuao-videos.vercel.app
- Shareable post links use `?p=<id>` (for example https://shiogama-nana-blog.vercel.app/?p=21671). A post shows a NEW badge for 7 days after it is added, and a 已讀 marker is stored only on the visitor's device.

## Layout

```
src/data/posts.json          bundled fallback (generated; committed)
src/lib/posts.ts             data layer: fetchPosts() -> Supabase public.blog_posts, fallback posts.json on error/4s timeout
src/hooks.ts                 usePosts()
src/lib/read.ts              on-device 已讀 markers (localStorage only)
src/App.tsx                  list / post view switch, search, ?p=<id> links
src/components/              PostCard, PostView, Lightbox (swipe + keys), SearchBar, BackToTop (回到頂部)
public/photos/<id>/N.jpg     photos (static; body photo blocks point here)
public/manifest.webmanifest  PWA manifest (standalone; no service worker)
public/icon-*.png            192, 512, maskable, and apple-touch-icon
scripts/posts-lib.mjs        md parser, photo copy, image size, fallback writer, upsert SQL builder
scripts/gen-posts.mjs        all posts -> photos + posts.json + supabase/seed.sql (runs in `npm run build`)
scripts/add-post.mjs         one post -> photos + posts.json + supabase/upserts/<id>.sql (printed)
scripts/manifest.mjs         sha1/size manifest + base64 payloads of dist/ for MCP deploys
scripts/smoke.mjs            headless Chrome test (+ screenshots)
supabase/migrations/         schema + RLS
```

`dist/` is build output only (it can be wiped on the box); never keep anything there.

Sources: `/workspace/blog-watch/translations/<id>.md` and `/workspace/blog-watch/photos/<id>/N.jpg`
(also `shiogama-nana-<id>-N.jpg` in `/workspace/blog-watch/`).

## Supabase

Project `shiogama-nana-blog` (ref `jqsyymshdlrghyqtbcmp`, ap-southeast-2, free plan), API `https://jqsyymshdlrghyqtbcmp.supabase.co`.
Separate from the `bokuao-videos` project.

Table `public.blog_posts`: `id text pk`, `title_zh`, `title_jp`, `post_date date`, `original_url text unique`,
`body jsonb` (ordered blocks `{type:'text',text}` / `{type:'photo',src,alt,width,height}`), `photo_count int`,
`added_at timestamptz default now()`, `published bool default true`.
RLS on; `anon`/`authenticated` may only `select` rows where `published`; no client writes. Writes go through the
Supabase connector's `execute_sql` (service role on the server side), never a key in this repo.

Build-time env (Vercel project env + local `.env.local`, gitignored): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
(publishable key only). Without them the site uses the bundled posts.json.

## Adding a post (nightly)

```bash
cd /workspace/blog-site
npm run add-post -- <id>        # photos -> public/photos/<id>/, regenerates posts.json, prints upsert SQL
```

1. Run the SQL printed between `-----BEGIN SQL-----` / `-----END SQL-----` (also saved at `supabase/upserts/<id>.sql`)
   with the Supabase connector `execute_sql` on project `jqsyymshdlrghyqtbcmp` (never the bokuao-videos project). It is an idempotent upsert on `id`.
2. Text-only post: done (the site reads Supabase at runtime). Post with photos: redeploy (below) so the images exist.
3. `git add -A && git commit -m "Add post <id>" && git push`.

## Deploy (user-Vercel MCP; no CLI token)

```bash
npm run build && npm run manifest   # dist/ (+ static vercel.json for headers) + deploy-manifest.json + upload-payloads/*.b64
```

For each manifest file: `upload_file` (`teamId`, `contentLength`=size, `xVercelDigest`=sha, `requestBody`=`$file:<b64>`),
then `create_deployment` with `teamId`, `skipAutoDetectionConfirmation=1`, `requestBody.name=shiogama-nana-blog`,
`requestBody.target=production`, `requestBody.projectSettings.framework=null`, `requestBody.files=[{file,sha,size}]`.
The Supabase env vars are baked in at build time on the box, so set them in `.env.local` before `npm run build`.
