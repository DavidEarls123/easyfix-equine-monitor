/* ==========================================================================
   The AI camera, drawn rather than streamed.

   There is no video in a simulator, so the stall view is rendered on a canvas
   from the same behaviour timeline the alerting engine reads. What it is really
   demonstrating is the overlay: the identity the camera has settled on, its
   confidence, and the activity it is calling — live or scrubbed back through
   the day.
   ========================================================================== */

import { useEffect, useRef } from "react";
import { BEHAVIOUR, behaviourAt, identityCheck } from "../lib/sim";

const DAY = {
  wall: ["#6d6152", "#5b5145"],
  wallLine: "#4a4137",
  floor: "#d8c9a6",
  bedding: "#efe4c9",
  metal: "#9fa8b2",
  hay: "#c9b268",
  shadow: "rgba(20,14,6,0.28)",
  glow: "rgba(255,236,190,0.16)",
  ink: "#f4f7fb",
};
const NIGHT = {
  wall: ["#1d3327", "#152619"],
  wallLine: "#28402f",
  floor: "#2c4634",
  bedding: "#38553d",
  metal: "#5c806a",
  hay: "#496b4c",
  shadow: "rgba(0,0,0,0.5)",
  glow: "rgba(120,255,170,0.06)",
  ink: "#c8f7d8",
};

const COAT = {
  Bay: ["#7b4b25", "#25190f"],
  "Dark Bay": ["#4d2f1c", "#1a120b"],
  Brown: ["#5d4130", "#241a12"],
  Chestnut: ["#a85b28", "#7a3f18"],
  Grey: ["#b9bcc1", "#7d838b"],
  Black: ["#2f2b28", "#151312"],
};

const W = 640;
const H = 360;

const isNight = (ms) => {
  const h = new Date(ms).getHours();
  return h >= 20 || h < 6;
};

/* --------------------------------- scenery -------------------------------- */

