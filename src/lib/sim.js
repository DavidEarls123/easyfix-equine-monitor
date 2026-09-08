/* ==========================================================================
   Simulated sensor + camera feed.

   Nothing here talks to hardware. Every reading is derived deterministically
   from a seed built out of (stall, animal, day, hour), so the same stall shows
   the same history on every reload and on every machine — the simulation is
   reproducible rather than random, which is what makes a demo yard believable.

   Three sensor streams per stall, matching the product:
     • water flow meter  -> litres per hour, daily total against a goal
     • temperature probe -> °C in the stall
     • air quality probe -> 0-100 % score, with the ammonia reading behind it
   Plus an AI camera that produces a behaviour timeline and identity checks.
   ========================================================================== */

export const DAY_MS = 86400000;
export const HOUR_MS = 3600000;

/* ------------------------------ seeded noise ------------------------------ */

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** A repeatable stream of floats in [0,1) for a given seed string. */
export function rng(seed) {
  let a = xmur3(String(seed))();
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One repeatable float in [0,1) — the workhorse for per-hour jitter. */
export const noise = (seed) => rng(seed)();
export const between = (seed, lo, hi) => lo + noise(seed) * (hi - lo);
export const pickOne = (seed, list) => list[Math.floor(noise(seed) * list.length) % list.length];
/** Roughly normal, mean 0, sd ~1 — three uniforms is close enough for sensors. */
export const wobble = (seed) => {
  const r = rng(seed);
  return (r() + r() + r() - 1.5) * 1.6;
};

/* -------------------------------- calendar -------------------------------- */

export const dayKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const startOfDay = (ms) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
export const minutesInto = (ms) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};
export const clockOf = (mins) =>
  `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(Math.floor(mins) % 60).padStart(2, "0")}`;

/* --------------------------- outside conditions --------------------------- */

// Monthly mean outside temperature for a temperate maritime yard (°C).
const MONTH_C = [6.4, 6.6, 8.1, 9.9, 12.5, 15.1, 16.9, 16.6, 14.6, 11.7, 8.7, 7.1];

function outsideC(ms) {
  const d = new Date(ms);
  const mins = d.getHours() * 60 + d.getMinutes();
  const base = MONTH_C[d.getMonth()];
  // coldest around 05:00, warmest around 15:00
  const diurnal = -Math.cos(((mins - 300) / 1440) * Math.PI * 2) * 4.2;
  const dayShift = wobble(`out|${dayKey(ms)}`) * 2.4;
  return base + diurnal + dayShift;
}

/* ------------------------------ hourly weights ---------------------------- */

// Horses drink in bouts, mostly around feeds and after work.
const DRINK_W = [
  0.6, 0.4, 0.3, 0.3, 0.4, 0.9, 2.2, 5.6, 4.4, 3.2, 2.6, 3.1, 5.2, 4.1, 3.0, 3.3, 4.6, 6.4, 4.8, 3.4, 2.6, 2.0, 1.3, 0.9,
];
const DRINK_TOTAL = DRINK_W.reduce((a, b) => a + b, 0);

/* Horses do not drink evenly around the clock, so "behind on water" has to be
   measured against the shape of a normal day, not against the wall clock — at
   09:00 a horse is meant to be a third of the way through its day's water, not
   a third of the way through the hours. */
export function profileShare(mins) {
  const h = Math.floor(mins / 60);
  let acc = 0;
  for (let i = 0; i < Math.min(24, h); i++) acc += DRINK_W[i];
  if (h < 24) acc += DRINK_W[h] * ((mins % 60) / 60);
  return acc / DRINK_TOTAL;
}

/* -------------------------------- scenarios ------------------------------- */

/* A scenario biases a stall's simulated streams so the alerting engine has
   something real to find. `normal` is the default; the rest are the states the
   product is meant to catch. */
