/* ==========================================================================
   Racing colours, drawn.

   A yard that already holds its sets as artwork keeps them as PNGs in
   public/silks. These are the other kind: a set described rather than
   supplied, drawn from a spec so it stays crisp at any size and so a
   correction is a line of colour rather than a new file.

   A set is the three pieces every registered silk is — a body, two sleeves and
   a cap — each with a colour and at most one pattern on top. That vocabulary
   covers most registered colours; anything it does not cover belongs in
   public/silks as artwork.

   Everything is painted inside a clip of the garment it belongs to, so a hoop
   is a rectangle rather than a shape that has to follow the curve of a sleeve.
   ========================================================================== */

const W = 300;
const H = 400;

/* the jacket: a torso, two sleeves and a collar, drawn once */
const TORSO =
  "M112,124 L188,124 C202,129 209,141 211,161 L220,352 " +
  "C196,360 173,363 150,363 C127,363 104,360 80,352 L89,161 C91,141 98,129 112,124 Z";
const SLEEVE =
  "M112,125 C86,133 62,153 44,181 C27,208 13,249 7,293 " +
  "C21,319 45,338 74,344 C79,301 83,253 87,211 C90,177 98,146 112,125 Z";
const COLLAR = "M128,124 L150,150 L172,124 L184,130 L150,170 L116,130 Z";
const CAP = "M150,16 C177,16 195,37 195,62 C195,74 191,85 184,92 L116,92 C109,85 105,74 105,62 C105,37 123,16 150,16 Z";
const PEAK = "M109,89 C130,100 170,100 191,89 L194,97 C170,109 130,109 106,97 Z";

const LINE = "#1b1b1b";
const mirror = `translate(${W},0) scale(-1,1)`;

/* --------------------------------- patterns -------------------------------- */

/* Each returns what is painted over a flat colour, already clipped to the
   garment by the caller. Bands run across, because a hoop, an armlet and a
   hooped cap are all the same thing; stripes are the vertical case. */

const band = (colour, y, h, key) => <rect key={key} x="0" y={y} width={W} height={h} fill={colour} />;

const hoops = (colour, { from, to, count, thickness }) => {
  const span = (to - from) / (count * 2 - 1);
  return Array.from({ length: count }, (_, i) => band(colour, from + i * span * 2, thickness || span, i));
};

const stripes = (colour, count) => {
  const w = W / (count * 2 - 1);
  return Array.from({ length: count }, (_, i) => (
    <rect key={i} x={i * w * 2} y="0" width={w} height={H} fill={colour} />
  ));
};

/** A five-pointed star, centred and scaled. */
function star(cx, cy, r, colour, key) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const rad = i % 2 ? r * 0.42 : r;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return <polygon key={key} points={pts} fill={colour} />;
}

/** Stars scattered on a regular lattice, the way a starred silk reads. */
const stars = (colour, r = 20) => {
  const out = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 5; col++)
      out.push(star(26 + col * 62 + (row % 2 ? 31 : 0), 110 + row * 52, r, colour, `${row}-${col}`));
  return out;
};

/** Diamonds on a lattice — the other common all-over pattern. */
const diamonds = (colour, s = 30) => {
  const out = [];
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 6; col++) {
      const cx = col * s * 2 + (row % 2 ? s : 0);
      const cy = 90 + row * s * 1.3;
      out.push(
        <polygon
          key={`${row}-${col}`}
          points={`${cx},${cy - s} ${cx + s * 0.7},${cy} ${cx},${cy + s} ${cx - s * 0.7},${cy}`}
          fill={colour}
        />
      );
    }
  return out;
};

/** A check, for a quartered or chequered cap. */
const check = (colour, n = 4) => {
  const s = W / n;
  const out = [];
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < n; c++)
      if ((r + c) % 2) out.push(<rect key={`${r}-${c}`} x={c * s} y={r * s} width={s} height={s} fill={colour} />);
  return out;
};

const HEART =
  "M150,290 C120,263 96,243 96,215 C96,194 110,180 128,180 C139,180 147,187 150,196 " +
  "C153,187 161,180 172,180 C190,180 204,194 204,215 C204,243 180,263 150,290 Z";
const DIAMOND = "M150,160 L206,232 L150,304 L94,232 Z";

/* --------------------------------- the silk -------------------------------- */

