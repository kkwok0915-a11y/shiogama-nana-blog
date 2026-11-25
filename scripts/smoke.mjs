// Headless smoke test. Needs `npm i --no-save playwright-core` and a local Chrome.
// Usage: npm run test:smoke -- [URL] [--shots DIR]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const si = args.indexOf("--shots");
const shots = si >= 0 ? args[si + 1] : null;
const url = (args.find((a, i) => !a.startsWith("--") && (si < 0 || i !== si + 1)) ?? "http://localhost:4174/").replace(/[?#].*$/, "");
const base = new URL(url).origin + "/";
const exe = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
if (shots) mkdirSync(shots, { recursive: true });

let failures = 0;
const ok = (c, m) => (console.log(`${c ? "PASS" : "FAIL"}  ${m}`), c || failures++);

const minTap = async (locator, label) => {
  const box = await locator.boundingBox();
  const h = box?.height ?? 0;
  const w = box?.width ?? 0;
  ok(h >= 44 && w >= 44, `${label} tap target ${Math.round(w)}×${Math.round(h)} (min 44)`);
};

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
const errors = [];
const bad = [];
const hosts = new Set();
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  hosts.add(new URL(r.url()).host);
  if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
});
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForSelector(".card");

const n = await page.locator(".card").count();
ok(n >= 4, `renders post cards (${n})`);
const titles = () => page.$$eval(".card-title", (els) => els.map((e) => e.textContent));
const dates = await page.$$eval(".card-date", (els) => els.map((e) => e.textContent));
ok(dates.every((d, i) => i === 0 || dates[i - 1] >= d), `newest first (${dates.join(", ")})`);
ok((await page.locator(".card .thumb img").count()) === n, "every card has a thumbnail");
ok((await page.locator(".card-excerpt").count()) === n, "every card has an excerpt");
const html = await page.content();
ok(!/kwok|kkwok|@gmail|a11ys|stephen|スティーブン/i.test(html), "no personal info in page HTML");
ok((await page.locator("header.site .kicker").textContent())?.trim() === "僕が見たかった青空", "header kicker is the group name");

const postsApi = await page.request.get(new URL("/api/posts", base).href);
ok(postsApi.ok(), `/api/posts HTTP ${postsApi.status()}`);
const postsJson = await postsApi.json();
ok(Array.isArray(postsJson) && postsJson.length >= 4, `/api/posts returns rows (${postsJson.length})`);
ok(/s-maxage=300/.test(postsApi.headers()["cache-control"] || ""), `/api/posts cache ${postsApi.headers()["cache-control"]}`);
const one = await page.request.get(new URL(`/api/posts?id=${postsJson[0].id}`, base).href);
ok(one.ok(), `/api/posts?id= HTTP ${one.status()}`);
const oneJson = await one.json();
ok(Array.isArray(oneJson) && oneJson.length === 1 && oneJson[0].id === postsJson[0].id, "/api/posts?id= returns one post");
const settingsApi = await page.request.get(new URL("/api/settings", base).href);
ok(settingsApi.ok(), `/api/settings HTTP ${settingsApi.status()}`);
const settings = await settingsApi.json();
ok("notice_enabled" in settings, "settings has notice_enabled");
ok(/no-store/.test(settingsApi.headers()["cache-control"] || ""), `/api/settings cache ${settingsApi.headers()["cache-control"]}`);
const bundleHref = await page.locator('script[src*="/assets/index-"]').first().getAttribute("src");
const bundleRes = await page.request.get(new URL(bundleHref, base).href);
const bundleText = await bundleRes.text();
ok(!/supabase\.co|sb_publishable/i.test(bundleText), "live JS bundle has no Supabase URL or publishable key");
if (settings.notice_enabled && settings.notice_text) {
  await page.waitForSelector(".upgrade-notice");
  ok((await page.locator(".upgrade-notice p").textContent())?.trim() === settings.notice_text.trim(), "upgrade notice shows the API text");
} else {
  ok((await page.locator(".upgrade-notice").count()) === 0, "upgrade notice hidden when disabled");
}

