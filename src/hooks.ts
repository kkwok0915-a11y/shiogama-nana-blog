import { useCallback, useEffect, useState } from "react";
import { fetchPosts, type FetchResult } from "./lib/posts";

export type PostsState = { status: "loading" } | { status: "error"; message: string } | ({ status: "ready" } & FetchResult);

export function usePosts(): PostsState & { retry: () => void } {
  const [state, setState] = useState<PostsState>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const retry = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    fetchPosts()
      .then((r) => alive && setState({ status: "ready", ...r }))
      .catch((e: unknown) => alive && setState({ status: "error", message: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, [tick]);

  return { ...state, retry };
}
