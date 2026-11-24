import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import BackToTop from "./components/BackToTop";
import PostCard from "./components/PostCard";
import PostView from "./components/PostView";
import SearchBar from "./components/SearchBar";
import { useHashPost, usePosts } from "./hooks";
import { filterPosts } from "./lib/posts";
import type { Post } from "./types";

const EMPTY: Post[] = [];
const TITLE = "塩釜菜那 部落格 中文翻譯";

export default function App() {
  const state = usePosts();
  const posts = state.status === "ready" ? state.posts : EMPTY;
  const [query, setQuery] = useState("");
  const [activeId, go] = useHashPost();
  const listScroll = useRef(0);
  const fromList = useRef(false);

  const visible = useMemo(() => filterPosts(posts, query), [posts, query]);
  const idx = activeId ? posts.findIndex((p) => p.id === activeId) : -1;
  const active = idx >= 0 ? posts[idx] : null;

  useEffect(() => {
    document.title = active ? `${active.title_zh}｜${TITLE}` : TITLE;
  }, [active]);

  // Post view starts at the top; returning to the list restores its scroll position.
  useLayoutEffect(() => {
    if (state.status !== "ready") return;
    if (activeId) window.scrollTo(0, 0);
    else window.scrollTo(0, listScroll.current);
  }, [activeId, state.status]);

  const open = (p: Post) => {
    if (!activeId) {
      listScroll.current = window.scrollY;
      fromList.current = true;
    }
    go(p.id);
  };
  const back = () => {
    if (fromList.current) {
      fromList.current = false;
      history.back();
    } else go(null);
  };

  const latest = posts[0]?.dateLabel ?? "";

  return (
    <>
      <div className="wrap" id="top">
        <header className="site">
          <p className="kicker">僕が見たかった青空</p>
          <h1>
            <a href="#" onClick={(e) => (e.preventDefault(), activeId && back())}>
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
                <button type="button" className="pill" onClick={() => go(null)}>
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
                onOpen={(p) => go(p.id)}
              />
            ) : (
              !activeId && (
                <>
                  <SearchBar query={query} onQuery={setQuery} />
                  <p className="result-count" aria-live="polite">
                    {query ? `找到 ${visible.length} 篇文章` : `共 ${visible.length} 篇文章`}
                    <span className="sort-note">・依發文日期由新到舊</span>
                  </p>
                  {visible.length ? (
                    <ul className="list">
                      {visible.map((p) => (
                        <PostCard key={p.id} post={p} onOpen={open} />
                      ))}
                    </ul>
                  ) : (
                    <p className="empty">找不到符合的文章。</p>
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
