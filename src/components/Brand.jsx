/* ==========================================================================
   Brand marks.

   Two assets, both swappable without touching code:

     public/brand/easyfix-logo.svg   the wordmark, at the head of the navy rail
     public/brand/easyfix-mark.svg   the symbol alone — the jumping horse —
                                     used as the watermark at the foot of the
                                     rail. If it is missing, the watermark
                                     falls back to the wordmark.

   Both sit on navy, so reverse artwork is the right variant for each.
   ========================================================================== */

import { useState } from "react";

const BASE = import.meta.env.BASE_URL;
const LOGO = `${BASE}brand/easyfix-logo.svg`;
const MARK = `${BASE}brand/easyfix-mark.svg`;

/** The logo at the head of the navy rail. */
export function Wordmark({ compact = false }) {
  return (
    <img
      className="brand-logo"
      src={LOGO}
      alt="EASYFIX Equine"
      style={{ width: compact ? 44 : 168, height: "auto", display: "block" }}
    />
  );
}

/**
 * The watermark at the foot of the rail. Prefers the symbol on its own, which
 * is what reads at this size; the wordmark repeated is only the fallback.
 */
export function RailMark({ width = 104 }) {
  const [src, setSrc] = useState(MARK);
  const isFallback = src === LOGO;
  return (
    <img
      className="brand-mark"
      src={src}
      alt=""
      aria-hidden="true"
      onError={() => setSrc(LOGO)}
      style={{
        width: isFallback ? width + 24 : width,
        height: "auto",
        display: "block",
        opacity: isFallback ? 0.4 : 0.85,
      }}
    />
  );
}