if (shots) {
  const box = await page.locator("header.site").boundingBox();
  if (box) await page.screenshot({ path: `${shots}/desktop-header.png`, clip: { x: 0, y: 0, width: 1280, height: Math.min(900, Math.ceil(box.y + box.height + 24)) } });
}
const warn = await page.locator(".status.warn").count();
console.log(`info  data source warning shown: ${warn ? "yes (fallback)" : "no"}`);

ok((await page.locator(".badge-new").count()) === n, `NEW badge on posts added in last 7 days (${n})`);
ok((await page.locator(".badge-new").first().textContent())?.trim() === "NEW", "badge text is NEW");
ok((await page.locator(".badge-read").count()) === 0, "no 已讀 markers before opening a post");
ok((await page.locator(".filter-unread").count()) === 0, "未讀 filter chip is not present");
await minTap(page.locator(".search input"), "search input");

// PWA manifest + icons + no service worker.
const manifestHref = await page.getAttribute('link[rel="manifest"]', "href");
ok(Boolean(manifestHref), `manifest link present (${manifestHref})`);
const manRes = await page.request.get(new URL(manifestHref, base).href);
ok(manRes.ok(), `manifest.webmanifest HTTP ${manRes.status()}`);
const man = await manRes.json();
ok(man.display === "standalone" && man.name, `manifest display=standalone name=${man.name}`);
ok(!/kwok|kkwok|@gmail/i.test(JSON.stringify(man)), "manifest has no personal info");
for (const icon of man.icons) {
  const ir = await page.request.get(new URL(icon.src, base).href);
  ok(ir.ok() && (ir.headers()["content-type"] || "").includes("png"), `icon ${icon.src} HTTP ${ir.status()} ${ir.headers()["content-type"]}`);
}
const apple = await page.request.get(new URL("/apple-touch-icon.png", base).href);
ok(apple.ok(), `apple-touch-icon.png HTTP ${apple.status()}`);
const sws = await page.evaluate(async () => (await navigator.serviceWorker?.getRegistrations?.())?.length ?? 0);
ok(sws === 0, "no service worker registered");

await page.fill(".search input", "釣魚");
let t = await titles();
ok(t.length === 1 && t[0].includes("釣魚"), `search 釣魚 -> ${t.join(" | ")}`);
await page.fill(".search input", "2026.11.21");
t = await titles();
ok(t.length === 1 && t[0].includes("課堂"), `search by date 2026.11.21 -> ${t.join(" | ")}`);
await page.fill(".search input", "不存在xyz");
ok(await page.locator(".empty").isVisible(), "empty state on no match");
await page.click(".search-clear");
ok((await page.locator(".search input").inputValue()) === "", "search clear button empties the query");

// Back-to-top on the list.
ok(!(await page.locator(".to-top.visible").count()), "back-to-top hidden at top");
await page.evaluate(() => (document.body.style.paddingBottom = "2500px"));
await page.evaluate(() => window.scrollTo(0, 1500));
await page.waitForSelector(".to-top.visible");
ok((await page.getAttribute(".to-top", "aria-label")) === "回到頂部", "back-to-top visible with label 回到頂部");
await page.click(".to-top");
await page.waitForFunction(() => window.scrollY === 0, null, { timeout: 5000 });
ok(true, "back-to-top scrolls to top");
await page.evaluate(() => (document.body.style.paddingBottom = ""));