function drawRoom(ctx, P) {
  const g = ctx.createLinearGradient(0, 0, 0, 250);
  g.addColorStop(0, P.wall[0]);
  g.addColorStop(1, P.wall[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 250);

  ctx.strokeStyle = P.wallLine;
  ctx.lineWidth = 2;
  for (let y = 40; y < 250; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // floor and bedding
  ctx.fillStyle = P.floor;
  ctx.fillRect(0, 250, W, H - 250);
  ctx.fillStyle = P.bedding;
  for (let i = 0; i < 260; i++) {
    const x = (i * 97) % W;
    const y = 252 + ((i * 53) % (H - 254));
    ctx.fillRect(x, y, 6 + (i % 3), 2);
  }

  // overhead light
  const glow = ctx.createRadialGradient(W / 2, 20, 10, W / 2, 40, 320);
  glow.addColorStop(0, P.glow);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // hay net on the left, automatic drinker on the right
  ctx.fillStyle = P.hay;
  ctx.beginPath();
  ctx.ellipse(66, 196, 34, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = P.metal;
  ctx.lineWidth = 1.4;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(66 + i * 10, 158);
    ctx.lineTo(66 + i * 12, 234);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(66, 156);
  ctx.lineTo(66, 96);
  ctx.stroke();

  ctx.fillStyle = P.metal;
  ctx.beginPath();
  ctx.roundRect(556, 186, 62, 34, 7);
  ctx.fill();
  ctx.fillStyle = "rgba(120,190,235,0.75)";
  ctx.beginPath();
  ctx.roundRect(562, 192, 50, 12, 5);
  ctx.fill();
}

/* ---------------------------------- horse --------------------------------- */

function drawHorse(ctx, P, coat, pose) {
  const [body, points] = COAT[coat] || COAT.Bay;
  const { x, headX, headY, down, flat, headTurn, legPhase, breathe, mirror } = pose;

  ctx.save();
  ctx.translate(x, 0);
  if (mirror) ctx.scale(-1, 1); // turned to face the drinker on the far wall

  // ground shadow
  ctx.fillStyle = P.shadow;
  ctx.beginPath();
  ctx.ellipse(0, down ? 302 : 308, down ? 122 : 104, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  if (down) {
    // lying: barrel low on the bedding, legs folded (or stretched out when cast)
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 272, 106, flat ? 32 : 42, flat ? 0.04 : -0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = points;
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    [-46, -18, 26, 54].forEach((lx, i) => {
      ctx.beginPath();
      ctx.moveTo(lx, 288);
      if (flat) ctx.lineTo(lx - 64 - i * 6, 294 + (i % 2) * 8);
      else ctx.lineTo(lx - 28, 300);
      ctx.stroke();
    });
    ctx.strokeStyle = body;
    ctx.lineWidth = 32;
    ctx.beginPath();
    ctx.moveTo(-86, 262);
    ctx.lineTo(flat ? -170 : -138, flat ? 288 : 218);
    ctx.stroke();
    drawHead(ctx, body, points, flat ? -190 : -152, flat ? 294 : 206, flat ? 0.15 : -0.45);
    ctx.restore();
    return;
  }

  const lift = breathe;

  // legs go down first so the barrel sits in front of them
  ctx.strokeStyle = points;
  ctx.lineCap = "round";
  ctx.lineWidth = 12;
  const legs = [
    [-74, Math.sin(legPhase) * 10],
    [-54, Math.sin(legPhase + 2.1) * 7],
    [56, Math.sin(legPhase + 3.1) * 9],
    [80, Math.sin(legPhase + 1.2) * 7],
  ];
  legs.forEach(([lx, sw], i) => {
    const short = pose.lame && i === 0 ? 10 : 0; // the off fore barely loading
    ctx.beginPath();
    ctx.moveTo(lx, 226 + lift);
    ctx.quadraticCurveTo(lx + sw * 0.4, 268, lx + sw, 306 - short);
    ctx.stroke();
  });

  // barrel, quarters, shoulder
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 202 + lift, 92, 45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(66, 196 + lift, 44, 48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-64, 198 + lift, 40, 44, 0, 0, Math.PI * 2);
  ctx.fill();

  // tail
  ctx.strokeStyle = points;
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.moveTo(102, 172 + lift);
  ctx.quadraticCurveTo(130 + Math.sin(legPhase * 0.7) * 8, 220, 116, 274);
  ctx.stroke();

  // neck: wide at the shoulder, tapering into the head
  ctx.strokeStyle = body;
  ctx.lineCap = "round";
  const midX = (headX - 74) / 2 - 10;
  const midY = (headY + 176 + lift) / 2;
  ctx.lineWidth = 44;
  ctx.beginPath();
  ctx.moveTo(-70, 184 + lift);
  ctx.quadraticCurveTo(midX, midY, (headX - 70) / 2 + 4, (headY + 180) / 2);
  ctx.stroke();
  ctx.lineWidth = 32;
  ctx.beginPath();
  ctx.moveTo((headX - 70) / 2 + 4, (headY + 180) / 2);
  ctx.quadraticCurveTo(headX + 14, headY - 6, headX + 4, headY);
  ctx.stroke();

  // mane down the crest
  ctx.strokeStyle = points;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-66, 162 + lift);
  ctx.quadraticCurveTo(midX + 6, midY - 26, headX + 10, headY - 12);
  ctx.stroke();

  drawHead(ctx, body, points, headX, headY, headTurn);
  ctx.restore();
}

/** Head, muzzle and ear as one piece, rotated to wherever the neck ends. */
function drawHead(ctx, body, points, x, y, turn) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(-12, 2, 32, 16, -0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-36, 11, 15, 11, -0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = points;
  ctx.beginPath();
  ctx.ellipse(-44, 14, 8, 6, -0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6, -8);
  ctx.lineTo(13, -28);
  ctx.lineTo(20, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(12,10,8,0.85)";
  ctx.beginPath();
  ctx.ellipse(-6, -3, 3.4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Where the horse is and what it is doing, from the behaviour state. */
function poseFor(state, t) {
  const sway = Math.sin(t * 1.1);
  const base = {
    x: 320,
    headX: -158,
    headY: 128,
    down: false,
    flat: false,
    headTurn: 0,
    legPhase: t * 1.6,
    breathe: Math.sin(t * 2.2) * 1.6,
    lame: false,
    mirror: false,
  };
  switch (state) {
    case "eating":
      return { ...base, x: 250, headX: -176, headY: 214 + sway * 4, headTurn: 0.55 };
    case "drinking":
      return { ...base, x: 410, mirror: true, headX: -164, headY: 186, headTurn: 0.3 };
    case "resting":
      return { ...base, x: 320 + sway * 4, down: true };
    case "cast":
      return { ...base, x: 300, down: true, flat: true };
    case "dozing":
      return { ...base, x: 320, headY: 160, legPhase: t * 0.2, breathe: Math.sin(t * 1.2) * 2 };
    case "walking":
    case "restless":
      return { ...base, x: 320 + Math.sin(t * 0.5) * 140, legPhase: t * 5, headY: 138 };
    case "flank":
      return { ...base, x: 320, headX: -26, headY: 250, headTurn: 1.6, legPhase: t * 0.6 };
    case "lame":
      return { ...base, x: 320 + Math.sin(t * 0.4) * 90, legPhase: t * 3.4, lame: true };
    default:
      return base;
  }
}

/* --------------------------------- overlay -------------------------------- */

function drawOverlay(ctx, { P, label, activity, conf, at, night, mismatch, pose, showBox, offline }) {
  ctx.font = "600 15px system-ui, -apple-system, Segoe UI, sans-serif";

  if (showBox && !offline) {
    const cx = pose.x;
    const w = 310;
    const h = pose.down ? 118 : 210;
    const y = pose.down ? 228 : 106;
    ctx.strokeStyle = mismatch ? "#ffb020" : "#5ce6a5";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([16, 8]);
    ctx.strokeRect(cx - w / 2, y, w, h);
    ctx.setLineDash([]);
    const tag = `${label} · ${conf}%`;
    const tw = ctx.measureText(tag).width + 18;
    ctx.fillStyle = mismatch ? "rgba(190,110,10,0.92)" : "rgba(12,60,44,0.86)";
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, y - 26, tw, 24, 6);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(tag, cx - w / 2 + 9, y - 9);
  }

  // bottom strip: activity on the left, clock on the right
  const grad = ctx.createLinearGradient(0, H - 54, 0, H);
  grad.addColorStop(0, "rgba(4,12,20,0)");
  grad.addColorStop(1, "rgba(4,12,20,0.72)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - 54, W, 54);
  ctx.fillStyle = P.ink;
  ctx.font = "600 16px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(offline ? "Camera offline" : activity, 16, H - 18);
  const clock = new Date(at).toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  ctx.font = "500 14px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(clock, W - ctx.measureText(clock).width - 16, H - 18);
  if (night) {
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillText("IR", W - 30, 26);
  }
}

function drawNoise(ctx, night, t) {
  ctx.globalAlpha = night ? 0.09 : 0.04;
  ctx.fillStyle = night ? "#9dffc8" : "#ffffff";
  for (let i = 0; i < 90; i++) {
    const x = (i * 137 + Math.floor(t * 60) * 31) % W;
    const y = (i * 79 + Math.floor(t * 37) * 17) % H;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
  if (night) {
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  }
}

/* -------------------------------- component ------------------------------- */

export default function CameraView({ stall, animal, at, animate = true, fps = 12, overlay = true, height }) {
  const ref = useRef(null);
  const clock = useRef(0);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let raf = 0;
    let last = 0;

    const frame = (ts) => {
      raf = requestAnimationFrame(frame);
      if (ts - last < 1000 / fps) return;
      last = ts;
      clock.current += 1 / fps;
      const t = clock.current;

      const night = isNight(at);
      const P = night ? NIGHT : DAY;
      const seg = animal ? behaviourAt(stall, animal, at) : { state: "empty" };
      const away = !animal || seg.state === "turnout";
      const offline = stall.camera === false;

      ctx.clearRect(0, 0, W, H);
      drawRoom(ctx, P);
      const pose = poseFor(seg.state, t);
      if (!away && !offline) drawHorse(ctx, P, animal.colour, pose);
      drawNoise(ctx, night, t);

      if (offline) {
        ctx.fillStyle = "rgba(4,10,16,0.86)";
        ctx.fillRect(0, 0, W, H);
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
        });
      }
    };

    raf = requestAnimationFrame(frame);
    if (!animate) {
      // one frame is enough for a still — cancel after it lands
      const stop = setTimeout(() => cancelAnimationFrame(raf), 120);
      return () => {
        clearTimeout(stop);
        cancelAnimationFrame(raf);
      };
    }
    return () => cancelAnimationFrame(raf);
  }, [stall, animal, at, animate, fps, overlay]);

  return <canvas ref={ref} width={W} height={H} style={height ? { height, width: "100%" } : undefined} />;
}
