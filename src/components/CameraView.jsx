/* ==========================================================================
   The AI camera, drawn rather than streamed.

   There is no video in a simulator, so the stall view is rendered on a canvas
   from the same behaviour timeline the alerting engine reads. The drawing is
   deliberately camera-shaped rather than diagram-shaped: a box seen in one-point
   perspective from a unit mounted high in the corner, a lamp that falls off with
   distance, a lens that vignettes, and the sensor artefacts — noise, scanlines,
   IR cut at night — that make footage look like footage.

   What it is really demonstrating is the overlay: the identity the camera has
   settled on, its confidence, and the activity it is calling — live, or scrubbed
   back through the day.
   ========================================================================== */

import { useEffect, useRef } from "react";
import { BEHAVIOUR, behaviourAt, identityCheck } from "../lib/sim";
import { COLOURS } from "../lib/colours";
import { useWorld } from "../lib/store";
import { DEFAULT_HORSE_STYLE } from "../lib/horse-style";

const W = 640;
const H = 360;

/* The box, in one-point perspective. The far wall is the small rectangle; the
   floor, ceiling and side walls run out from its corners to the frame edge. */
const BACK = { l: 132, r: 508, t: 66, b: 236 };

const DAY = {
  wallTop: "#8a7c68",
  wallBot: "#6a5e4e",
  back: "#7d7161",
  backLine: "#655b4d",
  plank: "#6f6353",
  plankLine: "#544a3d",
  ceiling: "#4a443c",
  floor: "#b9a882",
  mat: "#5d5751",
  bedding: ["#efe6cc", "#e4d7b4", "#d8c79c"],
  metal: "#a8b0b8",
  hay: "#c7ae62",
  water: "rgba(126,186,224,0.8)",
  lamp: "rgba(255,241,205,0.30)",
  shadow: "rgba(28,20,8,0.34)",
  ink: "#eef4fa",
};

const NIGHT = {
  wallTop: "#2b3a31",
  wallBot: "#1a251e",
  back: "#233029",
  backLine: "#1a241e",
  plank: "#202c25",
  plankLine: "#161f1a",
  ceiling: "#141c17",
  floor: "#2f4034",
  mat: "#24312a",
  bedding: ["#43594479", "#3a4f3c79", "#32453479"],
  metal: "#63866f",
  water: "rgba(120,190,160,0.45)",
  hay: "#3f5742",
  lamp: "rgba(150,255,200,0.07)",
  shadow: "rgba(0,0,0,0.55)",
  ink: "#c6f5d6",
};

/* body, shade, points — the shade is the body darkened for the belly gradient */
const COAT = Object.fromEntries(
  COLOURS.map((c) => [c.id, [c.body, shade(c.body, 0.72), c.points]])
);

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const isNight = (ms) => {
  const h = new Date(ms).getHours();
  return h >= 20 || h < 6;
};

/* Depth: how big something standing at floor-y should be drawn. The far wall
   meets the floor at BACK.b, the near edge of the box is the bottom of frame. */
const depthScale = (y) => {
  const t = Math.max(0, Math.min(1, (y - BACK.b) / (H - BACK.b)));
  return 0.52 + t * 0.62;
};

/* ------------------------------ deterministic ----------------------------- */
/* the scenery must not crawl between frames, so its randomness is a hash */
const hash = (i) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/* --------------------------------- scenery -------------------------------- */

/**
 * The box itself never changes — the walls, the floor, five hundred pieces of
 * bedding and the lamp are the same in every frame of every feed. Drawing them
 * per frame per tile was most of the cost of the camera wall, so each lighting
 * state is rendered once into an offscreen canvas and blitted from then on.
 * Only the horse, the lens artefacts and the overlay are per-frame work.
 */
const rooms = new Map();
function roomFor(night) {
  const key = night ? "night" : "day";
  let cv = rooms.get(key);
  if (cv) return cv;
  cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  drawRoom(cv.getContext("2d"), night ? NIGHT : DAY, night);
  rooms.set(key, cv);
  return cv;
}

