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

const COAT = {
  Bay: ["#8a5527", "#6b3f1c", "#221708"],
  "Dark Bay": ["#59371f", "#3e2515", "#170f07"],
  Brown: ["#6b4b36", "#4e3625", "#201710"],
  Chestnut: ["#b4652c", "#8f4d1f", "#6d3a15"],
  Grey: ["#c6c9ce", "#a2a8b0", "#6f757d"],
  Black: ["#38332f", "#241f1c", "#100e0d"],
};

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
 * The horse, shaded rather than flat: a lit top line, a darker belly, and the
 * points (legs, mane, tail, muzzle) darker again, which is what actually reads
 * as a horse at this size.
 */
function drawHorse(ctx, P, coat, pose, night) {
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

  const body = ctx.createLinearGradient(0, -120, 0, 10);
  body.addColorStop(0, mid);
  body.addColorStop(0.55, mid);
  body.addColorStop(1, dark);

  if (down) {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, -30, 104, flat ? 30 : 40, flat ? 0.04 : -0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = points;
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    [-44, -16, 26, 52].forEach((lx, i) => {
      ctx.beginPath();
      ctx.moveTo(lx, -14);
      if (flat) ctx.lineTo(lx - 62 - i * 6, -6 + (i % 2) * 8);
      else ctx.lineTo(lx - 26, -2);
      ctx.stroke();
    });
    ctx.strokeStyle = dark;
    ctx.lineWidth = 30;
    ctx.beginPath();
    ctx.moveTo(-84, -40);
    ctx.lineTo(flat ? -166 : -134, flat ? -12 : -82);
    ctx.stroke();
    drawHead(ctx, body, mid, points, flat ? -186 : -148, flat ? -12 : -100, flat ? 0.15 : -0.45, night);
    ctx.restore();
    return;
  }

  const lift = breathe;

  // legs first, so the barrel sits in front of them
  ctx.strokeStyle = points;
  ctx.lineCap = "round";
  const legs = [
    [-72, Math.sin(legPhase) * 9, 11],
    [-52, Math.sin(legPhase + 2.1) * 6, 10],
    [54, Math.sin(legPhase + 3.1) * 8, 11],
    [78, Math.sin(legPhase + 1.2) * 6, 10],
  ];
  legs.forEach(([lx, sw, lw], i) => {
    const short = lame && i === 0 ? 9 : 0;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(lx, -84 + lift);
    ctx.quadraticCurveTo(lx + sw * 0.4, -44, lx + sw, -2 - short);
    ctx.stroke();
    // hoof
    ctx.lineWidth = lw + 2.5;
    ctx.beginPath();
    ctx.moveTo(lx + sw, -5 - short);
    ctx.lineTo(lx + sw, -1 - short);
    ctx.stroke();
  });

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -108 + lift, 90, 43, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(64, -114 + lift, 43, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-62, -112 + lift, 39, 42, 0, 0, Math.PI * 2);
  ctx.fill();

  // tail
  ctx.strokeStyle = points;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(100, -138 + lift);
  ctx.quadraticCurveTo(126 + Math.sin(legPhase * 0.7) * 7, -92, 112, -36);
  ctx.stroke();

  // neck, wide at the shoulder and tapering into the head
  ctx.strokeStyle = mid;
  ctx.lineCap = "round";
  const midX = (headX - 72) / 2 - 10;
  const midY = (headY - 132 + lift) / 2;
  ctx.lineWidth = 42;
  ctx.beginPath();
  ctx.moveTo(-68, -126 + lift);
  ctx.quadraticCurveTo(midX, midY, (headX - 68) / 2 + 4, (headY - 128) / 2);
  ctx.stroke();
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.moveTo((headX - 68) / 2 + 4, (headY - 128) / 2);
  ctx.quadraticCurveTo(headX + 14, headY - 6, headX + 4, headY);
  ctx.stroke();

  // mane down the crest
  ctx.strokeStyle = points;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-64, -146 + lift);
  ctx.quadraticCurveTo(midX + 6, midY - 26, headX + 10, headY - 12);
  ctx.stroke();

  drawHead(ctx, body, mid, points, headX, headY, headTurn, night);
  ctx.restore();
}

function drawHead(ctx, body, mid, points, x, y, turn, night) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.fillStyle = mid;
  ctx.beginPath();
  ctx.ellipse(-12, 2, 31, 15, -0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-35, 11, 14, 10, -0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = points;
  ctx.beginPath();
  ctx.ellipse(-43, 14, 7.5, 5.5, -0.22, 0, Math.PI * 2);
  ctx.fill();
  // ears
  ctx.beginPath();
  ctx.moveTo(5, -8);
  ctx.lineTo(12, -27);
  ctx.lineTo(19, -6);
  ctx.closePath();
  ctx.fill();
  // eye — catches the IR emitter at night, which is what cameras actually show
  ctx.fillStyle = night ? "rgba(190,255,215,0.92)" : "rgba(14,11,9,0.9)";
  ctx.beginPath();
  ctx.ellipse(-6, -3, night ? 3.8 : 3.2, night ? 3.4 : 2.9, 0, 0, Math.PI * 2);
  ctx.fill();
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
export default function CameraView({ stall, animal, at, animate = true, fps = 12, overlay = true, height }) {
  const ref = useRef(null);
  const clock = useRef(0);

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
      if (!away && !offline) drawHorse(ctx, P, animal.colour, pose, night);
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
  }, [stall, animal, at, animate, fps, overlay]);

  return <canvas ref={ref} width={W} height={H} style={height ? { height, width: "100%" } : undefined} />;
}
