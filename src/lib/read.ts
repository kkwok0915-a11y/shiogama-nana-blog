/**
 * On-device read markers only (localStorage). Nothing is sent anywhere.
 */
import { useCallback, useEffect, useState } from "react";
import type { Post } from "../types";

const KEY = "nana-blog-read";

function loadRead(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string" && x.length > 0));
  } catch {
    return new Set();
  }
}

function persist(ids: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    // Quota or private mode — ignore; the in-memory set still works for the session.
  }
}

export function useRead(): {
  ids: Set<string>;
  mark: (p: Post) => void;
  isRead: (p: Post) => boolean;
} {
  const [ids, setIds] = useState<Set<string>>(() => (typeof window === "undefined" ? new Set() : loadRead()));

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setIds(loadRead());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const mark = useCallback((p: Post) => {
    setIds((prev) => {
      if (prev.has(p.id)) return prev;
      const next = new Set(prev);
      next.add(p.id);
      persist(next);
      return next;
    });
  }, []);

  const isRead = useCallback((p: Post) => ids.has(p.id), [ids]);

  return { ids, mark, isRead };
}