// Post view (second card = 21657, has both newer and older neighbours).
await page.click(".card-btn >> nth=1");
await page.waitForSelector("article.post");
ok(/[?&]p=21657(?:&|$)/.test(new URL(page.url()).search), `post deep link uses ?p= (${page.url()})`);
ok((await page.title()).includes("釣魚"), `document.title uses post title (${await page.title()})`);
const pv = await page.locator(".post-body p").count();
ok(pv > 5, `full translation paragraphs (${pv})`);
const imgs = await page.$$eval(".post-body img", (els) => els.map((e) => ({ src: e.getAttribute("src"), lazy: e.loading })));
ok(imgs.length === 3 && imgs.every((i) => i.lazy === "lazy"), `3 lazy photos in post 21657`);
for (const img of imgs) {
  const r = await page.request.get(new URL(img.src, base).href);
  ok(r.status() === 200 && r.headers()["content-type"]?.startsWith("image/"), `photo 200 ${img.src}`);
}
ok((await page.locator("a.original").getAttribute("href")) === "https://bokuao.com/blog/detail/21657", "original link");
ok((await page.locator(".adj").count()) === 2, "prev and next post buttons are both present");
ok((await page.locator(".adj").first().textContent()).includes("較新"), "left button is 較新的文章");
ok((await page.locator(".adj").last().textContent()).includes("較舊"), "right button is 較舊的文章");
await minTap(page.locator(".pill").first(), "返回文章列表");
await minTap(page.locator(".copy-link"), "複製連結");
await minTap(page.locator(".adj").first(), "較新的文章");

await page.evaluate(() => Promise.all([...document.querySelectorAll(".post-body img")].map((i) => ((i.loading = "eager"), i.decode()))));
await page.waitForTimeout(500);
if (shots) await page.screenshot({ path: `${shots}/desktop-post-prev-next.png`, fullPage: true });

// Copy link + toast.
await page.click(".copy-link");
await page.waitForSelector(".toast");
ok((await page.textContent(".toast"))?.includes("已複製連結"), "複製連結 shows 已複製連結 toast");
try {
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  ok(clip.includes("?p=21657"), `copied URL is a ?p= link (${clip})`);
} catch (e) {
  console.log(`info  clipboard read skipped: ${e.message}`);
}

