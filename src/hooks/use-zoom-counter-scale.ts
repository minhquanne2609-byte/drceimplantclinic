import { useEffect, useState } from "react";

// Estimates the browser's page-zoom level (Ctrl +/-), independent of OS/display
// scaling: as the user zooms out, more CSS px fit in the same physical window,
// so innerWidth grows relative to outerWidth (which tracks the physical window,
// not the zoomed content). ~1 at 100% zoom, ~0.33 at 33% zoom, etc. This is a
// heuristic (a few px of browser chrome/scrollbar noise at typical window
// sizes), so callers should treat values close to 1 as "no zoom".
export function estimateBrowserZoom(): number {
  if (typeof window === "undefined" || !window.outerWidth || !window.innerWidth) return 1;
  const ratio = window.outerWidth / window.innerWidth;
  if (ratio > 0.92 && ratio < 1.1) return 1;
  return ratio;
}

// Keeps a floating panel (the service-search dropdown, the Saved plans list, …)
// readable even when the whole page is zoomed way out to see the full treatment
// plan at once. Returns a CSS transform scale that counteracts the page zoom, so
// applying `transform: scale(counterScale)` with `transformOrigin: top left`
// makes the panel render at roughly its normal, 100%-zoom size on screen no
// matter how zoomed-out the page is. Only ever scales UP (never shrinks below 1)
// and is capped so extreme zoom-out doesn't blow the panel up absurdly large.
export function useZoomCounterScale(active: boolean, maxScale = 3.5) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const update = () => {
      const zoom = estimateBrowserZoom();
      const next = zoom > 0 ? Math.min(maxScale, Math.max(1, 1 / zoom)) : 1;
      setScale(next);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [active, maxScale]);
  return active ? scale : 1;
}
