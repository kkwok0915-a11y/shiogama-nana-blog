import { useEffect, useState } from "react";
import { fetchPosts, type FetchResult } from "./lib/posts";

export type PostsState = { status: "loading" } | { status: "error"; message: string } | ({ status: "ready" } & FetchResult);

export function usePosts(): PostsState {
  const [state, setState] = useState<PostsState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    fetchPosts()
      .then((r) => alive && setState({ status: "ready", ...r }))
      .catch((e: unknown) => alive && setState({ status: "error", message: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/** Current `#p=<id>` from the URL hash (null on the list). */
export function useHashPost(): [string | null, (id: string | null) => void] {
  const read = () => {
    const h = window.location.hash;
    return h.startsWith("#p=") ? decodeURIComponent(h.slice(3)) || null : null;
  };
  const [id, setId] = useState<string | null>(read);
  useEffect(() => {
    const on = () => setId(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = (next: string | null) => {
    if (next) window.location.hash = "p=" + encodeURIComponent(next);
    else history.pushState(null, "", window.location.pathname + window.location.search), setId(null);
  };
  return [id, go];
}
