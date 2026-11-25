import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { supabaseSelect } from "./supabase.mjs";

export const SITE_ORIGIN = "https://shiogama-nana-blog.vercel.app";
export const SITE_TITLE = "塩釜菜那 部落格 中文翻譯";
export const SITE_DESC = "塩釜菜那在僕青（僕が見たかった青空）官方部落格的繁體中文翻譯存檔，由新到舊排列。";

const SELECT = "id,title_zh,title_jp,post_date,original_url,body,photo_count,added_at,published";
const ID_RE = /^[\w.-]+$/;
const OG_RE = /<!--og-start-->[\s\S]*?<!--og-end-->/;
const GREETING = /^(おやっとさ|歡迎來到我的部落格|ようこそ)/;
const SAFE_SRC = /^\/photos\/[\w-]+\/[\w.-]+$/;

export function loadHtml() {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const p of [join(here, "index.html"), join(here, "..", "dist", "index.html"), join(here, "..", "index.html")]) {
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  throw new Error("missing_index_html");
}

export function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function excerptFromBody(body) {
  if (!Array.isArray(body)) return "";
  const text = body.filter((b) => b && b.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n");
  const lines = text.split("\n");
  while (lines.length && (/^\s*$/.test(lines[0]) || GREETING.test(lines[0]))) lines.shift();
  const flat = lines.join("\n").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  return flat.length > 90 ? flat.slice(0, 90) + "…" : flat;
}

export function firstPhoto(body) {
  if (!Array.isArray(body)) return null;
  const photo = body.find((b) => b && b.type === "photo" && typeof b.src === "string" && SAFE_SRC.test(b.src));
  return photo ? photo.src : null;
}

export function ogBlock({ title, description, url, image, imageAlt }) {
  const t = esc(title);
  const d = esc(description);
  const u = esc(url);
  const i = esc(image);
  const a = esc(imageAlt || title);
  const site = esc(SITE_TITLE);
  return `<!--og-start-->
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${u}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="${site}" />
    <meta property="og:locale" content="zh_TW" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${u}" />
    <meta property="og:image" content="${i}" />
    <meta property="og:image:alt" content="${a}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${i}" />
    <!--og-end-->`;
}

export function injectOg(html, meta) {
  const block = ogBlock(meta);
  return OG_RE.test(html) ? html.replace(OG_RE, block) : html.replace("</head>", `${block}\n  </head>`);
}

function htmlResult(html) {
  return {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
    body: html,
  };
}

export const defaultPostMeta = {
  title: SITE_TITLE,
  description: SITE_DESC,
  url: `${SITE_ORIGIN}/`,
  image: `${SITE_ORIGIN}/icon-512.png`,
  imageAlt: SITE_TITLE,
  // root uses website type via a dedicated block below
};

function ogBlockRoot(meta) {
  return ogBlock(meta).replace('property="og:type" content="article"', 'property="og:type" content="website"');
}

function inject(html, meta, root = false) {
  const block = root ? ogBlockRoot(meta) : ogBlock(meta);
  return OG_RE.test(html) ? html.replace(OG_RE, block) : html.replace("</head>", `${block}\n  </head>`);
}

export async function handleOg(env, requestUrl) {
  let html;
  try {
    html = loadHtml();
  } catch {
    return { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "unavailable" };
  }

  const id = requestUrl.searchParams.get("p") || "";
  if (!id || !ID_RE.test(id)) return htmlResult(inject(html, defaultPostMeta, true));

  try {
    const rows = await supabaseSelect(env, "blog_posts", {
      select: SELECT,
      query: { published: "eq.true", id: "eq." + id },
    });
    const row = rows[0];
    if (!row) return htmlResult(inject(html, defaultPostMeta, true));
    const desc = excerptFromBody(row.body) || row.title_jp || SITE_DESC;
    const photo = firstPhoto(row.body);
    return htmlResult(
      inject(html, {
        title: `${row.title_zh}｜${SITE_TITLE}`,
        description: desc,
        url: `${SITE_ORIGIN}/?p=${encodeURIComponent(row.id)}`,
        image: photo ? `${SITE_ORIGIN}${photo}` : `${SITE_ORIGIN}/icon-512.png`,
        imageAlt: row.title_zh,
      }),
    );
  } catch {
    return htmlResult(inject(html, defaultPostMeta, true));
  }
}