export const SCENARIOS = {
  normal: "Settled",
  lowIntake: "Water intake dropping",
  sensorOffline: "Flow meter offline",
  hot: "Stall running hot",
  cold: "Stall running cold",
  poorAir: "Air quality poor",
  lameness: "Gait irregularity",
  restless: "Restless / box walking",
  colic: "Colic watch",
  idMismatch: "Identity mismatch",
};

const sc = (animal) => animal?.scenario || "normal";

/* ------------------------------ sensor streams ---------------------------- */

const cache = new Map();
const CACHE_MAX = 4000;

function cached(key, make) {
  const hit = cache.get(key);
  if (hit) return hit;
  const made = make();
  if (cache.size > CACHE_MAX) cache.clear();
  cache.set(key, made);
  return made;
}

/**
 * One simulated day for a stall: 24 hourly samples plus the day's totals.
 * `dayStart` must be midnight-local of the day wanted.
 */
export function dayReadings(stall, animal, dayStart) {
  const key = `${stall.id}|${animal ? animal.id : "-"}|${dayKey(dayStart)}`;
  return cached(key, () => build(stall, animal, dayStart));
}

function build(stall, animal, dayStart) {
  const s = stall.seed || stall.id;
  const day = dayKey(dayStart);
  const scen = sc(animal);
  const offline = scen === "sensorOffline";

  // How much this horse means to drink today, before the meter sees any of it.
  const goal = animal?.goalL || 35;
  let factor = between(`f|${s}|${day}`, 0.88, 1.12);
  if (scen === "lowIntake") factor = between(`lf|${s}|${day}`, 0.38, 0.58);
  if (scen === "colic") factor = between(`cf|${s}|${day}`, 0.5, 0.72);
  if (scen === "hot") factor *= 1.18;

  const hours = [];
  let intakeSum = 0;
  for (let h = 0; h < 24; h++) {
    const at = dayStart + h * HOUR_MS;
    const hs = `${s}|${day}|${h}`;

    // temperature: outside, lifted by the building and the stall's own position
    const shelter = 2.1 + (stall.warmth || 0);
    let tempC = outsideC(at) + shelter + wobble(`t|${hs}`) * 0.5;
    if (scen === "hot") tempC += 5.4;
    if (scen === "cold") tempC -= 6.2;

    // air quality: worst overnight, recovers once the barn is mucked out
    const nightLoad = h < 8 ? 10 + (8 - h) * 1.4 : Math.max(0, 6 - (h - 8) * 0.8);
    let air = 96 - nightLoad + wobble(`a|${hs}`) * 1.6;
    if (scen === "poorAir") air -= 17;
    air = Math.max(38, Math.min(99, air));

    const humidity = Math.max(35, Math.min(95, 62 + wobble(`h|${hs}`) * 7 + (h < 7 ? 6 : 0)));
    const nh3 = Math.max(0, (100 - air) / 3.1 + noise(`n|${hs}`) * 0.4); // ppm

    // water: the day's target spread over the drinking profile, with bouts
    let intakeL = 0;
    if (!offline) {
      const w = DRINK_W[h] / DRINK_TOTAL;
      // horses drink in bouts, but not so erratically that a normal morning
      // looks like a horse gone off its water
      const bout = noise(`b|${hs}`) < 0.12 ? 0 : between(`i|${hs}`, 0.72, 1.32);
      intakeL = goal * factor * w * bout;
      if (tempC > 24) intakeL *= 1.12;
      intakeL = Math.round(intakeL * 10) / 10;
    }
    intakeSum += intakeL;

    hours.push({
      h,
      at,
      intakeL,
      tempC: Math.round(tempC * 10) / 10,
      air: Math.round(air * 10) / 10,
      humidity: Math.round(humidity),
      nh3: Math.round(nh3 * 10) / 10,
    });
  }

  const avg = (f) => hours.reduce((a, x) => a + f(x), 0) / 24;
  return {
    day,
    dayStart,
    offline,
    hours,
    goal,
    intakeL: Math.round(intakeSum * 10) / 10,
    tempC: Math.round(avg((x) => x.tempC) * 10) / 10,
    tempMax: Math.round(Math.max(...hours.map((x) => x.tempC)) * 10) / 10,
    tempMin: Math.round(Math.min(...hours.map((x) => x.tempC)) * 10) / 10,
    air: Math.round(avg((x) => x.air) * 10) / 10,
    airMin: Math.round(Math.min(...hours.map((x) => x.air)) * 10) / 10,
    humidity: Math.round(avg((x) => x.humidity)),
    nh3: Math.round(avg((x) => x.nh3) * 10) / 10,
  };
}

