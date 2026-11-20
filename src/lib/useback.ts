"use client";
import { useEffect, useRef } from "react";

/**
 * Make the browser's Back (a swipe on a phone) close an overlay instead of leaving the page.
 * Pass `leaving` (set it true just before you navigate somewhere) so closing because of a link doesn't also step back.
 */
export function useBackToClose(open: boolean, close: () => void, leaving?: { current: boolean }) {
  const closeRef = useRef(close); closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    history.pushState({ ...(history.state ?? {}), lifeosLayer: true }, "");
    let popped = false; const pop = () => { popped = true; closeRef.current(); };
    window.addEventListener("popstate", pop);
    return () => { window.removeEventListener("popstate", pop); const skip = !!leaving?.current; if (leaving) leaving.current = false; if (!popped && !skip && history.state?.lifeosLayer) history.back(); };
  }, [open, leaving]);
}
