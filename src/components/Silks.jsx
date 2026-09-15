/* The owner's racing silks, drawn from the owner's name so the same owner is
   the same colours everywhere. A groom recognises a horse by its silks on the
   box front long before they read the name off it. */

import { noise } from "../lib/sim";

const COLOURS = [
  "#d70927", "#0d4ea0", "#f2b705", "#0f8a3c", "#ffffff", "#111827",
  "#e86a1c", "#7b2d8b", "#12a5a5", "#8c1c3a", "#c7d1da", "#f26eb0",
];
const PATTERNS = ["solid", "stripes", "hoops", "chevron", "quarters", "sash", "spots"];

/** Deterministic colours and pattern for an owner. */
export function silksOf(owner) {
  const s = String(owner || "House colours");
  const pick = (salt, list) => list[Math.floor(noise(`${s}|${salt}`) * list.length) % list.length];
  const body = pick("body", COLOURS);
  let trim = pick("trim", COLOURS);
  if (trim === body) trim = COLOURS[(COLOURS.indexOf(body) + 5) % COLOURS.length];
  return { body, trim, pattern: pick("pat", PATTERNS), cap: pick("cap", COLOURS) };
}

export default function Silks({ owner, size = 54, showCap = true }) {
  const { body, trim, pattern, cap } = silksOf(owner);
  const id = `sk${String(owner || "x").replace(/\W/g, "").slice(0, 10)}`;
  const r = 50;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.12 }} title={owner || "Owner"}>
      <svg width={size} height={size} viewBox="0 0 100 100" aria-label={`${owner || "Owner"} colours`} role="img">
        <defs>
          <clipPath id={id}>
            <circle cx="50" cy="50" r={r} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${id})`}>
          <rect width="100" height="100" fill={body} />
          {pattern === "stripes" &&
            [0, 1, 2, 3, 4].map((i) => <rect key={i} x={i * 20 + 5} y="0" width="10" height="100" fill={trim} />)}
          {pattern === "hoops" &&
            [0, 1, 2, 3, 4].map((i) => <rect key={i} x="0" y={i * 20 + 5} width="100" height="10" fill={trim} />)}
          {pattern === "chevron" &&
            [0, 1, 2].map((i) => (
              <path key={i} d={`M0 ${30 + i * 26} L50 ${5 + i * 26} L100 ${30 + i * 26} L100 ${44 + i * 26} L50 ${19 + i * 26} L0 ${44 + i * 26} Z`} fill={trim} />
            ))}
          {pattern === "quarters" && (
            <>
              <rect x="50" y="0" width="50" height="50" fill={trim} />
              <rect x="0" y="50" width="50" height="50" fill={trim} />
            </>
          )}
          {pattern === "sash" && <path d="M-10 70 L70 -10 L100 20 L20 100 Z" fill={trim} />}
          {pattern === "spots" &&
            [18, 50, 82].flatMap((x, i) =>
              [22, 55, 88].map((y, j) => <circle key={`${i}${j}`} cx={x} cy={y} r="9" fill={trim} />)
            )}
        </g>
        <circle cx="50" cy="50" r={r - 1.5} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="3" />
      </svg>
      {showCap && (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="46" fill={cap} stroke="rgba(255,255,255,0.75)" strokeWidth="6" />
        </svg>
      )}
    </span>
  );
}
