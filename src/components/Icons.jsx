/* A small hand-drawn icon set — one stroke weight, one 24px box, no dependency. */

const P = {
  dashboard: "M3 13h8V3H3v10Zm10 8h8V3h-8v18ZM3 21h8v-6H3v6Z",
  yard: "M3 21V9l9-6 9 6v12M3 13h18M9 21v-8h6v8",
  horse: "M3.2 8.6c.3 1.3.9 2.2 1.8 2.9M4.6 13c-.5 3.4-1.6 4.4-2.4 6.6M8 14.4c-.4 3.2-1.4 4.2-2.1 5.9M3.8 13.1C3 9.2 6 6.3 9.9 6.9c2 .3 3.7 1.6 5.3 3.3l5.6-2M15.2 13l2.6 1.9-2.6 1.9M11.9 14.1l2.6 1.9-2.6 1.9",
  barn: "M4 21V10l8-5 8 5v11M9 21v-6h6v6M4 14h16",
  video: "m16 10 5-3v10l-5-3v-4ZM3 7h13v10H3z",
  bell: "M18 15V10a6 6 0 1 0-12 0v5l-2 3h16l-2-3ZM10 21h4",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3 2-1-2-4-2 .8-2-1.2L15 4H9l-1 2.6-2 1.2L4 7 2 11l2 1v0l-2 1 2 4 2-.8 2 1.2L9 20h6l1-2.6 2-1.2 2 .8 2-4-2-1Z",
  logout: "M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10",
  water: "M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3Z",
  temp: "M14 14V5a2 2 0 1 0-4 0v9a4 4 0 1 0 4 0ZM12 9v6",
  air: "M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h9",
  alert: "M12 3 2 20h20L12 3Zm0 6v5m0 3v.5",
  check: "m4 12 5 5L20 6",
  close: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.5-4.5",
  chevron: "m6 9 6 6 6-6",
  left: "m14 6-6 6 6 6",
  right: "m10 6 6 6-6 6",
  edit: "M4 20h4L20 8l-4-4L4 16v4Z",
  trash: "M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13",
  play: "m7 4 12 8-12 8V4Z",
  pause: "M8 5v14M16 5v14",
  camera: "M4 8h4l2-2h4l2 2h4v11H4V8Zm8 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  grid: "M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z",
  note: "M5 4h14v12l-4 4H5V4Zm10 16v-4h4",
  stock: "M4 8 12 4l8 4v8l-8 4-8-4V8Zm8 4 8-4m-8 4v8m0-8L4 8",
  feed: "M4.8 8.6h14.4l-1.5 9.6A2.2 2.2 0 0 1 15.5 20h-7a2.2 2.2 0 0 1-2.2-1.8L4.8 8.6Zm1.6-3.2h11.2l.8 3.2H5.6l.8-3.2Z",
  clean: "M12 2.5v6.2M6 8.7h12M6.6 8.7v6.4M10.2 8.7v7.8M13.8 8.7v7.8M17.4 8.7v6.4",
  screen: "M3 5h18v11H3V5Zm6 15h6m-3-4v4",
  /* a horse's head in profile, facing left: face, muzzle, jaw, crest, ears, eye */
  head:
    "M4.3 15.4C4.1 12.6 5.4 9.6 7.7 7.1 8.7 6 9.9 5.2 11.2 4.8" +
    "C14.8 5.2 17.6 7.6 19.4 11 20.8 13.7 21.6 16.9 21.7 20.4" +
    "M4.3 15.4c-1.1.8-1.2 2.3-.2 3.1.7.6 1.7.6 2.4.1" +
    "M6.5 18.6c2.3.5 4.6-.5 6-2.4.9-1.2 1.4-2.6 1.5-4.1" +
    "M13.4 15c.9 1.9 1.3 4 1.2 6.4" +
    "M9.6 5.6 8.8 1.4l2.6 2.8M11.9 4.8l1-3.6 1.4 3.2" +
    "M9.2 10.6h.02",
  /* a box waiting for a horse */
  nobox: "M4 8h16v12H4V8Zm3-4h10M12 12v5M9.5 14.5h5",
};

/* a few icons are silhouettes rather than line work, because that is what they
   are in the wild — a jockey's helmet drawn in outline reads as a mushroom */
const FILLED = {
  helmet:
    "M12 3.3c4.3 0 7.8 3.4 8 7.7h1.6c.7 0 1.2.6 1.1 1.3-.1.6-.6 1-1.2 1H12.9" +
    "c-.3 1.6-.9 3-1.8 4-1 1.2-2.3 1.9-3.7 2-.5 0-.9-.4-.9-.9s.4-.9.9-.9" +
    "c1-.1 1.9-.6 2.6-1.4.6-.7 1.1-1.7 1.3-2.8H2.8c-.7 0-1.2-.5-1.2-1.2S2.1 11 2.8 11H4" +
    "c.2-4.3 3.7-7.7 8-7.7Z",
};

export default function Icon({ name, size = 18, stroke = 1.8, style, className }) {
  if (FILLED[name])
    return (
      <svg
        className={className}
        style={style}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <path d={FILLED[name]} />
      </svg>
    );
  const d = P[name] || P.dashboard;
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}