/** Readings so far today, cut off at `now` — the live numbers on the wall. */
export function today(stall, animal, now) {
  const start = startOfDay(now);
  const full = dayReadings(stall, animal, start);
  const mins = minutesInto(now);
  const hourNow = Math.floor(mins / 60);
  const part = mins / 60 - hourNow; // fraction through the current hour

  let intake = 0;
  let lastDrinkAt = null;
  for (let h = 0; h <= hourNow && h < 24; h++) {
    const share = h === hourNow ? part : 1;
    const l = full.hours[h].intakeL * share;
    intake += l;
    if (l > 0.25) lastDrinkAt = full.hours[h].at + Math.floor(share * 3600000 * 0.6);
  }

  const cur = full.hours[Math.min(23, hourNow)];
  return {
    ...full,
    now,
    intakeL: Math.round(intake * 10) / 10,
    expectedL: Math.round(full.goal * profileShare(mins) * 10) / 10,
    pctOfGoal: Math.round((intake / (full.goal * Math.max(0.04, profileShare(mins)))) * 100),
    dayPct: Math.round((intake / full.goal) * 100),
    lastDrinkAt,
    hoursSinceDrink: lastDrinkAt ? (now - lastDrinkAt) / HOUR_MS : mins / 60,
    tempNow: full.offline && !cur ? null : cur.tempC,
    airNow: cur.air,
    humidityNow: cur.humidity,
    nh3Now: cur.nh3,
    hoursSoFar: full.hours.slice(0, hourNow + 1),
  };
}

/** Rolling average of the previous `n` complete days (yesterday backwards). */
export function trailing(stall, animal, now, n = 6) {
  const start = startOfDay(now);
  let intake = 0;
  let temp = 0;
  let air = 0;
  const days = [];
  for (let i = n; i >= 1; i--) {
    const d = dayReadings(stall, animal, start - i * DAY_MS);
    intake += d.intakeL;
    temp += d.tempC;
    air += d.air;
    days.push(d);
  }
  return {
    days,
    intakeL: Math.round((intake / n) * 10) / 10,
    tempC: Math.round((temp / n) * 10) / 10,
    air: Math.round((air / n) * 10) / 10,
  };
}

/* ------------------------------- the camera ------------------------------- */

export const BEHAVIOUR = {
  resting: { label: "Lying / resting", tone: "flat" },
  dozing: { label: "Dozing", tone: "flat" },
  standing: { label: "Standing", tone: "flat" },
  eating: { label: "Eating", tone: "good" },
  drinking: { label: "Drinking", tone: "good" },
  walking: { label: "Moving about", tone: "flat" },
  turnout: { label: "Out — turnout / exercise", tone: "flat" },
  restless: { label: "Restless — box walking", tone: "warning" },
  flank: { label: "Flank watching", tone: "serious" },
  cast: { label: "Lying flat, extended", tone: "critical" },
  lame: { label: "Uneven weight bearing", tone: "serious" },
};

const seg = (from, to, state, note) => ({ from, to, state, note });

/**
 * The camera's read of a stall for one day, as a list of minute-ranges.
 * Feeds both the live view and the playback timeline.
 */