function drawRoom(ctx, P, night) {
  // ceiling
  ctx.fillStyle = P.ceiling;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(BACK.r, BACK.t);
  ctx.lineTo(BACK.l, BACK.t);
  ctx.closePath();
  ctx.fill();

  // side walls, as vertical boarding running to the vanishing point
  [
    { quad: [[0, 0], [BACK.l, BACK.t], [BACK.l, BACK.b], [0, H]], dir: -1 },
    { quad: [[W, 0], [BACK.r, BACK.t], [BACK.r, BACK.b], [W, H]], dir: 1 },
  ].forEach(({ quad, dir }) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, P.wallTop);
    g.addColorStop(1, P.wallBot);
    ctx.fillStyle = g;
    ctx.beginPath();
    quad.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();

    // plank joins, converging
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = P.plankLine;
    ctx.lineWidth = 1.2;
    const edge = dir < 0 ? 0 : W;
    const inner = dir < 0 ? BACK.l : BACK.r;
    for (let k = 0; k <= 7; k++) {
      const f = k / 7;
      const x0 = edge + (inner - edge) * f;
      ctx.beginPath();
      ctx.moveTo(x0, 0 + (BACK.t - 0) * f);
      ctx.lineTo(x0, H + (BACK.b - H) * f);
      ctx.stroke();
    }
    ctx.restore();
  });

  // far wall: concrete block, courses offset
  ctx.fillStyle = P.back;
  ctx.fillRect(BACK.l, BACK.t, BACK.r - BACK.l, BACK.b - BACK.t);
  ctx.strokeStyle = P.backLine;
  ctx.lineWidth = 1;
  const bh = 17;
  for (let y = BACK.t + bh; y < BACK.b; y += bh) {
    ctx.beginPath();
    ctx.moveTo(BACK.l, y);
    ctx.lineTo(BACK.r, y);
    ctx.stroke();
  }
  let course = 0;
  for (let y = BACK.t; y < BACK.b; y += bh, course++) {
    const off = course % 2 ? 0 : 34;
    for (let x = BACK.l + off; x < BACK.r; x += 68) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, Math.min(y + bh, BACK.b));
      ctx.stroke();
    }
  }

  // floor: rubber matting, then bedding thrown over it
  const fg = ctx.createLinearGradient(0, BACK.b, 0, H);
  fg.addColorStop(0, P.mat);
  fg.addColorStop(1, P.floor);
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(BACK.l, BACK.b);
  ctx.lineTo(BACK.r, BACK.b);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.clip();
  // mat joins running away from the lens
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1.2;
  for (let k = -3; k <= 3; k++) {
    const nx = W / 2 + k * 150;
    ctx.beginPath();
    ctx.moveTo(nx, H);
    ctx.lineTo(W / 2 + k * 52, BACK.b);
    ctx.stroke();
  }
  for (let k = 1; k <= 4; k++) {
    const f = k / 5;
    const y = BACK.b + (H - BACK.b) * f * f;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // bedding: more of it, and bigger, towards the lens
  for (let i = 0; i < 520; i++) {
    const f = hash(i * 3.1);
    const y = BACK.b + (H - BACK.b) * Math.pow(hash(i * 1.7), 0.7);
    const x = hash(i * 2.3) * W;
    const s = depthScale(y);
    ctx.fillStyle = P.bedding[i % P.bedding.length];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((f - 0.5) * 2.4);
    ctx.fillRect(0, 0, 7 * s, 1.7 * s);
    ctx.restore();
  }
  ctx.restore();

  // fittings: hay net near the left wall, drinker on the right
  drawHayNet(ctx, P, 128, 214);
  drawDrinker(ctx, P, 500, 196);

  // the lamp itself, and the cone it throws
  ctx.fillStyle = night ? "#22312a" : "#cfd6dd";
  ctx.beginPath();
  ctx.roundRect(W / 2 - 26, 20, 52, 9, 4);
  ctx.fill();
  const cone = ctx.createRadialGradient(W / 2, 28, 12, W / 2, 150, 330);
  cone.addColorStop(0, P.lamp);
  cone.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = cone;
  ctx.fillRect(0, 0, W, H);
}

function drawHayNet(ctx, P, x, y) {
  ctx.strokeStyle = P.metal;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y - 62);
  ctx.lineTo(x, y - 34);
  ctx.stroke();
  ctx.fillStyle = P.hay;
  ctx.beginPath();
  ctx.ellipse(x, y, 27, 31, 0, 0, Math.PI * 2);
  ctx.fill();
  // loose ends out of the bottom
  ctx.strokeStyle = P.hay;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 9; i++) {
    const a = -0.6 + i * 0.15;
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(a) * 18, y + 24);
    ctx.lineTo(x + Math.sin(a) * 30, y + 38 + hash(i) * 8);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 0.9;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 8, y - 29);
    ctx.lineTo(x + i * 10, y + 28);
    ctx.stroke();
  }
}

