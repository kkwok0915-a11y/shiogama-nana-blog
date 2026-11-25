# 塩釜菜那 部落格 中文翻譯

Archive of Traditional Chinese translations of 塩釜菜那's Bokuao blog.
Vite + React + TypeScript, system fonts only. No advertising or cookie trackers; optional cookie-free Vercel Web Analytics once enabled in the dashboard.

- Production: https://shiogama-nana-blog.vercel.app (use this `*.vercel.app` domain; team-scoped aliases are SSO-protected)
- Vercel project `shiogama-nana-blog` (`prj_QdKqzkmsYJOO8JpIl8Ci45DrvnCN`), team `team_MpzOmojkBvxnWwiQW63WOOQH`
- Videos for all members live on a separate site: https://bokuao-videos.vercel.app
- Shareable post links use `?p=<id>` (for example https://shiogama-nana-blog.vercel.app/?p=21671). A post shows a NEW badge for 7 days after it is added, and a 已讀 marker is stored only on the visitor's device.
- The list has a search box (title, translated body, and Japanese title; with a clear button), a month jump list (`2026年11月 (n)`), and a 相簿 grid of every post photo (tap opens the existing photo viewer, with a link back to the post).
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
