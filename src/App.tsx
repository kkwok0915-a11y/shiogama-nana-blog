import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import BackToTop from "./components/BackToTop";
import DatePicker from "./components/DatePicker";
import IgCard from "./components/IgCard";
import PhotoGallery, { galleryItems } from "./components/PhotoGallery";
import PostCard from "./components/PostCard";
import PostView from "./components/PostView";
import SearchBar from "./components/SearchBar";
import { FeedSkeleton, PostSkeleton } from "./components/Skeletons";
import SourceFilter, { type Source } from "./components/SourceFilter";
import StatusPage from "./components/StatusPage";
import UpgradeNotice from "./components/UpgradeNotice";
import InstagramView from "./components/InstagramView";
import { usePosts } from "./hooks";
import { dateFromLocation, nearestDate, uniqueDates } from "./lib/dates";
import { feedItems } from "./lib/feed";
import { filterIg, igCodeFromLocation, igPath, igTabFromLocation, useInstagram, type IgPost } from "./lib/instagram";
import { filterPosts, groupByMonth, historyHasPostState, postIdFromLocation, postPath } from "./lib/posts";
import { useRead } from "./lib/read";
import type { Post } from "./types";

const EMPTY: Post[] = [];
const TITLE = "塩釜菜那 部落格 中文翻譯";

/** 動態 = blog + Instagram timeline; 相簿 = every photo. */
type ListView = "feed" | "gallery";

const galleryTabFromLocation = (loc: Location = window.location) => new URLSearchParams(loc.search).get("tab") === "gallery";
/** ?src=blog|ig; the old Instagram tab link (?tab=ig) means 動態 filtered to Instagram. */
function sourceFromLocation(loc: Location = window.location): Source {
  const v = new URLSearchParams(loc.search).get("src");
  if (v === "blog" || v === "ig") return v;
  return igTabFromLocation(loc) ? "ig" : "all";
}
/** URL for a list view: 動態 is "/", 相簿 is ?tab=gallery; &src= and &date= survive reload and Back. */
function listPath(view: ListView, src: Source, date: string | null): string {
  const q = new URLSearchParams();
  if (view === "gallery") q.set("tab", "gallery");
  if (src !== "all") q.set("src", src);
  if (date) q.set("date", date);
  const qs = q.toString();
  return qs ? `/?${qs}` : "/";
}
const viewFromLocation = (): ListView => (galleryTabFromLocation() ? "gallery" : "feed");
const countBy = <T extends { kind: "blog" | "ig" }>(list: T[]): Record<Source, number> => ({
  all: list.length,
  blog: list.filter((i) => i.kind === "blog").length,
  ig: list.filter((i) => i.kind === "ig").length,
});

