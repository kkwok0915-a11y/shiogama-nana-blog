import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import BackToTop from "./components/BackToTop";
import ListSkeleton from "./components/ListSkeleton";
import DatePicker from "./components/DatePicker";
import PhotoGallery, { galleryItems, type GallerySource } from "./components/PhotoGallery";
import { dateFromLocation, nearestDate, uniqueDates } from "./lib/dates";
import PostCard from "./components/PostCard";
import PostView from "./components/PostView";
import SearchBar from "./components/SearchBar";
import StatusPage from "./components/StatusPage";
import { usePosts } from "./hooks";
import { bundledPosts, filterPosts, groupByMonth, historyHasPostState, postIdFromLocation, postPath } from "./lib/posts";
import { useRead } from "./lib/read";
import type { Post } from "./types";
import UpgradeNotice from "./components/UpgradeNotice";
import InstagramGrid from "./components/InstagramGrid";
import InstagramView from "./components/InstagramView";
import { IG_LIST_PATH, filterIg, igCodeFromLocation, igPath, igTabFromLocation, useInstagram, type IgPost } from "./lib/instagram";

const EMPTY: Post[] = [];
const TITLE = "塩釜菜那 部落格 中文翻譯";

type ListView = "list" | "gallery" | "instagram";

/** ?tab=gallery[&src=blog|ig] keeps the 相簿 tab and its source filter in the URL. */
const galleryTabFromLocation = (loc: Location = window.location) => new URLSearchParams(loc.search).get("tab") === "gallery";
function gallerySourceFromLocation(loc: Location = window.location): GallerySource {
  const v = new URLSearchParams(loc.search).get("src");
  return v === "blog" || v === "ig" ? v : "all";
}
/** URL for a list view; ?date=YYYY-MM-DD (文章 and 相簿) and &src= (相簿) survive reload and Back. */
function listPath(view: ListView, src: GallerySource, date: string | null): string {
  if (view === "instagram") return IG_LIST_PATH;
  const q = new URLSearchParams();
  if (view === "gallery") {
    q.set("tab", "gallery");
    if (src !== "all") q.set("src", src);
  }
  if (date) q.set("date", date);
  const qs = q.toString();
  return qs ? `/?${qs}` : "/";
}
function viewFromLocation(): ListView {
  if (igTabFromLocation() || igCodeFromLocation()) return "instagram";
  if (galleryTabFromLocation()) return "gallery";
  return "list";
}

