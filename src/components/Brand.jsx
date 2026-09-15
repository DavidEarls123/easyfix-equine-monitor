/* ==========================================================================
   Brand marks.

   Both the rail header and the watermark at the foot of the rail render one
   asset — `public/brand/easyfix-logo.svg`. Drop the official EASYFIX artwork
   in at that path and every screen follows it, watermark included.
   ========================================================================== */

const LOGO = `${import.meta.env.BASE_URL}brand/easyfix-logo.svg`;

/** The logo at the head of the navy rail. */
export function Wordmark({ compact = false }) {
  return (
    <img
      className="brand-logo"
      src={LOGO}
      alt="EASYFIX Equine"
      style={{ width: compact ? 40 : 158, height: "auto", display: "block" }}
    />
  );
}

/**
 * The watermark at the foot of the rail. The same artwork, dropped back so it
 * sits in the navy rather than on it.
 */
export function RailMark({ width = 124 }) {
  return (
    <img
      className="brand-mark"
      src={LOGO}
      alt=""
      aria-hidden="true"
      style={{ width, height: "auto", display: "block", opacity: 0.5 }}
    />
  );
}
