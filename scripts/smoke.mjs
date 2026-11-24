// Headless smoke test. Needs `npm i --no-save playwright-core` and a local Chrome.
// Usage: npm run test:smoke -- [URL] [--shots DIR]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const si = args.indexOf("--shots");
const shots = si >= 0 ? args[si + 1] : null;
const url = (args.find((a, i) => !a.startsWith("--") && i !== si + 1) ?? "http://localhost:4174/").replace(/#.*$/, "");
const exe = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
if (shots) mkdirSync(shots, { recursive: true });

let failures = 0;
const ok = (c, m) => (console.log(`${c ? "PASS" : "FAIL"}  ${m}`), c || failures++);

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
const bad = [];
const hosts = new Set();
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  hosts.add(new URL(r.url()).host);
  if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
});
await page.goto(url, { waitUntil: "networkidle" });
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
const warn = await page.locator(".status.warn").count();
console.log(`info  data source warning shown: ${warn ? "yes (fallback)" : "no"}`);

await page.fill(".search input", "釣魚");
let t = await titles();
ok(t.length === 1 && t[0].includes("釣魚"), `search 釣魚 -> ${t.join(" | ")}`);
await page.fill(".search input", "2026.11.21");
t = await titles();
ok(t.length === 1 && t[0].includes("課堂"), `search by date 2026.11.21 -> ${t.join(" | ")}`);
await page.fill(".search input", "不存在xyz");
ok(await page.locator(".empty").isVisible(), "empty state on no match");
await page.fill(".search input", "");

if (shots) await page.screenshot({ path: `${shots}/desktop-list.png`, fullPage: true });

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

// Post view.
await page.click(".card-btn >> nth=1");
await page.waitForSelector("article.post");
ok(/#p=21657$/.test(page.url()), `post deep link (${page.url().split("/").pop()})`);
const pv = await page.locator(".post-body p").count();
ok(pv > 5, `full translation paragraphs (${pv})`);
const imgs = await page.$$eval(".post-body img", (els) => els.map((e) => ({ src: e.getAttribute("src"), lazy: e.loading })));
ok(imgs.length === 3 && imgs.every((i) => i.lazy === "lazy"), `3 lazy photos in post 21657`);
for (const img of imgs) {
  const r = await page.request.get(new URL(img.src, url).href);
  ok(r.status() === 200 && r.headers()["content-type"]?.startsWith("image/"), `photo 200 ${img.src}`);
}
ok((await page.locator("a.original").getAttribute("href")) === "https://bokuao.com/blog/detail/21657", "original link");
await page.evaluate(() => Promise.all([...document.querySelectorAll(".post-body img")].map((i) => ((i.loading = "eager"), i.decode()))));
await page.waitForTimeout(500);
ok(true, "all post photos decoded");
if (shots) await page.screenshot({ path: `${shots}/desktop-post.png`, fullPage: true });

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

// Back to list.
await page.click(".post-nav.top .pill");
await page.waitForSelector(".card");
ok(!page.url().includes("#p="), "返回文章列表 returns to list");

// Direct deep link in a fresh page.
const d = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await d.goto(url + "#p=21623", { waitUntil: "networkidle" });
await d.waitForSelector("article.post");
ok((await d.textContent("#post-title")).includes("刨冰"), "direct #p=21623 opens that post");
await d.close();

// Mobile.
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await m.goto(url, { waitUntil: "networkidle" });
await m.waitForSelector(".card");
ok(!(await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), "mobile list: no horizontal overflow");
if (shots) await m.screenshot({ path: `${shots}/mobile-list.png`, fullPage: true });
await m.tap(".card-btn >> nth=0");
await m.waitForSelector("article.post");
ok(!(await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), "mobile post: no horizontal overflow");
await m.evaluate(() => Promise.all([...document.querySelectorAll(".post-body img")].map((i) => ((i.loading = "eager"), i.decode()))));
await m.waitForTimeout(500);
if (shots) await m.screenshot({ path: `${shots}/mobile-post.png`, fullPage: true });
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