export default function App() {
  const state = usePosts();
  const posts = state.status === "ready" ? state.posts : EMPTY;
  const { mark, isRead } = useRead();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ListView>(viewFromLocation);
  const [gallerySource, setGallerySource] = useState<GallerySource>(gallerySourceFromLocation);
  const [date, setDate] = useState<string | null>(dateFromLocation);
  const ig = useInstagram();
  const [igCode, setIgCode] = useState<string | null>(() => igCodeFromLocation());
  const igVisible = useMemo(() => filterIg(ig.posts, query), [ig.posts, query]);
  const igIdx = igCode ? ig.posts.findIndex((p) => p.code === igCode) : -1;
  const igActive = igIdx >= 0 ? ig.posts[igIdx] : null;
  const [activeId, setActiveId] = useState<string | null>(null);
  const listScroll = useRef(0);

  const visible = useMemo(() => filterPosts(posts, query), [posts, query]);
  // 文章: the picked date snaps to the nearest date that has a post.
  const listDates = useMemo(() => uniqueDates(visible.map((p) => p.post_date)), [visible]);
  const listDate = nearestDate(listDates, date);
  const listShown = useMemo(() => (listDate ? visible.filter((p) => p.post_date === listDate) : visible), [visible, listDate]);
  const months = useMemo(() => groupByMonth(listShown), [listShown]);
  // 相簿: blog + Instagram photos, filtered by source, then by date (snapped to the nearest date with photos).
  const effSource: GallerySource = ig.posts.length ? gallerySource : "blog";
  const galleryAll = useMemo(() => galleryItems(visible, igVisible), [visible, igVisible]);
  const gallerySrcItems = useMemo(
    () => (effSource === "all" ? galleryAll : galleryAll.filter((i) => i.kind === effSource)),
    [galleryAll, effSource],
  );
  const galleryDates = useMemo(() => uniqueDates(gallerySrcItems.map((i) => i.post_date)), [gallerySrcItems]);
  const galleryDate = nearestDate(galleryDates, date);
  const galleryShown = useMemo(
    () => (galleryDate ? gallerySrcItems.filter((i) => i.post_date === galleryDate) : gallerySrcItems),
    [gallerySrcItems, galleryDate],
  );
  const galleryCounts = useMemo(() => {
    const onDate = galleryDate ? galleryAll.filter((i) => i.post_date === galleryDate) : galleryAll;
    return {
      all: onDate.length,
      blog: onDate.filter((i) => i.kind === "blog").length,
      ig: onDate.filter((i) => i.kind === "ig").length,
    };
  }, [galleryAll, galleryDate]);
  const idx = activeId ? posts.findIndex((p) => p.id === activeId) : -1;
  const active = idx >= 0 ? posts[idx] : null;

  useEffect(() => {
    const sync = () => {
      const code = igCodeFromLocation();
      setIgCode(code);
      if (!postIdFromLocation()) {
        setView(viewFromLocation());
        setGallerySource(gallerySourceFromLocation());
        setDate(dateFromLocation());
      }
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useLayoutEffect(() => {
    if (igCode) window.scrollTo(0, 0);
    else if (view === "instagram" || view === "gallery") window.scrollTo(0, listScroll.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igCode]);

  const openIg = useCallback((p: IgPost) => {
    if (!igCodeFromLocation()) listScroll.current = window.scrollY;
    setIgCode(p.code);
    history.pushState({ ig: p.code }, "", igPath(p.code));
  }, []);

  const switchIg = useCallback((p: IgPost) => {
    setIgCode(p.code);
    const hasState = Boolean(history.state && typeof history.state === "object" && "ig" in history.state);
    history.replaceState(hasState ? { ig: p.code } : null, "", igPath(p.code));
  }, []);

  const backIg = useCallback(() => {
    setIgCode(null);
    // With an in-app history entry, Back returns to wherever the post was opened from (Instagram tab or 相簿);
    // popstate then restores the view from the URL.
    if (history.state && typeof history.state === "object" && "ig" in history.state) history.back();
    else {
      setView("instagram");
      history.replaceState(null, "", IG_LIST_PATH);
    }
  }, []);

  const replaceUrl = (want: string) => {
    if (window.location.pathname + window.location.search !== want) history.replaceState(null, "", want);
  };

  const selectView = useCallback(
    (v: ListView) => {
      setView(v);
      replaceUrl(listPath(v, gallerySource, date));
    },
    [gallerySource, date],
  );

  const selectGallerySource = useCallback(
    (src: GallerySource) => {
      setGallerySource(src);
      replaceUrl(listPath("gallery", src, date));
    },
    [date],
  );

  const selectDate = useCallback(
    (d: string | null) => {
      setDate(d);
      replaceUrl(listPath(view, gallerySource, d));
    },
    [view, gallerySource],
  );

  useEffect(() => {
    if (!igCode) return;
    document.title = igActive ? `Instagram ${igActive.dateLabel}｜${TITLE}` : `Instagram｜${TITLE}`;
  }, [igCode, igActive]);

  useEffect(() => {
    if (igCode) return;
    document.title = active
      ? `${active.title_zh}｜${TITLE}`
      : state.status === "ready" && activeId
        ? `找不到這篇文章｜${TITLE}`
        : TITLE;
  }, [active, activeId, state.status, igCode]);

  useEffect(() => {
    if (state.status !== "ready") return;
    const sync = () => setActiveId(postIdFromLocation());
    sync();
    const id = postIdFromLocation();
    if (id) {
      const path = postPath(id);
      const loc = window.location;
      if (loc.pathname + loc.search + loc.hash !== path) {
        // Replace without a `{p}` state so Back/close stays on the list instead of leaving the site.
        history.replaceState(null, "", path);
      }
    }
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [state.status]);

  useEffect(() => {
    if (active) mark(active);
  }, [active, mark]);

  // Post view starts at the top; returning to the list restores its scroll position.
  useLayoutEffect(() => {
    if (state.status !== "ready") return;
    if (activeId) window.scrollTo(0, 0);
    else window.scrollTo(0, listScroll.current);
  }, [activeId, state.status]);

  const open = useCallback((p: Post) => {
    if (!postIdFromLocation()) listScroll.current = window.scrollY;
    setActiveId(p.id);
    const path = postPath(p.id);
    if (postIdFromLocation() !== p.id || window.location.pathname + window.location.search !== path) {
      history.pushState({ p: p.id }, "", path);
    }
  }, []);

  /** Switch post inside an already-open view (prev/next / arrows). Replace the URL so Back still returns to the list. */
  const switchTo = useCallback((p: Post) => {
    setActiveId(p.id);
    const path = postPath(p.id);
    if (postIdFromLocation() === p.id && window.location.pathname + window.location.search === path) return;
    history.replaceState(historyHasPostState() ? { p: p.id } : null, "", path);
  }, []);

  const back = useCallback(() => {
    if (!postIdFromLocation() && !activeId) return;
    setActiveId(null);
    if (postIdFromLocation()) {
      if (historyHasPostState()) history.back();
      else history.replaceState(null, "", "/");
    }
  }, [activeId]);

  const latest = posts[0]?.dateLabel ?? "";
  const filtered = Boolean(query);

  return (
    <>
      <UpgradeNotice />
      <a className="skip-link" href="#main">
        跳到主要內容
      </a>
      <div className="wrap" id="top">
        <header className="site">
          <p className="kicker">僕が見たかった青空</p>
          <h1>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                if (igCode) backIg();
                else if (activeId) back();
              }}
            >
              {TITLE}
            </a>
          </h1>
          <p className="lede">塩釜菜那官方部落格「菜那のもぜか日記」的繁體中文翻譯，最新文章在最上面。</p>
        </header>

        <main id="main" aria-busy={state.status === "loading"}>
        {igCode && (igActive ? (
          <InstagramView
            key={igActive.code}
            post={igActive}
            next={igIdx > 0 ? ig.posts[igIdx - 1] : null}
            prev={igIdx < ig.posts.length - 1 ? ig.posts[igIdx + 1] : null}
            onBack={backIg}
            onOpen={switchIg}
          />
        ) : ig.loaded ? (
          <StatusPage
            title="找不到這則貼文"
            message="這個連結沒有對應的 Instagram 貼文，可能尚未存檔或網址有誤。"
            actionLabel="返回 Instagram"
            onAction={backIg}
          />
        ) : (
          <p className="status" role="status">載入中…</p>
        ))}
        {!igCode && state.status === "loading" && <ListSkeleton count={bundledPosts().length} />}
        {!igCode && state.status === "error" && (
          <StatusPage
            title="無法載入文章"
            message="請檢查網路連線後再試一次。"
            actionLabel="再試一次"
            onAction={state.retry}
            alert
          />
        )}

        {!igCode && state.status === "ready" && (
          <>
            {state.warning && (
              <p className="status warn" role="status">
                {state.warning}{" "}
                <button type="button" className="status-retry" onClick={state.retry}>
                  再試一次
                </button>
              </p>
            )}
            {activeId && !active && (
              <StatusPage
                title="找不到這篇文章"
                message="這個連結沒有對應的文章，可能已經下架或網址有誤。"
                actionLabel="返回文章列表"
                onAction={back}
              />
            )}
            {active ? (
              <PostView
                key={active.id}
                post={active}
                next={idx > 0 ? posts[idx - 1] : null}
                prev={idx < posts.length - 1 ? posts[idx + 1] : null}
                onBack={back}
                onOpen={switchTo}
              />
            ) : (
              !activeId && (
                <>
                  <div className="toolbar" role="search">
                    <SearchBar query={query} onQuery={setQuery} bare />
                    <div className="chip-row view-tabs" role="tablist" aria-label="瀏覽方式">
                      <button
                        type="button"
                        role="tab"
                        className={"chip" + (view === "list" ? " current" : "")}
                        aria-selected={view === "list"}
                        onClick={() => selectView("list")}
                      >
                        文章
                      </button>
                      <button
                        type="button"
                        role="tab"
                        className={"chip" + (view === "gallery" ? " current" : "")}
                        aria-selected={view === "gallery"}
                        onClick={() => selectView("gallery")}
                      >
                        相簿
                      </button>
                      {ig.posts.length > 0 && (
                        <button
                          type="button"
                          role="tab"
                          className={"chip" + (view === "instagram" ? " current" : "")}
                          aria-selected={view === "instagram"}
                          onClick={() => selectView("instagram")}
                        >
                          Instagram
                        </button>
                      )}
                    </div>
                    {view === "list" && (
                      <DatePicker dates={listDates} value={listDate} requested={date} onChange={selectDate} noun="文章" />
                    )}
                    {view === "gallery" && (
                      <DatePicker dates={galleryDates} value={galleryDate} requested={date} onChange={selectDate} noun="照片" />
                    )}
                  </div>
                  <p className="result-count" aria-live="polite">
                    {view === "instagram"
                      ? filtered
                        ? `找到 ${igVisible.length} 則貼文`
                        : `共 ${igVisible.length} 則 Instagram 貼文`
                      : view === "gallery"
                      ? filtered || galleryDate
                        ? `找到 ${galleryShown.length} 張照片`
                        : `共 ${galleryShown.length} 張照片`
                      : filtered || listDate
                        ? `找到 ${listShown.length} 篇文章`
                        : `共 ${listShown.length} 篇文章`}
                    <span className="sort-note">・依發文日期由新到舊</span>
                  </p>
                  {view === "instagram" ? (
                    <InstagramGrid posts={igVisible} onOpen={openIg} />
                  ) : view === "gallery" ? (
                    <PhotoGallery
                      items={galleryShown}
                      counts={galleryCounts}
                      showSourceFilter={ig.posts.length > 0}
                      source={effSource}
                      onSource={selectGallerySource}
                      onOpenPost={open}
                      onOpenIg={openIg}
                    />
                  ) : listShown.length ? (
                    months.map((m) => (
                      <section key={m.key} className="month-section" aria-labelledby={`month-${m.key}`}>
                        <h2 className="month-heading" id={`month-${m.key}`}>
                          {m.label}
                          <span className="month-count">（{m.count}）</span>
                        </h2>
                        <ul className="list">
                          {m.items.map((p) => (
                            <PostCard key={p.id} post={p} onOpen={open} read={isRead(p)} priority={listShown.indexOf(p) < 3} />
                          ))}
                        </ul>
                      </section>
                    ))
                  ) : (
                    <div className="empty" role="status">
                      <p>找不到符合的文章。</p>
                      {filtered && (
                        <button type="button" className="empty-clear" onClick={() => setQuery("")}>
                          清除搜尋
                        </button>
                      )}
                    </div>
                  )}
                </>
              )
            )}
          </>
        )}
        </main>

        <footer className="site">
          <p>非官方翻譯存檔。原文與照片著作權屬於原作者及營運單位。</p>
          <p className="footer-meta">{latest ? `最新文章：${latest}` : " "}</p>
        </footer>
      </div>
      <BackToTop />
    </>
  );
}