export default function App() {
  const state = usePosts();
  const posts = state.status === "ready" ? state.posts : EMPTY;
  const { mark, isRead } = useRead();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ListView>(viewFromLocation);
  const [source, setSource] = useState<Source>(sourceFromLocation);
  const [date, setDate] = useState<string | null>(dateFromLocation);
  const ig = useInstagram();
  const [igCode, setIgCode] = useState<string | null>(() => igCodeFromLocation());
  const igVisible = useMemo(() => filterIg(ig.posts, query), [ig.posts, query]);
  const igIdx = igCode ? ig.posts.findIndex((p) => p.code === igCode) : -1;
  const igActive = igIdx >= 0 ? ig.posts[igIdx] : null;
  const [activeId, setActiveId] = useState<string | null>(null);
  const listScroll = useRef(0);

  const visible = useMemo(() => filterPosts(posts, query), [posts, query]);
  const effSource: Source = ig.posts.length ? source : "blog";

  // 動態: blog + Instagram posts, filtered by source, then by date (snapped to the nearest date with posts).
  const feedAll = useMemo(() => feedItems(visible, igVisible), [visible, igVisible]);
  const feedSrc = useMemo(() => (effSource === "all" ? feedAll : feedAll.filter((i) => i.kind === effSource)), [feedAll, effSource]);
  const feedDates = useMemo(() => uniqueDates(feedSrc.map((i) => i.post_date)), [feedSrc]);
  const feedDate = nearestDate(feedDates, date);
  const feedShown = useMemo(() => (feedDate ? feedSrc.filter((i) => i.post_date === feedDate) : feedSrc), [feedSrc, feedDate]);
  const feedCounts = useMemo(() => countBy(feedDate ? feedAll.filter((i) => i.post_date === feedDate) : feedAll), [feedAll, feedDate]);
  const months = useMemo(() => groupByMonth(feedShown), [feedShown]);

  // 相簿: blog + Instagram photos, same filters.
  const galleryAll = useMemo(() => galleryItems(visible, igVisible), [visible, igVisible]);
  const gallerySrc = useMemo(
    () => (effSource === "all" ? galleryAll : galleryAll.filter((i) => i.kind === effSource)),
    [galleryAll, effSource],
  );
  const galleryDates = useMemo(() => uniqueDates(gallerySrc.map((i) => i.post_date)), [gallerySrc]);
  const galleryDate = nearestDate(galleryDates, date);
  const galleryShown = useMemo(
    () => (galleryDate ? gallerySrc.filter((i) => i.post_date === galleryDate) : gallerySrc),
    [gallerySrc, galleryDate],
  );
  const galleryCounts = useMemo(
    () => countBy(galleryDate ? galleryAll.filter((i) => i.post_date === galleryDate) : galleryAll),
    [galleryAll, galleryDate],
  );

  const idx = activeId ? posts.findIndex((p) => p.id === activeId) : -1;
  const active = idx >= 0 ? posts[idx] : null;

  // Old Instagram tab links (?tab=ig) now open 動態 filtered to Instagram.
  useEffect(() => {
    if (igTabFromLocation() && !igCodeFromLocation()) history.replaceState(null, "", listPath("feed", "ig", dateFromLocation()));
  }, []);

  useEffect(() => {
    const sync = () => {
      setIgCode(igCodeFromLocation());
      if (!postIdFromLocation() && !igCodeFromLocation()) {
        setView(viewFromLocation());
        setSource(sourceFromLocation());
        setDate(dateFromLocation());
      }
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useLayoutEffect(() => {
    if (igCode) window.scrollTo(0, 0);
    else window.scrollTo(0, listScroll.current);
  }, [igCode]);

  // Keep the current list URL in a ref so Back fallbacks (no in-app history) return to the same filters.
  const listUrl = useRef("/");
  listUrl.current = listPath(view, source, date);

  const openIg = useCallback((p: IgPost) => {
    if (!igCodeFromLocation() && !postIdFromLocation()) listScroll.current = window.scrollY;
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
    // With an in-app history entry, Back returns to the feed or 相簿 it was opened from; popstate restores the filters.
    if (history.state && typeof history.state === "object" && "ig" in history.state) history.back();
    else history.replaceState(null, "", listUrl.current);
  }, []);

  const replaceUrl = (want: string) => {
    if (window.location.pathname + window.location.search !== want) history.replaceState(null, "", want);
  };

  const selectView = useCallback(
    (v: ListView) => {
      setView(v);
      replaceUrl(listPath(v, source, date));
    },
    [source, date],
  );

  const selectSource = useCallback(
    (src: Source) => {
      setSource(src);
      replaceUrl(listPath(view, src, date));
    },
    [view, date],
  );

  const selectDate = useCallback(
    (d: string | null) => {
      setDate(d);
      replaceUrl(listPath(view, source, d));
    },
    [view, source],
  );

  useEffect(() => {
    if (!igCode) return;
    document.title = igActive ? `Instagram ${igActive.dateLabel}｜${TITLE}` : `Instagram｜${TITLE}`;
  }, [igCode, igActive]);

  useEffect(() => {
    if (igCode) return;
    document.title = active
      ? `${active.title_zh}｜${TITLE}`
      : state.status === "ready" && activeId && state.settled
        ? `找不到這篇文章｜${TITLE}`
        : TITLE;
  }, [active, activeId, state.status, state.settled, igCode]);

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
    if (!postIdFromLocation() && !igCodeFromLocation()) listScroll.current = window.scrollY;
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
      else history.replaceState(null, "", listUrl.current);
    }
  }, [activeId]);

  const latest = posts[0]?.dateLabel ?? "";
  const filtered = Boolean(query);
  const isGallery = view === "gallery";
  const shownCount = isGallery ? galleryShown.length : feedShown.length;
  const unit = isGallery ? "張照片" : "則動態";

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

        <main id="main" aria-busy={state.status === "loading" || !state.settled}>
        {igCode &&
          (igActive ? (
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
              actionLabel="返回動態"
              onAction={backIg}
            />
          ) : (
            <PostSkeleton />
          ))}
        {!igCode && state.status === "loading" && (postIdFromLocation() ? <PostSkeleton /> : <FeedSkeleton view={view} />)}
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
            {activeId && !active && (state.settled ? (
              <StatusPage
                title="找不到這篇文章"
                message="這個連結沒有對應的文章，可能已經下架或網址有誤。"
                actionLabel="返回動態"
                onAction={back}
              />
            ) : (
              <PostSkeleton />
            ))}
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
                        className={"chip" + (view === "feed" ? " current" : "")}
                        aria-selected={view === "feed"}
                        onClick={() => selectView("feed")}
                      >
                        動態
                      </button>
                      <button
                        type="button"
                        role="tab"
                        className={"chip" + (isGallery ? " current" : "")}
                        aria-selected={isGallery}
                        onClick={() => selectView("gallery")}
                      >
                        相簿
                      </button>
                    </div>
                    <div className="toolbar-row filter-row">
                      {ig.posts.length > 0 && (
                        <SourceFilter
                          source={effSource}
                          counts={isGallery ? galleryCounts : feedCounts}
                          onSource={selectSource}
                          label={isGallery ? "照片來源" : "動態來源"}
                        />
                      )}
                      <DatePicker
                        dates={isGallery ? galleryDates : feedDates}
                        value={isGallery ? galleryDate : feedDate}
                        requested={date}
                        onChange={selectDate}
                        noun={isGallery ? "照片" : "動態"}
                      />
                    </div>
                  </div>
                  <p className="result-count" aria-live="polite">
                    {filtered || (isGallery ? galleryDate : feedDate) ? `找到 ${shownCount} ${unit}` : `共 ${shownCount} ${unit}`}
                    <span className="sort-note">・依發文日期由新到舊</span>
                  </p>
                  {isGallery ? (
                    <PhotoGallery items={galleryShown} source={effSource} onOpenPost={open} onOpenIg={openIg} />
                  ) : feedShown.length ? (
                    months.map((m) => (
                      <section key={m.key} className="month-section" aria-labelledby={`month-${m.key}`}>
                        <h2 className="month-heading" id={`month-${m.key}`}>
                          {m.label}
                          <span className="month-count">（{m.count}）</span>
                        </h2>
                        <ul className="list">
                          {m.items.map((it) => {
                            const priority = feedShown.indexOf(it) < 3;
                            return it.kind === "blog" ? (
                              <PostCard key={it.key} post={it.post} onOpen={open} read={isRead(it.post)} priority={priority} />
                            ) : (
                              <IgCard key={it.key} post={it.ig} onOpen={openIg} priority={priority} />
                            );
                          })}
                        </ul>
                      </section>
                    ))
                  ) : (
                    <div className="empty" role="status">
                      <p>找不到符合的動態。</p>
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
