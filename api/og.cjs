const { readFileSync, existsSync } = require("fs");
const { join } = require("path");

const SITE_ORIGIN = "https://shiogama-nana-blog.vercel.app";
const SITE_TITLE = "塩釜菜那 部落格 中文翻譯";
const SITE_DESC = "塩釜菜那在僕青（僕が見たかった青空）官方部落格的繁體中文翻譯存檔，由新到舊排列。";
const SELECT = "id,title_zh,title_jp,post_date,original_url,body,photo_count,added_at,published";
const ID_RE = /^[\w.-]+$/;
const OG_RE = /<!--og-start-->[\s\S]*?<!--og-end-->/;
const GREETING = /^(おやっとさ|歡迎來到我的部落格|ようこそ)/;
const SAFE_SRC = /^\/photos\/[\w-]+\/[\w.-]+$/;

function loadHtml() {
  const cands = [join(__dirname, "index.html"), join(__dirname, "..", "..", "..", "..", "static", "index.html")];
  for (const p of cands) if (existsSync(p)) return readFileSync(p, "utf8");
  throw new Error("missing_index_html");
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function excerptFromBody(body) {
  if (!Array.isArray(body)) return "";
  const text = body.filter(function (b) { return b && b.type === "text" && typeof b.text === "string"; }).map(function (b) { return b.text; }).join("\n");
  const lines = text.split("\n");
  while (lines.length && (/^\s*$/.test(lines[0]) || GREETING.test(lines[0]))) lines.shift();
  const flat = lines.join("\n").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  return flat.length > 90 ? flat.slice(0, 90) + "…" : flat;
}

function firstPhoto(body) {
  if (!Array.isArray(body)) return null;
  const photo = body.find(function (b) { return b && b.type === "photo" && typeof b.src === "string" && SAFE_SRC.test(b.src); });
  return photo ? photo.src : null;
}

function ogBlock(meta, type) {
  const t = esc(meta.title);
  const d = esc(meta.description);
  const u = esc(meta.url);
  const i = esc(meta.image);
  const a = esc(meta.imageAlt || meta.title);
  const site = esc(SITE_TITLE);
  const ogType = type || "article";
  return "<!--og-start-->\n    <title>" + t + "</title>\n    <meta name=\"description\" content=\"" + d + "\" />\n    <link rel=\"canonical\" href=\"" + u + "\" />\n    <meta property=\"og:type\" content=\"" + ogType + "\" />\n    <meta property=\"og:site_name\" content=\"" + site + "\" />\n    <meta property=\"og:locale\" content=\"zh_TW\" />\n    <meta property=\"og:title\" content=\"" + t + "\" />\n    <meta property=\"og:description\" content=\"" + d + "\" />\n    <meta property=\"og:url\" content=\"" + u + "\" />\n    <meta property=\"og:image\" content=\"" + i + "\" />\n    <meta property=\"og:image:alt\" content=\"" + a + "\" />\n    <meta name=\"twitter:card\" content=\"summary_large_image\" />\n    <meta name=\"twitter:title\" content=\"" + t + "\" />\n    <meta name=\"twitter:description\" content=\"" + d + "\" />\n    <meta name=\"twitter:image\" content=\"" + i + "\" />\n    <!--og-end-->";
}

function injectOg(html, meta, type) {
  const block = ogBlock(meta, type);
  return OG_RE.test(html) ? html.replace(OG_RE, block) : html.replace("</head>", block + "\n  </head>");
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

const defaultMeta = {
  title: SITE_TITLE,
  description: SITE_DESC,
  url: SITE_ORIGIN + "/",
  image: SITE_ORIGIN + "/icon-512.png",
  imageAlt: SITE_TITLE,
};

async function handleOg(env, requestUrl) {
  var html;
  try {
    html = loadHtml();
  } catch (e) {
    return { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "unavailable" };
  }
  const id = requestUrl.searchParams.get("p") || "";
  if (!id || !ID_RE.test(id)) return htmlResult(injectOg(html, defaultMeta, "website"));
  try {
    const rows = await supabaseSelect(env, "blog_posts", {
      select: SELECT,
      query: { published: "eq.true", id: "eq." + id },
    });
    const row = rows[0];
    if (!row) return htmlResult(injectOg(html, defaultMeta, "website"));
    const desc = excerptFromBody(row.body) || row.title_jp || SITE_DESC;
    const photo = firstPhoto(row.body);
    return htmlResult(injectOg(html, {
      title: row.title_zh + "｜" + SITE_TITLE,
      description: desc,
      url: SITE_ORIGIN + "/?p=" + encodeURIComponent(row.id),
      image: photo ? SITE_ORIGIN + photo : SITE_ORIGIN + "/icon-512.png",
      imageAlt: row.title_zh,
    }, "article"));
  } catch (e) {
    return htmlResult(injectOg(html, defaultMeta, "website"));
  }
}

module.exports = nodeHandler(handleOg);
