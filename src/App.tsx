import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import BackToTop from "./components/BackToTop";
import PostCard from "./components/PostCard";
import PostView from "./components/PostView";
import SearchBar from "./components/SearchBar";
import { usePosts } from "./hooks";
import { filterPosts, historyHasPostState, postIdFromLocation, postPath } from "./lib/posts";
import { useRead } from "./lib/read";
import type { Post } from "./types";

const EMPTY: Post[] = [];
const TITLE = "塩釜菜那 部落格 中文翻譯";

export default function App() {
  const state = usePosts();
  const posts = state.status === "ready" ? state.posts : EMPTY;
  const { mark, isRead } = useRead();
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const listScroll = useRef(0);

  const visible = useMemo(() => filterPosts(posts, query), [posts, query]);
  const idx = activeId ? posts.findIndex((p) => p.id === activeId) : -1;
  const active = idx >= 0 ? posts[idx] : null;

  useEffect(() => {
    document.title = active ? `${active.title_zh}｜${TITLE}` : TITLE;
  }, [active]);

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

        {state.status === "loading" && (
          <p className="status" role="status">
            <span className="spinner" aria-hidden="true" /> 載入文章中…
          </p>
        )}
        {state.status === "error" && (
          <p className="status error" role="alert">
            無法載入文章，請稍後再試。
          </p>
        )}

        {state.status === "ready" && (
          <>
            {state.warning && <p className="status warn">{state.warning}</p>}
            {activeId && !active && (
              <p className="status">
                找不到這篇文章。{" "}
                <button type="button" className="pill" onClick={back}>
                  返回文章列表
                </button>
              </p>
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
                  <SearchBar query={query} onQuery={setQuery} />
                  <p className="result-count" aria-live="polite">
                    {filtered ? `找到 ${visible.length} 篇文章` : `共 ${visible.length} 篇文章`}
                    <span className="sort-note">・依發文日期由新到舊</span>
                  </p>
                  {visible.length ? (
                    <ul className="list">
                      {visible.map((p) => (
                        <PostCard key={p.id} post={p} onOpen={open} read={isRead(p)} />
                      ))}
                    </ul>
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

        <footer className="site">
          <p>非官方翻譯存檔。原文與照片著作權屬於原作者及營運單位。</p>
          {latest && <p>最新文章：{latest}</p>}
        </footer>
      </div>
      <BackToTop />
    </>
  );
}