export function behaviourDay(stall, animal, dayStart) {
  const key = `beh|${stall.id}|${animal ? animal.id : "-"}|${dayKey(dayStart)}`;
  return cached(key, () => buildBehaviour(stall, animal, dayStart));
}

function buildBehaviour(stall, animal, dayStart) {
  if (!animal) return [seg(0, 1440, "standing", "Stall empty")];
  const s = `${stall.id}|${animal.id}|${dayKey(dayStart)}`;
  const scen = sc(animal);
  const out = [];

  // night: long lying spells broken by standing
  let t = 0;
  while (t < 330) {
    const lie = Math.round(between(`lie|${s}|${t}`, 35, 85));
    out.push(seg(t, Math.min(330, t + lie), "resting"));
    t += lie;
    const up = Math.round(between(`up|${s}|${t}`, 15, 40));
    out.push(seg(t, Math.min(330, t + up), "dozing"));
    t += up;
  }

  // the yard's working day: feeds around 07:00, 12:00 and 17:00. Each box is
  // shifted a little — the wall of cameras should not show thirty horses eating
  // in perfect time with each other.
  const shift = Math.round(between(`fs|${s}`, -40, 40));
  const feeds = [420 + shift, 720 + shift, 1020 + shift];
  out.push(seg(330, feeds[0], "standing"));
  feeds.forEach((f, i) => {
    const meal = Math.round(between(`ml|${s}|${i}`, 38, 68));
    out.push(seg(f, f + meal, "eating"));
    out.push(seg(f + meal, f + meal + Math.round(between(`dr|${s}|${i}`, 5, 11)), "drinking"));
    // fill the gap to the next feed with a mix of standing about and dozing
    let t2 = f + meal + 12;
    const next = feeds[i + 1] || 1320;
    let k = 0;
    while (t2 < next) {
      const len = Math.round(between(`gp|${s}|${i}|${k}`, 25, 90));
      const state = noise(`gs|${s}|${i}|${k}`) > (i === 2 ? 0.35 : 0.6) ? "dozing" : "standing";
      out.push(seg(t2, Math.min(next, t2 + len), state));
      t2 += len;
      k++;
    }
  });
  out.push(seg(1320, 1440, "resting"));

  // a few short pottering spells so the timeline is not a block of one colour
  for (let i = 0; i < 5; i++) {
    const at = Math.round(between(`w|${s}|${i}`, 340, 1300));
    out.push(seg(at, at + Math.round(between(`wl|${s}|${i}`, 6, 18)), "walking"));
  }

  // most horses go out for part of the morning — laid over the pottering so it
  // reads as one absence rather than three
  const goesOut = noise(`out|${s}`) > 0.35;
  if (goesOut) {
    const from = Math.round(between(`ot|${s}`, 540, 600));
    out.push(seg(from, from + Math.round(between(`ol|${s}`, 90, 170)), "turnout"));
  }

  // scenario overlays — the things the product is watching for
  if (scen === "restless") {
    for (let i = 0; i < 6; i++) {
      const at = Math.round(between(`r|${s}|${i}`, 1, 1400));
      out.push(seg(at, at + Math.round(between(`rl|${s}|${i}`, 18, 46)), "restless", "Repeated circling of the box"));
    }
  }
  if (scen === "colic") {
    for (let i = 0; i < 4; i++) {
      const at = Math.round(between(`c|${s}|${i}`, 60, 1380));
      out.push(seg(at, at + Math.round(between(`cl|${s}|${i}`, 12, 34)), "flank", "Turning to flank, pawing"));
    }
    const castAt = Math.round(between(`cast|${s}`, 180, 1200));
    out.push(seg(castAt, castAt + Math.round(between(`castl|${s}`, 16, 30)), "cast", "Down and extended, rolling"));
  }
  if (scen === "lameness") {
    for (let i = 0; i < 5; i++) {
      const at = Math.round(between(`lm|${s}|${i}`, 340, 1320));
      out.push(seg(at, at + Math.round(between(`lml|${s}|${i}`, 8, 22)), "lame", "Reduced loading, off fore"));
    }
  }

  // later entries win, so overlays sit on top of the base day
  return flatten(out);
}

