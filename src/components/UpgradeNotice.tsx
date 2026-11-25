import { useEffect, useState } from "react";

const STORAGE_KEY = "upgrade-notice-dismissed";
const API_TIMEOUT_MS = 4000;

export default function UpgradeNotice() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const timer = window.setTimeout(() => ac.abort(), API_TIMEOUT_MS);
    fetch("/api/settings", { signal: ac.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.notice_enabled) return;
        const message = typeof data.notice_text === "string" ? data.notice_text.trim() : "";
        if (!message) return;
        try {
          if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
        } catch {
          /* private mode */
        }
        setText(message);
      })
      .catch(() => {
        /* fail closed: hide the banner if settings cannot be loaded */
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      ac.abort();
    };
  }, []);

  if (!text) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* private mode */
    }
    setText(null);
  };

  return (
    <div className="upgrade-notice" role="status">
      <p>{text}</p>
      <button type="button" className="upgrade-dismiss" aria-label="關閉" onClick={dismiss}>
        ✕
      </button>
    </div>
  );
}
