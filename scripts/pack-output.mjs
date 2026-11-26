// Pack dist/ + /api functions into .vercel/output (Build Output API v3),
// then write deploy-manifest.json + upload-payloads for MCP deploys.
// Usage: node scripts/pack-output.mjs <fn> [<fn>...]
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fns = process.argv.slice(2).filter((a) => !a.startsWith("-"));
if (!fns.length) {
  console.error("usage: node scripts/pack-output.mjs <fn> [<fn>...]");
  process.exit(1);
}

const SHARED = String.raw`
async function supabaseSelect(env, table, { select, query = {}, order } = {}) {
  const base = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.SUPABASE_KEY;
  if (!base || !key) {
    const err = new Error("missing_supabase_env");
    err.status = 500;
    throw err;
  }
  const url = new URL(base + "/rest/v1/" + table);
  url.searchParams.set("select", select);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  if (order) url.searchParams.set("order", order);
  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const err = new Error("supabase " + res.status);
    err.status = 502;
    throw err;
  }
  return res.json();
}
function json(status, body, cache) {
  const value = cache || "no-store";
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": value,
  };
  if (value === "no-store") {
    headers["CDN-Cache-Control"] = "no-store";
    headers["Vercel-CDN-Cache-Control"] = "no-store";
  }
  return { status, headers, body: JSON.stringify(body) };
}
function fail(err) {
  return json(err.status || 502, { error: "unavailable" }, "no-store");
}
function nodeHandler(handle) {
  return async (req, res) => {
    try {
      if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.statusCode = 405;
        res.setHeader("Allow", "GET, HEAD, OPTIONS");
        res.end();
        return;
      }
      const host = req.headers.host || "localhost";
      const url = new URL(req.url, "https://" + host);
      const result = await handle(process.env, url);
      res.statusCode = result.status;
      for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
      if (req.method === "HEAD") res.end();
      else res.end(result.body);
    } catch {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({ error: "unavailable" }));
    }
  };
}
`;

const HANDLERS = {
  settings: `
const SETTINGS_CACHE = "no-store";
async function handleSettings(env) {
  try {
    const rows = await supabaseSelect(env, "site_settings", {
      select: "notice_enabled,notice_text",
      query: { id: "eq.1" },
    });
    const row = rows[0] || {};
    return json(200, {
      notice_enabled: Boolean(row.notice_enabled),
      notice_text: typeof row.notice_text === "string" ? row.notice_text : "",
    }, SETTINGS_CACHE);
  } catch (err) { return fail(err); }
}
module.exports = nodeHandler(handleSettings);
`,
  videos: `
const LIST_CACHE = "public, s-maxage=300, stale-while-revalidate=600";
const SELECT = "id,member,title_zh,title_jp,description_zh,youtube_url,youtube_date,drive_id,added_at,published";
async function handleVideos(env) {
  try {
    const rows = await supabaseSelect(env, "videos", {
      select: SELECT,
      query: { published: "eq.true" },
      order: "added_at.desc",
    });
    return json(200, rows, LIST_CACHE);
  } catch (err) { return fail(err); }
}
module.exports = nodeHandler(handleVideos);
`,
  posts: `
const LIST_CACHE = "public, s-maxage=300, stale-while-revalidate=600";
const SELECT = "id,title_zh,title_jp,post_date,original_url,body,photo_count,added_at,published";
const ID_RE = /^[\\w.-]+$/;
async function handlePosts(env, requestUrl) {
  try {
    const id = requestUrl && requestUrl.searchParams.get("id");
    if (id && !ID_RE.test(id)) return json(400, { error: "bad_id" }, "no-store");
    const query = { published: "eq.true" };
    if (id) query.id = "eq." + id;
    const rows = await supabaseSelect(env, "blog_posts", {
      select: SELECT,
      query,
      order: "post_date.desc",
    });
    if (id && rows.length === 0) return json(404, { error: "not_found" }, "no-store");
    return json(200, rows, LIST_CACHE);
  } catch (err) { return fail(err); }
}
module.exports = nodeHandler(handlePosts);
`,
  instagram: `
const LIST_CACHE = "public, s-maxage=300, stale-while-revalidate=600";
const SELECT = "code,taken_at,caption,permalink,slides,photo_count,added_at";
const CODE_RE = /^[A-Za-z0-9_-]{5,40}$/;
async function handleInstagram(env, requestUrl) {
  try {
    const code = requestUrl && requestUrl.searchParams.get("code");
    if (code && !CODE_RE.test(code)) return json(400, { error: "bad_code" }, "no-store");
    const query = { published: "eq.true" };
    if (code) query.code = "eq." + code;
    const rows = await supabaseSelect(env, "instagram_posts", {
      select: SELECT,
      query,
      order: "taken_at.desc",
    });
    if (code) return rows.length ? json(200, rows[0], LIST_CACHE) : json(404, { error: "not_found" }, "no-store");
    return json(200, rows, LIST_CACHE);
  } catch (err) { return fail(err); }
}
module.exports = nodeHandler(handleInstagram);
`,
};