function flatten(segments) {
  const marks = new Array(1441).fill(null);
  segments.forEach((g) => {
    for (let m = Math.max(0, Math.round(g.from)); m < Math.min(1440, Math.round(g.to)); m++) {
      marks[m] = { state: g.state, note: g.note };
    }
  });
  const out = [];
  let cur = null;
  for (let m = 0; m < 1440; m++) {
    const v = marks[m] || { state: "standing" };
    if (!cur || cur.state !== v.state) {
      if (cur) out.push(cur);
      cur = { from: m, to: m + 1, state: v.state, note: v.note };
    } else cur.to = m + 1;
  }
  if (cur) out.push(cur);
  return out;
}

/** What the camera says is happening right now. */
export function behaviourAt(stall, animal, ms) {
  const segs = behaviourDay(stall, animal, startOfDay(ms));
  const m = minutesInto(ms);
  return segs.find((g) => m >= g.from && m < g.to) || segs[segs.length - 1];
}

/** Notable camera moments for a day — what shows on the playback timeline. */
export function cameraEvents(stall, animal, dayStart) {
  if (!animal) return [];
  const key = `ev|${stall.id}|${animal.id}|${dayKey(dayStart)}`;
  return cached(key, () => {
    const segs = behaviourDay(stall, animal, dayStart);
    const out = [];
    segs.forEach((g) => {
      const mins = g.to - g.from;
      const at = dayStart + g.from * 60000;
      const conf = Math.round(between(`cf|${stall.id}|${g.from}`, 88, 99) * 10) / 10;
      if (g.state === "cast")
        out.push({ at, mins, severity: "critical", kind: "cast", title: "Down and rolling", detail: g.note || "Lying flat with rolling, repeated", conf });
      else if (g.state === "flank")
        out.push({ at, mins, severity: "serious", kind: "flank", title: "Flank watching", detail: g.note || "Turning to the flank", conf });
      else if (g.state === "lame")
        out.push({ at, mins, severity: "serious", kind: "lame", title: "Uneven weight bearing", detail: g.note || "Reduced loading on the off fore", conf });
      else if (g.state === "restless" && mins > 20)
        out.push({ at, mins, severity: "warning", kind: "restless", title: "Box walking", detail: g.note || "Circling the box repeatedly", conf });
      else if (g.state === "resting" && mins > 70)
        out.push({ at, mins, severity: "info", kind: "rest", title: "Long rest", detail: `Lying for ${mins} minutes`, conf });
      else if (g.state === "drinking")
        out.push({ at, mins, severity: "info", kind: "drink", title: "Drinking", detail: "Flow meter and camera agree", conf });
      else if (g.state === "turnout" && mins > 20)
        out.push({ at, mins, severity: "info", kind: "turnout", title: "Left the stall", detail: "Turnout / exercise", conf });
    });
    return out.sort((a, b) => a.at - b.at);
  });
}

/** The camera's identity check for a stall: who it thinks is standing there. */
export function identityCheck(stall, animal, now) {
  if (!animal) return null;
  const conf = Math.round(between(`id|${stall.id}|${dayKey(now)}`, 93.5, 99.4) * 10) / 10;
  // the camera reports the horse it recognises; `seenAs` is set when a horse
  // has been moved between boxes without the app being told
  const mismatch = !!animal.seenAs;
  return {
    conf: mismatch ? Math.round(between(`idm|${stall.id}`, 88, 96) * 10) / 10 : conf,
    seen: mismatch ? animal.seenAs || null : animal.id,
    mismatch,
    at: now - Math.round(between(`ids|${stall.id}|${dayKey(now)}`, 4, 55)) * 60000,
  };
}
