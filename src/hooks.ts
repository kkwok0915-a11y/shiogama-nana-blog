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