// Lightbox.
await page.click(".photo-btn >> nth=0");
await page.waitForSelector("dialog.lightbox[open] img");
ok((await page.textContent(".lb-count")).includes("1 / 3"), "lightbox opens on photo 1/3");
await page.keyboard.press("ArrowRight");
ok((await page.textContent(".lb-count")).includes("2 / 3"), "lightbox arrow -> 2/3");
if (shots) await page.screenshot({ path: `${shots}/desktop-lightbox.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
ok(!(await page.locator("dialog.lightbox[open]").count()), "Esc closes lightbox");

// Arrow keys switch posts when the viewer is closed (Right = older).
await page.keyboard.press("ArrowRight");
await page.waitForFunction(() => new URL(location.href).searchParams.get("p") === "21633");
ok((await page.textContent("#post-title")).includes("課堂"), "ArrowRight opens the older post");
ok(/[?&]p=21633/.test(page.url()), "prev/next replace the ?p= query");

// Back to list.
await page.click(".post-nav.top .pill");
await page.waitForSelector(".card");
ok(!new URL(page.url()).searchParams.has("p"), "返回文章列表 returns to the list");
ok((await page.locator(".badge-read").count()) >= 2, `已讀 markers after opening posts (${await page.locator(".badge-read").count()})`);
if (shots) await page.screenshot({ path: `${shots}/desktop-new-and-read.png`, fullPage: true });

// Direct deep link in a fresh page (legacy #p= is canonicalised to ?p=).
const d = await context.newPage();
await d.goto(base + "?p=21623", { waitUntil: "load" });
await d.waitForSelector("article.post");
ok((await d.textContent("#post-title")).includes("刨冰"), "direct ?p=21623 opens that post");
ok((await d.title()).includes("刨冰"), "direct ?p= sets document.title");
ok(new URL(d.url()).searchParams.get("p") === "21623", "direct link keeps ?p=");
if (shots) {
  await d.evaluate(() => Promise.all([...document.querySelectorAll(".post-body img")].map((i) => ((i.loading = "eager"), i.decode()))));
  await d.waitForTimeout(400);
  await d.screenshot({ path: `${shots}/desktop-direct-link.png`, fullPage: true });
}
await d.close();

const legacy = await context.newPage();
await legacy.goto(base + "#p=21623", { waitUntil: "networkidle" });
await legacy.waitForSelector("article.post");
ok(new URL(legacy.url()).searchParams.get("p") === "21623", "legacy #p= is canonicalised to ?p=");
await legacy.close();

// Mobile.
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await m.goto(base, { waitUntil: "networkidle" });
await m.waitForSelector(".card");
ok(!(await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), "mobile list: no horizontal overflow");
ok((await m.locator("header.site .kicker").textContent())?.trim() === "僕が見たかった青空", "mobile header kicker is the group name");
if (shots) {
  await m.screenshot({ path: `${shots}/mobile-list.png`, fullPage: true });
  const box = await m.locator("header.site").boundingBox();
  if (box) await m.screenshot({ path: `${shots}/mobile-header.png`, clip: { x: 0, y: 0, width: 390, height: Math.min(844, Math.ceil(box.y + box.height + 16)) } });
}
await m.tap(".card-btn >> nth=0");
await m.waitForSelector("article.post");
ok(!(await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), "mobile post: no horizontal overflow");
await m.evaluate(() => Promise.all([...document.querySelectorAll(".post-body img")].map((i) => ((i.loading = "eager"), i.decode()))));
await m.waitForTimeout(500);
if (shots) await m.screenshot({ path: `${shots}/mobile-post.png`, fullPage: true });

// Photo viewer + swipe on mobile.
await m.tap(".photo-btn >> nth=0");
await m.waitForSelector("dialog.lightbox[open] img");
ok((await m.textContent(".lb-count")).includes("1 /"), "mobile lightbox opens");
await m.evaluate(() => {
  const el = document.querySelector("dialog.lightbox");
  const fire = (type, x, y, touches) => {
    const touch = new Touch({ identifier: 1, target: el, clientX: x, clientY: y, pageX: x, pageY: y, screenX: x, screenY: y, radiusX: 1, radiusY: 1, rotationAngle: 0, force: 1 });
    el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, composed: true, touches, changedTouches: [touch] }));
  };
  const r = el.getBoundingClientRect();
  const y = r.top + r.height / 2;
  const x0 = r.left + r.width * 0.8;
  const x1 = r.left + r.width * 0.2;
  fire("touchstart", x0, y, [new Touch({ identifier: 1, target: el, clientX: x0, clientY: y, pageX: x0, pageY: y, screenX: x0, screenY: y, radiusX: 1, radiusY: 1, rotationAngle: 0, force: 1 })]);
  fire("touchend", x1, y, []);
});
await m.waitForTimeout(200);
ok((await m.textContent(".lb-count")).includes("2 /"), `mobile swipe left advances photo (${(await m.textContent(".lb-count"))?.trim()})`);
if (shots) await m.screenshot({ path: `${shots}/mobile-photo-viewer.png` });
await m.tap(".lb-close");
await m.waitForTimeout(200);
ok(!(await m.locator("dialog.lightbox[open]").count()), "mobile close button exits the photo viewer");

await m.evaluate(() => window.scrollTo(0, 1200));
await m.waitForSelector(".to-top.visible");
ok(true, "mobile: back-to-top appears after scrolling");
if (shots) await m.waitForTimeout(400), await m.screenshot({ path: `${shots}/mobile-back-to-top.png` });

ok(errors.length === 0, `no page errors ${errors.join("; ")}`);
ok(bad.length === 0, `no failed requests ${bad.join("; ")}`);
console.log(`info  hosts contacted: ${[...hosts].join(", ")}`);
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
