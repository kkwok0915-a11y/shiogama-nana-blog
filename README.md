# 塩釜菜那 部落格 中文翻譯

Archive of Traditional Chinese translations of 塩釜菜那's Bokuao blog.
Vite + React + TypeScript, system fonts only. No advertising or cookie trackers; optional cookie-free Vercel Web Analytics once enabled in the dashboard.

- Production: https://shiogama-nana-blog.vercel.app (use this `*.vercel.app` domain; team-scoped aliases are SSO-protected)
- Vercel project `shiogama-nana-blog` (`prj_QdKqzkmsYJOO8JpIl8Ci45DrvnCN`), team `team_MpzOmojkBvxnWwiQW63WOOQH`
- Videos for all members live on a separate site: https://bokuao-videos.vercel.app
- Shareable post links use `?p=<id>` (for example https://shiogama-nana-blog.vercel.app/?p=21671). A post shows a NEW badge for 7 days after it is added, and a 已讀 marker is stored only on the visitor's device.
- Two tabs: **動態** (`/`) is one newest-first timeline of blog posts and Instagram posts (by post date, JST), and **相簿** (`/?tab=gallery`) is every photo. Both share a search box, a 全部 / Blog / Instagram segmented filter with counts (`?src=blog|ig`) and, on the far right, a date picker (`?date=YYYY-MM-DD`; shows that day, snapping to the nearest date with content, with ‹ › to step between dates and 全部 to clear). Blog and Instagram cards use the same card geometry and date format, with a small Blog / IG badge. Back from a post returns to the feed with its filter, date and scroll position. Old links keep working: `/?tab=ig` opens 動態 with `src=ig`; `?p=<id>` and `?ig=<code>` open directly.
- Loading: shimmer skeletons shaped like the toolbar, cards, grid and post view; each photo's box is reserved from its width/height and shows a shimmer (or, for full-size photos, the blurred `-sm.webp`) until it fades in. `prefers-reduced-motion` turns the animations off.
- The post view keeps a「閱讀官方原文」link to the official Japanese post.
- Share links (`/?p=<id>`) and the site root include Open Graph / Twitter meta tags (title, Traditional Chinese excerpt, first photo). A server function injects the tags into `index.html` because crawlers do not run JavaScript.
- The 回到頂部 button sits above the iOS Safari bottom toolbar (`safe-area-inset-bottom + 80px`) so the first tap on iPhone activates it.
- An unknown `?p=` id shows a Traditional Chinese not-found page with a button back to the list. If `/api` and the bundled fallback both fail, a retry button is shown. A React error boundary turns a crash into a friendly refresh page instead of a blank screen.
- The page is marked `lang="zh-Hant"`, has a skip link and a `main` landmark, visible focus rings, and respects `prefers-reduced-motion`. Icon buttons have accessible names, photos have alt text, and colour contrast meets WCAG AA. Esc closes the photo viewer and restores focus.
- Cards reserve a 3:4 thumbnail box and a two-line title height so the list does not jump while photos or `/api/posts` load. A matching skeleton is shown only if the bundled list is empty.
- Post photos ship as resized WebP (`N-sm.webp` for cards and the gallery, `N.webp` for the post body) with the original JPEG as a fallback. Images are lazy-loaded. `@vercel/analytics` is included (cookie-free); enable Web Analytics in the Vercel dashboard (Hobby tier, no cost).

## Layout

```
src/data/posts.json          bundled fallback (generated; committed)
src/lib/posts.ts             data layer: fetchPosts() -> GET /api/posts, fallback posts.json on error/4s timeout
src/hooks.ts                 usePosts() paints the bundled list first, then refreshes from /api
src/lib/read.ts              on-device 已讀 markers (localStorage only)
src/App.tsx                  list / post / gallery switch, search, month archive, ?p=<id> links
src/components/              PostCard, PostView, Lightbox, PhotoGallery, SearchBar, MonthNav, BackToTop, ErrorBoundary, StatusPage, Photo, ListSkeleton
public/photos/<id>/N.jpg     original photos (static; body photo blocks point here)
public/photos/<id>/N.webp    resized WebP (and `N-sm.webp`) generated at build time
scripts/optimize-photos.py   Pillow WebP resize (runs from gen-posts / add-post / build)
public/manifest.webmanifest  PWA manifest (standalone; no service worker)
public/icon-*.png            192, 512, maskable, and apple-touch-icon
scripts/posts-lib.mjs        md parser, photo copy, image size, fallback writer, upsert SQL builder
scripts/gen-posts.mjs        all posts -> photos + posts.json + supabase/seed.sql (runs in `npm run build`)
scripts/add-post.mjs         one post -> photos + posts.json + supabase/upserts/<id>.sql (printed)
scripts/pack-output.mjs      Build Output API v3 pack of dist/ + /api functions; writes deploy-manifest.json
scripts/smoke.mjs            headless Chrome test (+ screenshots)
api/                         server handlers for GET /api/posts, GET /api/settings, and HTML link previews (no keys in the browser)
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

The browser never talks to Supabase. A Vercel Function `GET /api/posts` (and `GET /api/posts?id=<id>`) reads
`public.blog_posts` on the server using `SUPABASE_URL` and `SUPABASE_KEY` (publishable key, RLS read-only)
set on the Vercel project (and in local gitignored `.env.local` for `npm run preview`). `GET /api/settings`
reads `public.site_settings` (the upgrade notice) with `Cache-Control: no-store`, so a change shows up
the next time the page is loaded. If the API fails, the site falls back to the bundled posts.json.

The upgrade notice is toggled in the Table Editor, no redeploy needed:
https://supabase.com/dashboard/project/jqsyymshdlrghyqtbcmp/editor/17677?schema=public
Edit `notice_enabled` (true/false) and/or `notice_text` on the single row (`id = 1`) and save. The banner
updates on the next page load.

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

Deploys use the Build Output API v3 (static files + `/api` functions). Always include the packed functions,
even when only photos changed, or the new deployment will have no `/api` routes.

```bash
cd /workspace/blog-site
npm run build && npm run pack   # dist/ then .vercel/output/ + deploy-manifest.json + upload-payloads/*.b64
```

Do not put `VITE_SUPABASE_*` in `.env.local` when building — those would be baked into the JS bundle.
Local `.env.local` should only have `SUPABASE_URL` and `SUPABASE_KEY` (server-side, same values as the
Vercel project env). Never commit `.env` files.
On the Vercel project, set only `SUPABASE_URL` and `SUPABASE_KEY`. Mark `SUPABASE_KEY` as Sensitive
(the URL can stay as a normal encrypted variable). Do not set `VITE_SUPABASE_*` in production, preview,
or development — a later Git-based deploy would bake them into the public JS.

For each file in `deploy-manifest.json`: `upload_file` (`teamId=team_MpzOmojkBvxnWwiQW63WOOQH`,
`contentLength`=size, `xVercelDigest`=sha, `requestBody`=`$file:<b64 path>`). Upload only new hashes if
previous SHAs are already on Vercel, but still list every file in `create_deployment`.

Then `create_deployment` with `teamId`, `skipAutoDetectionConfirmation=1`, `forceNew=1`,
`requestBody.name=shiogama-nana-blog`, `requestBody.project=prj_QdKqzkmsYJOO8JpIl8Ci45DrvnCN`,
`requestBody.target=production`, `requestBody.projectSettings.framework=null`,
`requestBody.files=[{file,sha,size}]` where `file` paths start with `.vercel/output/`
(for example `.vercel/output/config.json`, `.vercel/output/static/index.html`,
`.vercel/output/functions/api/posts.func/index.js`).

Confirm https://shiogama-nana-blog.vercel.app/api/posts and `/api/settings` return JSON, and that
the live JS assets contain neither `supabase.co` nor `sb_publishable`. With a crawler User-Agent
(`facebookexternalhit` or `Twitterbot`) and with a normal browser UA, `/?p=<id>` HTML should include
`og:title`, `og:description` (a short Traditional Chinese excerpt), `og:image` (the first photo) and
`og:url` for that post; the root URL should include the site-wide tags.

## Instagram archive

Instagram posts appear in the 動態 feed (`/?src=ig` for Instagram only; the old `/?tab=ig` redirects there);
`/?ig=<shortcode>` opens one post (carousel, byte-exact caption, date in JST, link to the original post).
The source filter is hidden while the archive is empty.

The 相簿 tab (`/?tab=gallery`) mixes blog photos and every archived Instagram photo slide, newest first by post date
(JST for Instagram; blog first on the same day), with a 全部 / Blog / Instagram filter kept in the URL
(`&src=blog` or `&src=ig`), plus the same date picker (`&date=YYYY-MM-DD`). Instagram tiles carry an `IG` badge in the 全部 view; in the photo viewer they offer
查看貼文 (opens `/?ig=<code>`) and an `Instagram ↗` permalink. Blog photos keep 查看文章.

- Table `public.instagram_posts` (migration `20261126000000_create_instagram_posts.sql`, same RLS as `blog_posts`):
  `code text pk`, `taken_at timestamptz`, `caption`, `permalink`, `slides jsonb`
  (`{type:'photo',src,width,height}` | `{type:'video',src:null}`; a photo slide that could not be archived is
  `{type:'photo',src:null}` and the site shows a "not archived" card linking to Instagram), `photo_count`, `added_at`, `published`.
- API (JSON, for the web and later iOS): `GET /api/instagram` (array, newest first) and `GET /api/instagram?code=<shortcode>` (one object, 404 if missing).
- Photos are static files at `public/photos/ig/<code>/<n>.jpg` (+ `n.webp`, `n-sm.webp`), `n` = 1-based slide position.
  Instagram CDN URLs are signed and expire, so they are never stored in the repo, the database, or the API.
- Bundled fallback: `src/data/instagram.json`.

### Adding a batch (or a nightly new post)

```bash
# batch JSON: [{code, taken_at, caption, slides:[{type:"image"|"video", url?}]}] (url = signed CDN url, used once)
node /workspace/ig-archive/ingest.mjs /workspace/ig-archive/batches/batchN.json
# == node scripts/ig-ingest.mjs <batch.json> --photos /workspace/ig-archive/photos
```

It downloads any missing photo with a plain GET into `/workspace/ig-archive/photos/<code>/<n>.jpg`, copies it into
`public/photos/ig/`, makes WebP, merges `src/data/instagram.json`, and prints an idempotent upsert (also saved to
`supabase/upserts/ig-batchN.sql`). Run the SQL with the Supabase connector on `jqsyymshdlrghyqtbcmp`, then redeploy
(`npm run build && npm run pack`, which now packs the `instagram` function) and commit.

Before ingesting, check the batch for the same CDN image appearing in more than one post (a scrape can pick up a
stale carousel image); `md5sum /workspace/ig-archive/photos/*/*.jpg | sort | uniq -w32 -d` finds byte-identical photos.