function drawDrinker(ctx, P, x, y) {
  ctx.fillStyle = P.metal;
  ctx.beginPath();
  ctx.roundRect(x - 26, y - 14, 52, 26, 6);
  ctx.fill();
  ctx.fillStyle = P.water;
  ctx.beginPath();
  ctx.ellipse(x, y - 4, 19, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = P.metal;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 18, y - 14);
  ctx.lineTo(x + 18, y - 32);
  ctx.stroke();
}

/* ---------------------------------- horse --------------------------------- */

/**
 * The horse.
 *
 * At this size the thing that makes a shape read as a horse is not detail, it
 * is anatomy: a topline that rises to the withers, dips through the back and
 * rises again over the croup; a barrel that is deep at the girth and tucks up
 * at the flank; a hind leg that angles back at the hock while the foreleg
 * drops straight; and a head with a flat profile and a jaw. Three overlapping
 * ellipses never read as any of that.
 *
 * So the body is one silhouette, the legs are jointed chains, and the shading
 * is a lit topline over a dark belly with the points darker again — which is
 * how a bay actually looks under a barn light.
 *
 * The horse faces left. Everything is drawn in a space where the hooves stand
 * on y = 0 and the withers are about 160 above them.
 */

/** A leg as a chain of tapering segments — the joints are what sell it. */
function drawLeg(ctx, colour, pts, widths) {
  ctx.strokeStyle = colour;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < pts.length - 1; i++) {
    ctx.lineWidth = widths[i];
    ctx.beginPath();
    ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
    ctx.stroke();
  }
  const [hx, hy] = pts[pts.length - 1];
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(hx - 6.5, hy - 9);
  ctx.lineTo(hx + 6.5, hy - 9);
  ctx.lineTo(hx + 7.5, hy);
  ctx.lineTo(hx - 7.5, hy);
  ctx.closePath();
  ctx.fill();
}

/** The near foreleg: shoulder, knee, cannon, fetlock, hoof — straight down. */
function foreleg(ctx, colour, x, swing, lift, scale = 1) {
  const w = 13 * scale;
  drawLeg(
    ctx,
    colour,
    [
      [x, -84 + lift],
      [x + swing * 0.3, -46],
      [x + swing * 0.8, -16],
      [x + swing, 0],
    ],
    [w, w * 0.72, w * 0.62]
  );
}

/** The hind leg: the hock sits behind the stifle, which is the whole tell. */
function hindleg(ctx, colour, x, swing, lift, scale = 1) {
  const w = 15 * scale;
  drawLeg(
    ctx,
    colour,
    [
      [x - 6, -88 + lift],
      [x + 14, -50],
      [x + 4 + swing * 0.7, -16],
      [x + swing, 0],
    ],
    [w, w * 0.6, w * 0.55]
  );
}

/** The outline of a standing horse, closed, ready to fill or clip. */
function bodyPath(ctx, lift) {
  ctx.beginPath();
  ctx.moveTo(-90, -112 + lift); // point of shoulder
  ctx.bezierCurveTo(-94, -138 + lift, -74, -158 + lift, -46, -158 + lift); // up to the withers
  ctx.bezierCurveTo(-12, -156 + lift, 16, -148 + lift, 40, -150 + lift); // the back, dipped
  ctx.bezierCurveTo(62, -152 + lift, 86, -154 + lift, 100, -138 + lift); // over the croup
  ctx.bezierCurveTo(112, -124 + lift, 112, -100 + lift, 100, -82 + lift); // point of buttock
  ctx.bezierCurveTo(92, -70 + lift, 74, -68 + lift, 54, -74 + lift); // the flank, tucked up
  ctx.bezierCurveTo(26, -70 + lift, -2, -66 + lift, -28, -68 + lift); // belly, deepest behind the girth
  ctx.bezierCurveTo(-48, -70 + lift, -62, -76 + lift, -72, -88 + lift); // elbow
  ctx.bezierCurveTo(-82, -96 + lift, -88, -102 + lift, -90, -112 + lift);
  ctx.closePath();
}

/**
 * The finish over the flat body colour.
 *
 * Everything here is clipped to the body, so a highlight is a rectangle and
 * the silhouette does the work. What a horse actually looks like under a barn
 * light is: a bright line along the back, deep shadow under the barrel, and
 * the shoulder and the quarters catching the light where the muscle stands
 * proud. The dapple is what stops a flat colour looking like a cut-out.
 */