const dist = join(root, "dist");
const out = join(root, ".vercel", "output");
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "static"), { recursive: true });
cpSync(dist, join(out, "static"), { recursive: true });
try { rmSync(join(out, "static", "vercel.json")); } catch {}

// Photos live in the public Vercel Blob store (README, "Photos"). With PHOTOS_BASE_URL set, the deploy
// carries no photo files and /photos/* is proxied to the store. Unset keeps the old behaviour (photos in the deploy).
const photosBase = (process.env.PHOTOS_BASE_URL ?? "").replace(/\/+$/, "");
if (photosBase && !/^https:\/\/[a-z0-9.-]+$/i.test(photosBase)) {
  console.error("PHOTOS_BASE_URL must be an https origin, e.g. https://<id>.public.blob.vercel-storage.com");
  process.exit(1);
}
if (photosBase) rmSync(join(out, "static", "photos"), { recursive: true, force: true });

const vcConfig = JSON.stringify(
  { runtime: "nodejs22.x", handler: "index.js", launcherType: "Nodejs", shouldAddHelpers: true },
  null,
  2,
) + "\n";

for (const name of fns) {
  const destDir = join(out, "functions", "api", `${name}.func`);
  mkdirSync(destDir, { recursive: true });
  if (name === "og") {
    const ogSrc = join(root, "api", "og.cjs");
    if (!existsSync(ogSrc)) {
      console.error("missing api/og.cjs");
      process.exit(1);
    }
    writeFileSync(join(destDir, "index.js"), `"use strict";\n${SHARED}\n${readFileSync(ogSrc, "utf8")}`);
    cpSync(join(dist, "index.html"), join(destDir, "index.html"));
  } else if (HANDLERS[name]) {
    writeFileSync(join(destDir, "index.js"), `"use strict";\n${SHARED}\n${HANDLERS[name]}`);
  } else {
    console.error("unknown function:", name);
    process.exit(1);
  }
  writeFileSync(join(destDir, ".vc-config.json"), vcConfig);
}

const apiRoutes = fns.map((name) => {
  const route = { src: `^/api/${name}$`, dest: `/api/${name}` };
  if (name === "settings") {
    route.headers = {
      "Cache-Control": "no-store",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
    };
  }
  return route;
});
// Per-item link previews: send /?v= or /?p= (and legacy /v/<id>) through the og function
// BEFORE the static index.html. vercel.json rewrites are not applied on prebuilt uploads.
const ogQuery = fns.includes("videos") ? "v" : fns.includes("posts") ? "p" : null;
const ogRoutes = fns.includes("og") && ogQuery
  ? [
      { src: "^/$", has: [{ type: "query", key: ogQuery }], dest: "/api/og" },
      { src: `^/${ogQuery}/([^/]+)/?$`, dest: `/api/og?${ogQuery}=$1` },
    ]
  : [];
const routes = [
  ...apiRoutes,
  ...ogRoutes,
  { src: "^/assets/(.*)$", headers: { "Cache-Control": "public, max-age=31536000, immutable" }, continue: true },
  { src: "^/photos/(.*)$", headers: { "Cache-Control": "public, max-age=31536000, immutable" }, continue: true },
  { handle: "filesystem" },
  ...(photosBase ? [{ src: "^/photos/(.*)$", dest: `${photosBase}/photos/$1` }] : []),
  { src: "^/api(?:/.*)?$", status: 404 },
  { src: "^/(.*)$", dest: "/index.html" },
];
writeFileSync(join(out, "config.json"), JSON.stringify({ version: 3, routes }, null, 2) + "\n");

const payloads = join(root, "upload-payloads");
rmSync(payloads, { recursive: true, force: true });
mkdirSync(payloads, { recursive: true });
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const files = walk(out)
  .sort()
  .map((path) => {
    const buf = readFileSync(path);
    const rel = relative(out, path).split("\\").join("/");
    const file = `.vercel/output/${rel}`;
    const b64 = join(payloads, file.replace(/\//g, "__") + ".b64");
    writeFileSync(b64, buf.toString("base64"));
    return { file, sha: createHash("sha1").update(buf).digest("hex"), size: buf.length, b64 };
  });
writeFileSync(join(root, "deploy-manifest.json"), JSON.stringify({ dir: out, files }, null, 2) + "\n");
console.log(files.map((f) => `${f.size}\t${f.sha}\t${f.file}`).join("\n"));