export default function SilksArt({ spec, size = 44, title, className = "" }) {
  const {
    id = "s",
    body = "#ffffff",
    bodyPattern = "plain",
    bodyAlt = "#000000",
    collar,
    sleeves = body,
    sleevePattern = "plain",
    sleeveAlt = bodyAlt,
    cap = body,
    capPattern = "plain",
    capAlt = bodyAlt,
    text = null,
    textColour = "#1b1b1b",
  } = spec || {};

  const bodyClip = `sb-${id}`;
  const sleeveClip = `ss-${id}`;
  const capClip = `sc-${id}`;
  // lettering sits on whatever device carries it
  const textY = bodyPattern === "heart" ? 236 : bodyPattern === "diamond" ? 250 : bodyPattern === "disc" ? 243 : 248;

  return (
    <svg
      className={`silks ${className}`}
      width={size * 0.75}
      height={size}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={title ? `${title} racing colours` : "Racing colours"}
    >
      {title && <title>{title}</title>}
      <defs>
        <clipPath id={bodyClip}>
          <path d={TORSO} />
        </clipPath>
        <clipPath id={sleeveClip}>
          <path d={SLEEVE} />
          <path d={SLEEVE} transform={mirror} />
        </clipPath>
        <clipPath id={capClip}>
          <path d={CAP} />
          <path d={PEAK} />
        </clipPath>
      </defs>

      {/* cap */}
      <g clipPath={`url(#${capClip})`}>
        <rect x="0" y="0" width={W} height={H} fill={cap} />
        {capPattern === "hooped" && hoops(capAlt, { from: 18, to: 100, count: 3, thickness: 12 })}
        {capPattern === "spot" && <circle cx="150" cy="56" r="16" fill={capAlt} />}
        {capPattern === "spots" && [
          <circle key="a" cx="126" cy="44" r="10" fill={capAlt} />,
          <circle key="b" cx="168" cy="58" r="10" fill={capAlt} />,
          <circle key="c" cx="134" cy="76" r="10" fill={capAlt} />,
        ]}
        {capPattern === "star" && star(150, 58, 24, capAlt, "cap")}
        {capPattern === "stripes" && stripes(capAlt, 5)}
        {capPattern === "check" && check(capAlt, 5)}
        {capPattern === "quarters" && [
          <rect key="a" x="0" y="0" width="150" height="56" fill={capAlt} />,
          <rect key="b" x="150" y="56" width="150" height="60" fill={capAlt} />,
        ]}
      </g>
      <path d={CAP} fill="none" stroke={LINE} strokeWidth="4" />
      <path d={PEAK} fill={capPattern === "plain" ? capAlt : cap} stroke={LINE} strokeWidth="4" />

      {/* sleeves, behind the body so the shoulder seam reads correctly */}
      <g clipPath={`url(#${sleeveClip})`}>
        <rect x="0" y="0" width={W} height={H} fill={sleeves} />
        {sleevePattern === "hooped" && hoops(sleeveAlt, { from: 150, to: 342, count: 5, thickness: 22 })}
        {sleevePattern === "armlet" && band(sleeveAlt, 250, 38, "a")}
        {sleevePattern === "stripes" && stripes(sleeveAlt, 11)}
        {sleevePattern === "stars" && stars(sleeveAlt, 16)}
        {sleevePattern === "diamonds" && diamonds(sleeveAlt, 26)}
      </g>
      <path d={SLEEVE} fill="none" stroke={LINE} strokeWidth="4" />
      <path d={SLEEVE} transform={mirror} fill="none" stroke={LINE} strokeWidth="4" />

      {/* body */}
      <g clipPath={`url(#${bodyClip})`}>
        <rect x="0" y="0" width={W} height={H} fill={body} />
        {bodyPattern === "hoop" && band(bodyAlt, 212, 68, "h")}
        {bodyPattern === "hoops" && hoops(bodyAlt, { from: 130, to: 360, count: 4, thickness: 32 })}
        {bodyPattern === "stripes" && stripes(bodyAlt, 7)}
        {bodyPattern === "panel" && <rect x="118" y="0" width="64" height={H} fill={bodyAlt} />}
        {bodyPattern === "sash" && <path d="M60,124 L104,124 L250,363 L198,363 Z" fill={bodyAlt} />}
        {bodyPattern === "crossbelts" && [
          <path key="a" d="M78,130 L112,118 L228,352 L190,363 Z" fill={bodyAlt} />,
          <path key="b" d="M222,130 L188,118 L72,352 L110,363 Z" fill={bodyAlt} />,
        ]}
        {bodyPattern === "cross" && [
          <rect key="a" x="122" y="150" width="56" height="190" fill={bodyAlt} />,
          <rect key="b" x="72" y="212" width="156" height="56" fill={bodyAlt} />,
        ]}
        {bodyPattern === "check" && check(bodyAlt, 5)}
        {bodyPattern === "stars" && stars(bodyAlt, 22)}
        {bodyPattern === "star" && star(150, 232, 66, bodyAlt, "body")}
        {bodyPattern === "epaulettes" && [
          <path key="a" d="M100,130 L148,145 L139,184 L91,169 Z" fill={bodyAlt} />,
          <path key="b" d="M100,130 L148,145 L139,184 L91,169 Z" transform={mirror} fill={bodyAlt} />,
        ]}
        {bodyPattern === "disc" && <circle cx="150" cy="228" r="56" fill={bodyAlt} />}
        {bodyPattern === "box" && <rect x="98" y="176" width="104" height="104" fill={bodyAlt} />}
        {bodyPattern === "heart" && <path d={HEART} fill={bodyAlt} />}
        {bodyPattern === "diamond" && <path d={DIAMOND} fill={bodyAlt} />}
      </g>
      <path d={TORSO} fill="none" stroke={LINE} strokeWidth="4" />
      <path d={COLLAR} fill={collar || body} stroke={LINE} strokeWidth="4" strokeLinejoin="round" />

      {text && (
        <text
          x="150"
          y={textY}
          textAnchor="middle"
          fontSize={text.length > 2 ? 46 : 62}
          fontWeight="800"
          fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
          fill={textColour}
        >
          {text}
        </text>
      )}
    </svg>
  );
}
