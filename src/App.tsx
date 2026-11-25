import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import BackToTop from "./components/BackToTop";
import ListSkeleton from "./components/ListSkeleton";
import MonthNav from "./components/MonthNav";
import PhotoGallery from "./components/PhotoGallery";
import PostCard from "./components/PostCard";
import PostView from "./components/PostView";
import SearchBar from "./components/SearchBar";
import StatusPage from "./components/StatusPage";
import { usePosts } from "./hooks";
import { bundledPosts, filterPosts, groupByMonth, historyHasPostState, postIdFromLocation, postPath } from "./lib/posts";
import { useRead } from "./lib/read";
import type { Post } from "./types";
import UpgradeNotice from "./components/UpgradeNotice";

const EMPTY: Post[] = [];
const TITLE = "塩釜菜那 部落格 中文翻譯";

type ListView = "list" | "gallery";

export default function App() {
  const state = usePosts();
  const posts = state.status === "ready" ? state.posts : EMPTY;
  const { mark, isRead } = useRead();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ListView>("list");
  const [activeId, setActiveId] = useState<string | null>(null);
  const listScroll = useRef(0);

  const visible = useMemo(() => filterPosts(posts, query), [posts, query]);
  const months = useMemo(() => groupByMonth(visible), [visible]);
  const idx = activeId ? posts.findIndex((p) => p.id === activeId) : -1;
  const active = idx >= 0 ? posts[idx] : null;

  useEffect(() => {
    document.title = active
      ? `${active.title_zh}｜${TITLE}`
      : state.status === "ready" && activeId
        ? `找不到這篇文章｜${TITLE}`
        : TITLE;
  }, [active, activeId, state.status]);

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
                if (activeId) back();
              }}
            >
              {TITLE}
            </a>
          </h1>
          <p className="lede">塩釜菜那官方部落格「菜那のもぜか日記」的繁體中文翻譯，最新文章在最上面。</p>
        </header>

        <main id="main" aria-busy={state.status === "loading"}>
        {state.status === "loading" && <ListSkeleton count={bundledPosts().length} />}
        {state.status === "error" && (
          <StatusPage
            title="無法載入文章"
            message="請檢查網路連線後再試一次。"
            actionLabel="再試一次"
            onAction={state.retry}
            alert
          />
        )}

        {state.status === "ready" && (
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
                        onClick={() => setView("list")}
                      >
                        文章
                      </button>
                      <button
                        type="button"
                        role="tab"
                        className={"chip" + (view === "gallery" ? " current" : "")}
                        aria-selected={view === "gallery"}
                        onClick={() => setView("gallery")}
                      >
                        相簿
                      </button>
                    </div>
                    {view === "list" && <MonthNav months={months} />}
                  </div>
                  <p className="result-count" aria-live="polite">
                    {view === "gallery"
                      ? filtered
                        ? `找到 ${visible.reduce((n, p) => n + p.photos.length, 0)} 張照片`
                        : `共 ${visible.reduce((n, p) => n + p.photos.length, 0)} 張照片`
                      : filtered
                        ? `找到 ${visible.length} 篇文章`
                        : `共 ${visible.length} 篇文章`}
                    <span className="sort-note">・依發文日期由新到舊</span>
                  </p>
                  {view === "gallery" ? (
                    <PhotoGallery posts={visible} onOpenPost={open} />
                  ) : visible.length ? (
                    months.map((m) => (
                      <section key={m.key} className="month-section" aria-labelledby={`month-${m.key}`}>
                        <h2 className="month-heading" id={`month-${m.key}`}>
                          {m.label}
                          <span className="month-count">（{m.count}）</span>
                        </h2>
                        <ul className="list">
                          {m.items.map((p) => (
                            <PostCard key={p.id} post={p} onOpen={open} read={isRead(p)} priority={visible.indexOf(p) < 3} />
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