function finishBody(ctx, lift, mid, dark, style) {
  if (style === "vector") return;

  ctx.save();
  bodyPath(ctx, lift);
  ctx.clip();

  if (style === "studbook") {
    // drawn rather than lit: the creases an anatomical plate would show
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    const lines = [
      [[-78, -128 + lift], [-56, -96 + lift], [-46, -74 + lift]], // shoulder
      [[-40, -150 + lift], [-56, -120 + lift]], // the scapula
      [[56, -146 + lift], [48, -108 + lift], [54, -78 + lift]], // the flank
      [[92, -128 + lift], [78, -100 + lift], [74, -82 + lift]], // the gaskin
      [[-20, -70 + lift], [30, -70 + lift]], // the line of the belly
    ];
    lines.forEach((pts) => {
      ctx.beginPath();
      ctx.moveTo(...pts[0]);
      pts.slice(1).forEach((pt) => ctx.lineTo(...pt));
      ctx.stroke();
    });
    ctx.restore();
    bodyPath(ctx, lift);
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 3;
    ctx.stroke();
    return;
  }

  // painted and footage: muscle, then a rim light, then shadow underneath
  const blob = (cx, cy, r, k, a) => {
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    g.addColorStop(0, shade(mid, k));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.fillRect(-130, -190 + lift, 260, 200);
    ctx.globalAlpha = 1;
  };
  blob(66, -126 + lift, 62, 1.16, 0.85); // the quarters
  blob(-62, -124 + lift, 52, 1.12, 0.8); // the shoulder
  blob(84, -92 + lift, 34, 0.84, 0.5); // under the stifle
  blob(-16, -78 + lift, 56, 0.78, 0.55); // under the barrel

  // the dapple a horse in condition carries over the ribs and the quarters —
  // small and faint, or it reads as mud rather than as a coat
  ctx.globalAlpha = 0.055;
  ctx.fillStyle = shade(mid, 1.35);
  for (let i = 0; i < 34; i++) {
    const a = hash(i * 7 + 3);
    const b = hash(i * 13 + 5);
    ctx.beginPath();
    ctx.ellipse(-70 + a * 170, -142 + lift + b * 58, 3.4 + a * 1.8, 3 + b * 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // the light along the back, and the dark along the belly
  const rim = ctx.createLinearGradient(0, -166 + lift, 0, -134 + lift);
  rim.addColorStop(0, "rgba(255,248,232,0.3)");
  rim.addColorStop(1, "rgba(255,248,232,0)");
  ctx.fillStyle = rim;
  ctx.fillRect(-130, -170 + lift, 260, 42);
  const under = ctx.createLinearGradient(0, -92 + lift, 0, -62 + lift);
  under.addColorStop(0, "rgba(0,0,0,0)");
  under.addColorStop(1, "rgba(0,0,0,0.34)");
  ctx.fillStyle = under;
  ctx.fillRect(-130, -96 + lift, 260, 40);
  ctx.restore();
}

/* A camera does not draw clean edges. The footage style renders the horse to
   its own canvas and then lays it down soft and grained, which is what makes a
   frame read as a camera rather than as a picture of one. */
let soften = null;
function softenInto(ctx, draw) {
  if (!soften) {
    soften = typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (!soften) return draw(ctx);
    soften.width = W;
    soften.height = H;
  }
  const sc = soften.getContext("2d");
  sc.clearRect(0, 0, W, H);
  sc.save();
  draw(sc);
  sc.restore();

  ctx.save();
  ctx.filter = "blur(0.9px) saturate(0.88) contrast(0.95)";
  ctx.drawImage(soften, 0, 0);
  ctx.filter = "none";
  // sensor grain, only where the horse is
  ctx.globalCompositeOperation = "source-atop";
  ctx.restore();
}

function drawHorse(ctx, P, coat, pose, night, style = DEFAULT_HORSE_STYLE) {
  if (style === "footage") {
    softenInto(ctx, (sc) => paintHorse(sc, P, coat, pose, night, "painted"));
    return;
  }
  paintHorse(ctx, P, coat, pose, night, style);
}

function paintHorse(ctx, P, coat, pose, night, style) {
  const [mid, dark, points] = COAT[coat] || COAT.Bay;
  const { x, y, down, flat, headX, headY, headTurn, legPhase, breathe, lame, mirror } = pose;
  const s = depthScale(y);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(mirror ? -s : s, s);

  // contact shadow, soft and tight under the body
  const sh = ctx.createRadialGradient(0, 4, 4, 0, 4, down ? 130 : 108);
  sh.addColorStop(0, P.shadow);
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.ellipse(0, 4, down ? 130 : 106, down ? 20 : 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // light comes from the barn light above: lit along the back, dark underneath
  const body = ctx.createLinearGradient(0, -168, 0, -52);
  body.addColorStop(0, shade(mid, 1.18));
  body.addColorStop(0.42, mid);
  body.addColorStop(1, dark);

  if (down) {
    drawLying(ctx, { body, mid, dark, points }, flat, legPhase, night);
    ctx.restore();
    return;
  }

  /* A horse stands about as tall under the belly as it is deep through the
     barrel. The body was sitting too low for that, which is what made it read
     short-legged, so it is lifted and the legs run the extra distance. */
  const lift = breathe - 22;
  const hy = headY - 22;
  /* head and neck together are about as long as the body. The pose says where
     the horse is looking; these put the head the right distance out in front
     and carry it nose-down, which is how a horse stands when nothing is
     happening. Behaviour poses add their own turn on top. */
  const hx = headX - 20;
  const carriage = down ? 0 : -0.16;

  // off-side legs first, darker, so the near pair reads in front of them
  const off = shade(points, 0.74);
  foreleg(ctx, off, -58, Math.sin(legPhase + 2.1) * 7, lift, 0.9);
  hindleg(ctx, off, 78, Math.sin(legPhase + 1.2) * 6, lift, 0.9);

  // the barrel
  ctx.fillStyle = body;
  bodyPath(ctx, lift);
  ctx.fill();

  finishBody(ctx, lift, mid, dark, style);

  // tail: a dock that leaves the croup, then hair falling and swinging
  const swing = Math.sin(legPhase * 0.7) * 8;
  ctx.fillStyle = points;
  ctx.beginPath();
  ctx.moveTo(94, -146 + lift);
  ctx.bezierCurveTo(112, -144 + lift, 120, -120 + lift, 118 + swing, -86 + lift);
  ctx.bezierCurveTo(117 + swing, -58, 114 + swing, -36, 108 + swing, -22);
  ctx.bezierCurveTo(104 + swing, -34, 100 + swing, -58, 99, -88 + lift);
  ctx.bezierCurveTo(97, -112 + lift, 92, -132 + lift, 86, -142 + lift);
  ctx.closePath();
  ctx.fill();

  // neck: a crest that rises off the withers and a throat line that cuts back
  // underneath it, so the neck tapers into the head instead of slabbing into it
  const nx = hx + 22;
  const ny = hy + 8;
  const crestX = -44 + (nx - -44) * 0.45;
  const crestY = -158 + lift + (ny - 26 - (-158 + lift)) * 0.3;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-50, -156 + lift); // withers
  ctx.quadraticCurveTo(crestX, crestY - 14, nx + 2, ny - 22); // the crest
  ctx.lineTo(nx + 15, ny + 15); // into the poll and the cheek
  ctx.quadraticCurveTo(crestX + 26, ny + 62, -64, -94 + lift); // the throat, cut back
  ctx.lineTo(-84, -116 + lift);
  ctx.closePath();
  ctx.fill();

  // near-side legs
  foreleg(ctx, points, -70, Math.sin(legPhase) * 9, lift - (lame ? 7 : 0));
  hindleg(ctx, points, 66, Math.sin(legPhase + 3.1) * 8, lift);

  // mane: one shape laid along the crest and falling on the near side, from
  // the withers to the poll and no further back
  ctx.fillStyle = shade(points, 0.95);
  ctx.beginPath();
  ctx.moveTo(-50, -155 + lift);
  ctx.quadraticCurveTo(crestX, crestY - 14, nx + 2, ny - 20);
  ctx.quadraticCurveTo(nx - 4, ny - 12, nx - 12, ny - 11);
  ctx.quadraticCurveTo(crestX - 4, crestY + 4, -48, -146 + lift);
  ctx.closePath();
  ctx.fill();

  drawHead(ctx, { body, mid, dark, points }, hx, hy, headTurn + carriage, night, 1.46);
  ctx.restore();
}

/** Lying down: legs folded under, or stretched flat out if cast. */
function drawLying(ctx, c, flat, legPhase, night) {
  ctx.fillStyle = c.body;
  ctx.beginPath();
  if (flat) {
    ctx.ellipse(6, -34, 108, 32, 0.03, 0, Math.PI * 2);
  } else {
    ctx.moveTo(-96, -40);
    ctx.bezierCurveTo(-92, -70, -56, -84, -10, -84);
    ctx.bezierCurveTo(44, -84, 86, -76, 104, -54);
    ctx.bezierCurveTo(116, -38, 110, -12, 86, -8);
    ctx.bezierCurveTo(40, -2, -48, -2, -84, -8);
    ctx.bezierCurveTo(-96, -12, -100, -26, -96, -40);
    ctx.closePath();
  }
  ctx.fill();

  // folded legs, or stretched out when cast
  ctx.strokeStyle = c.points;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  [-50, -22, 30, 58].forEach((lx, i) => {
    ctx.lineWidth = 12 - (i % 2) * 2;
    ctx.beginPath();
    ctx.moveTo(lx, -22);
    if (flat) {
      ctx.lineTo(lx - 44 - i * 5, -18 + (i % 2) * 10);
      ctx.lineTo(lx - 76 - i * 7, -10 + (i % 2) * 12);
    } else {
      ctx.lineTo(lx - 24, -12);
      ctx.lineTo(lx - 42, -4);
    }
    ctx.stroke();
  });

  // tail along the bedding
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(96, -48);
  ctx.quadraticCurveTo(122, -30, 110, -8);
  ctx.stroke();

  // neck and head, up if resting, flat out on the bedding if cast
  ctx.fillStyle = c.body;
  ctx.beginPath();
  if (flat) {
    ctx.moveTo(-80, -52);
    ctx.quadraticCurveTo(-130, -40, -170, -22);
    ctx.lineTo(-166, 2);
    ctx.quadraticCurveTo(-124, -8, -76, -18);
  } else {
    ctx.moveTo(-82, -74);
    ctx.quadraticCurveTo(-124, -78, -150, -106);
    ctx.lineTo(-128, -124);
    ctx.quadraticCurveTo(-106, -92, -70, -54);
  }
  ctx.closePath();
  ctx.fill();
  drawHead(ctx, c, flat ? -186 : -150, flat ? -14 : -112, flat ? 0.2 : -0.5, night);
}

/**
 * The head: a straight profile, a cheek, and a muzzle that tapers. The ears
 * are the other half of what makes a shape read as a horse, so they are drawn
 * as cones rather than triangles.
 */
function drawHead(ctx, c, x, y, turn, night, size = 1.26) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.scale(size, size);

  // ears, behind the head so they sit on the poll
  ctx.fillStyle = c.dark;
  [
    [10, -11, 0.2],
    [21, -9, -0.12],
  ].forEach(([ex, ey, tilt]) => {
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(tilt);
    ctx.beginPath();
    ctx.moveTo(-5.5, 3);
    ctx.quadraticCurveTo(-3, -18, 1, -26);
    ctx.quadraticCurveTo(6, -17, 6.5, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // the head itself: a deep cheek, a jaw that sweeps up, and a muzzle about a
  // third of that depth — a head of even depth reads as a donkey
  ctx.fillStyle = c.mid;
  ctx.beginPath();
  ctx.moveTo(15, -8); // poll
  ctx.bezierCurveTo(19, 4, 15, 17, 4, 20); // cheek, the deepest part
  ctx.bezierCurveTo(-9, 22, -26, 16, -38, 10); // the jawline, sweeping up
  ctx.bezierCurveTo(-46, 7, -50, 2, -47, -2); // the muzzle, shallow
  ctx.bezierCurveTo(-40, -8, -18, -12, -4, -14); // the straight profile
  ctx.bezierCurveTo(6, -15, 13, -13, 15, -8);
  ctx.closePath();
  ctx.fill();

  // muzzle and nostril, darker
  ctx.fillStyle = c.points;
  ctx.beginPath();
  ctx.ellipse(-45, 2, 5.5, 4.4, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(c.points, 0.45);
  ctx.beginPath();
  ctx.ellipse(-40, -1, 2.4, 1.9, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // forelock between the ears
  ctx.strokeStyle = c.points;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(12, -8);
  ctx.quadraticCurveTo(4, -6, 0, -12);
  ctx.stroke();

  // eye — catches the IR emitter at night, which is what cameras actually show
  ctx.fillStyle = night ? "rgba(190,255,215,0.92)" : "rgba(14,11,9,0.9)";
  ctx.beginPath();
  ctx.ellipse(-1, -1, night ? 3.6 : 3.1, night ? 3.2 : 2.7, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!night) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(-2, -2, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Where the horse is and what it is doing, from the behaviour state. */
function poseFor(state, t) {
  const sway = Math.sin(t * 1.1);
  const base = {
    x: 320,
    y: 306,
    headX: -156,
    headY: -178,
    down: false,
    flat: false,
    headTurn: 0,
    legPhase: t * 1.6,
    breathe: Math.sin(t * 2.2) * 1.5,
    lame: false,
    mirror: false,
  };
  switch (state) {
    case "eating":
      return { ...base, x: 238, y: 300, headX: -172, headY: -92 + sway * 4, headTurn: 0.55 };
    case "drinking":
      return { ...base, x: 418, y: 296, mirror: true, headX: -160, headY: -120, headTurn: 0.3 };
    case "resting":
      return { ...base, x: 318 + sway * 4, y: 312, down: true };
    case "cast":
      return { ...base, x: 296, y: 314, down: true, flat: true };
    case "dozing":
      return { ...base, y: 304, headY: -146, legPhase: t * 0.2, breathe: Math.sin(t * 1.2) * 2 };
    case "walking":
    case "restless":
      return { ...base, x: 320 + Math.sin(t * 0.5) * 132, y: 302 + Math.cos(t * 0.5) * 10, legPhase: t * 5, headY: -170 };
    case "flank":
      return { ...base, x: 318, headX: -26, headY: -56, headTurn: 1.6, legPhase: t * 0.6 };
    case "lame":
      return { ...base, x: 320 + Math.sin(t * 0.4) * 86, legPhase: t * 3.4, lame: true };
    default:
      return base;
  }
}

/* --------------------------------- overlay -------------------------------- */

/** Corner brackets rather than a full rectangle — how detectors actually draw. */
function bracket(ctx, x, y, w, h, colour) {
  const c = Math.min(22, w / 4, h / 4);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  [
    [x, y + c, x, y, x + c, y],
    [x + w - c, y, x + w, y, x + w, y + c],
    [x, y + h - c, x, y + h, x + c, y + h],
    [x + w - c, y + h, x + w, y + h, x + w, y + h - c],
  ].forEach(([ax, ay, bx, by, cx, cy]) => {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.stroke();
  });
}

function drawOverlay(ctx, o) {
  const { P, label, activity, conf, at, night, mismatch, pose, showBox, offline, stallName, tracking } = o;

  if (showBox && !offline) {
    const s = depthScale(pose.y);
    const w = (pose.down ? 300 : 286) * s;
    const h = (pose.down ? 104 : 196) * s;
    const bx = pose.x - w / 2;
    const by = pose.y - h - (pose.down ? -6 : 2);
    const colour = mismatch ? "#ffb020" : "#54e39c";
    bracket(ctx, bx, by, w, h, colour);

    const tag = `${label}  ${conf}%`;
    ctx.font = "600 12px ui-monospace, SFMono-Regular, Menlo, monospace";
    const tw = ctx.measureText(tag).width + 16;
    ctx.fillStyle = mismatch ? "rgba(150,88,6,0.9)" : "rgba(8,48,34,0.88)";
    ctx.beginPath();
    ctx.roundRect(bx, by - 21, tw, 19, 4);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(tag, bx + 8, by - 7.5);

    // a confidence bar, because a percentage alone is not how these read
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(bx, by + h + 5, w, 3);
    ctx.fillStyle = colour;
    ctx.fillRect(bx, by + h + 5, (w * conf) / 100, 3);

    if (tracking) {
      ctx.fillStyle = colour;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(pose.x, pose.y - h / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // top OSD: camera identity on the left, record state on the right
  ctx.font = "500 11px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, W, 22);
  ctx.fillStyle = P.ink;
  ctx.fillText(`CAM ${stallName || "—"}`.toUpperCase(), 12, 15);
  ctx.fillText(night ? "IR  1280×720  12FPS" : "HD  1280×720  12FPS", 108, 15);
  if (!offline) {
    ctx.fillStyle = "#ff4a4a";
    ctx.beginPath();
    ctx.arc(W - 62, 11, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.ink;
    ctx.fillText("REC", W - 52, 15);
  }

  // bottom strip: what the camera is calling, and the clock
  const grad = ctx.createLinearGradient(0, H - 52, 0, H);
  grad.addColorStop(0, "rgba(4,10,16,0)");
  grad.addColorStop(1, "rgba(4,10,16,0.78)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - 52, W, 52);
  ctx.fillStyle = P.ink;
  ctx.font = "600 15px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(offline ? "Camera offline" : activity, 14, H - 17);
  const clock = new Date(at).toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  ctx.font = "500 12px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(clock, W - ctx.measureText(clock).width - 14, H - 17);
}

/* ------------------------------ lens and sensor ---------------------------- */

function drawLens(ctx, night, t) {
  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, night ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.38)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);

  // sensor noise, heavier in IR where the gain is up
  ctx.globalAlpha = night ? 0.1 : 0.045;
  ctx.fillStyle = night ? "#a6ffcf" : "#ffffff";
  const frame = Math.floor(t * 12);
  for (let i = 0; i < 150; i++) {
    const x = (hash(i + frame * 7.3) * W) | 0;
    const y = (hash(i * 1.7 + frame * 3.1) * H) | 0;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  if (night) {
    // interlace, and the hot centre of the IR emitter
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    const ir = ctx.createRadialGradient(W / 2, 150, 20, W / 2, 150, 260);
    ir.addColorStop(0, "rgba(180,255,215,0.06)");
    ir.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ir;
    ctx.fillRect(0, 0, W, H);
  }

  // an occasional dropped macroblock, the way a cheap encoder does it
  if (hash(frame * 5.7) > 0.965) {
    ctx.fillStyle = night ? "rgba(140,220,180,0.1)" : "rgba(255,255,255,0.08)";
    const bx = (hash(frame) * (W - 64)) | 0;
    const by = (hash(frame * 2.1) * (H - 48)) | 0;
    ctx.fillRect(bx, by, 48, 32);
  }
}

/* -------------------------------- component ------------------------------- */

/**
 * Every feed is a full-scene canvas redraw, so a wall of them is real work. Two
 * things keep that affordable, and both matter more than the frame rate does:
 * a canvas that is scrolled out of view stops drawing, and so does every canvas
 * on the page once the tab is in the background. A feed nobody is looking at
 * costs nothing.
 */
export default function CameraView({ stall, animal, at, animate = true, fps = 12, overlay = true, height, style }) {
  const ref = useRef(null);
  const clock = useRef(0);
  const { world } = useWorld();
  const horseStyle = style || world.settings?.horseStyle || DEFAULT_HORSE_STYLE;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let raf = 0;
    let last = 0;
    let onScreen = true;
    let drawnOnce = false;

    // stop drawing when scrolled away, and when the tab is not in front
    const io =
      animate && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => (onScreen = entries[0].isIntersecting), { rootMargin: "120px" })
        : null;
    io?.observe(cv);
    const visible = () => typeof document === "undefined" || document.visibilityState === "visible";
    const onVis = () => {};
    document.addEventListener?.("visibilitychange", onVis);

    const frame = (ts) => {
      raf = requestAnimationFrame(frame);
      // a still still needs its one frame; after that, idle feeds do nothing
      if (drawnOnce && animate && (!onScreen || !visible())) return;
      if (ts - last < 1000 / fps) return;
      last = ts;
      drawnOnce = true;
      clock.current += 1 / fps;
      const t = clock.current;

      const night = isNight(at);
      const P = night ? NIGHT : DAY;
      const seg = animal ? behaviourAt(stall, animal, at) : { state: "empty" };
      const away = !animal || seg.state === "turnout";
      const offline = stall.camera === false;

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(roomFor(night), 0, 0);
      const pose = poseFor(seg.state, t);
      if (!away && !offline) drawHorse(ctx, P, animal.colour, pose, night, horseStyle);
      drawLens(ctx, night, t);

      if (offline) {
        ctx.fillStyle = "rgba(4,10,16,0.9)";
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(120,150,180,0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(W / 2 - 22, H / 2 - 22);
        ctx.lineTo(W / 2 + 22, H / 2 + 22);
        ctx.moveTo(W / 2 + 22, H / 2 - 22);
        ctx.lineTo(W / 2 - 22, H / 2 + 22);
        ctx.stroke();
      }

      if (overlay) {
        const id = animal ? identityCheck(stall, animal, at) : null;
        drawOverlay(ctx, {
          P,
          label: animal ? animal.name : "No horse assigned",
          activity: away
            ? animal
              ? "Stall empty — horse out"
              : "Stall empty"
            : BEHAVIOUR[seg.state]?.label || "Standing",
          conf: id ? id.conf : 0,
          at,
          night,
          mismatch: !!id?.mismatch,
          pose,
          showBox: !away && !!animal,
          offline,
          stallName: stall.name,
          tracking: animate,
        });
      }
    };

    raf = requestAnimationFrame(frame);
    const stopAll = () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      document.removeEventListener?.("visibilitychange", onVis);
    };
    if (!animate) {
      const stop = setTimeout(stopAll, 120);
      return () => {
        clearTimeout(stop);
        stopAll();
      };
    }
    return stopAll;
  }, [stall, animal, at, animate, fps, overlay, horseStyle]);

  return <canvas ref={ref} width={W} height={H} style={height ? { height, width: "100%" } : undefined} />;
}
