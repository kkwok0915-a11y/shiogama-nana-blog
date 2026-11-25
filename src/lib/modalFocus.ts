import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if (el.hasAttribute("disabled") || el.getAttribute("aria-hidden") === "true") return false;
    if (el.tagName === "IFRAME") return true;
    return el.getClientRects().length > 0;
  });
}

/**
 * Restore focus to the control that opened a <dialog>, and keep Tab inside it
 * (native showModal already traps in modern browsers; this covers the rest).
 */
export function useDialogFocus(open: boolean, ref: RefObject<HTMLDialogElement | null>): void {
  const prev = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    prev.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const el = prev.current;
      if (el && document.contains(el)) {
        try {
          el.focus();
        } catch {
          /* unmounted */
        }
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const d = ref.current;
    if (!d) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = focusables(d);
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !d.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !d.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    d.addEventListener("keydown", onKey);
    return () => d.removeEventListener("keydown", onKey);
  }, [open, ref]);
}
