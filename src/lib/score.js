/* ==========================================================================
   The welfare index.

   Every screen in this app shows one dimension of a horse at a time — litres,
   degrees, a camera calling a behaviour. A yard with three hundred boxes cannot
   read six numbers per horse at six in the morning, so this collapses them into
   one: a 0–100 welfare index per animal, and the direction it is moving in.

   Three rules the rest of the app depends on:

   1. Every component scores 0–100 on its own terms, so a weight change moves
      the headline predictably and the contribution of each input stays legible.
   2. A component with no data is dropped and the remaining weights are
      renormalised, rather than scored as zero. A flow meter that has failed is
      missing information, not a dehydrated horse — that distinction is carried
      separately as `confidence`.
   3. Weights are whatever the customer sets. They are normalised at read time,
      so the sliders in Settings never have to add up to anything in particular.
   ========================================================================== */

import { cameraEvents, startOfDay, DAY_MS, dayReadings, today, trailing } from "./sim";

/** What the index is built from, and what each part is called on screen. */
export const COMPONENTS = [
  {
    key: "hydration",
    label: "Hydration",
    icon: "water",
    hint: "Intake against the horse's own pace and its six-day baseline",
  },
  {
    key: "climate",
    label: "Stall climate",
    icon: "temp",
    hint: "Box temperature against the comfort band",
  },
  {
    key: "air",
    label: "Air quality",
    icon: "air",
    hint: "Air score, ammonia and humidity",
  },
  {
    key: "behaviour",
    label: "Behaviour",
    icon: "camera",
    hint: "What the AI camera calls — colic signs, box walking, restlessness",
  },
  {
    key: "gait",
    label: "Gait and posture",
    icon: "horse",
    hint: "Weight bearing and movement quality from the camera",
  },
  {
    key: "rest",
    label: "Rest",
    icon: "clock",
    hint: "Lying time against what is normal for a stabled horse",
  },
];

/** Defaults: the sensors carry more than half, the camera a little under half. */
export const DEFAULT_WEIGHTS = {
  hydration: 30,
  climate: 10,
  air: 15,
  behaviour: 25,
  gait: 12,
  rest: 8,
};

export const BANDS = [
  { min: 85, key: "good", label: "Settled", tone: "good" },
  { min: 70, key: "watch", label: "Watch", tone: "warning" },
  { min: 55, key: "attention", label: "Needs attention", tone: "serious" },
  { min: 0, key: "urgent", label: "Urgent", tone: "critical" },
];

export const bandOf = (score) => BANDS.find((b) => score >= b.min) || BANDS[BANDS.length - 1];

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const round = (v) => Math.round(v * 10) / 10;

/* ------------------------------- components ------------------------------- */

/**
 * Each of these returns `null` when the input it needs is missing, or
 * `{ score, why }` — `why` being the one line the profile shows under the bar.
 */

function hydrationScore(t, past, s) {
  if (t.offline) return null; // no meter, no opinion
  // pace is already normalised against the time of day, so 95% at 07:00 and
  // 95% at 19:00 mean the same thing
  const pace = clamp(((t.pctOfGoal - 40) / 55) * 100);
  const dry =
    t.hoursSinceDrink > s.noDrinkHours ? Math.min(30, (t.hoursSinceDrink - s.noDrinkHours) * 6) : 0;
  // a horse that is down on its own normal matters more than one below a yard default
  const drop = past.intakeL > 0 ? clamp((past.intakeL - t.intakeL) / past.intakeL, 0, 1) : 0;
  const score = clamp(pace - dry - drop * 25);
  const bits = [`${t.intakeL} L, ${t.pctOfGoal}% of pace`];
  if (dry) bits.push(`${Math.floor(t.hoursSinceDrink)} h since a drink`);
  if (drop > 0.15) bits.push(`${Math.round(drop * 100)}% under its own average`);
  return { score, why: bits.join(" · ") };
}

function climateScore(t, s) {
  if (t.tempNow == null) return null;
  const over = Math.max(0, t.tempNow - s.tempMax, s.tempMin - t.tempNow);
  const score = clamp(100 - over * 8);
  return {
    score,
    why: over
      ? `${t.tempNow}°C, ${round(over)}°C outside the ${s.tempMin}–${s.tempMax}°C band`
      : `${t.tempNow}°C, inside the comfort band`,
  };
}

function airScore(t, s) {
  if (t.airNow == null) return null;
  const nh3 = t.nh3Now > s.nh3Max ? (t.nh3Now - s.nh3Max) * 5 : 0;
  const hum = t.humidityNow > s.humidityMax ? (t.humidityNow - s.humidityMax) * 1.5 : 0;
  const score = clamp(t.airNow - nh3 - hum);
  const bits = [`score ${t.airNow}%`];
  if (nh3) bits.push(`ammonia ${t.nh3Now} ppm over ${s.nh3Max}`);
  if (hum) bits.push(`humidity ${t.humidityNow}%`);
  return { score, why: bits.join(" · ") };
}

/* the camera's calls, split into the two things they tell you about */
const COST = { cast: 48, flank: 34, restless: 9 };

function behaviourScore(events, s) {
  if (!s.camera.behaviour) return null;
  let penalty = 0;
  let restless = 0;
  events.forEach((e) => {
    if (e.conf < s.camera.minConfidence) return; // below the bar the yard set
    if (e.kind === "cast" || e.kind === "flank") penalty += COST[e.kind];
    else if (e.kind === "restless") restless += COST.restless;
  });
  penalty += Math.min(30, restless); // box walking accumulates, but only so far
  const score = clamp(100 - penalty);
  // the same call can fire several times in a day; name each kind once
  const flagged = [
    ...new Set(
      events
        .filter((e) => e.severity === "critical" || e.severity === "serious")
        .map((e) => e.title.toLowerCase())
    ),
  ];
  return {
    score,
    why: flagged.length
      ? `${flagged.slice(0, 2).join(", ")} on camera today`
      : restless
      ? "some box walking, nothing else flagged"
      : "nothing unusual seen today",
  };
}

function gaitScore(events, s) {
  if (!s.camera.behaviour) return null;
  const lame = events.filter((e) => e.kind === "lame" && e.conf >= s.camera.minConfidence);
  const mins = lame.reduce((a, e) => a + e.mins, 0);
  const score = clamp(100 - (lame.length ? 38 + Math.min(22, mins / 6) : 0));
  return {
    score,
    why: lame.length ? `uneven weight bearing over ${mins} min` : "moving evenly",
  };
}

/**
 * Stabled horses lie down roughly 2–5 hours a day. Well under that is a horse
 * that will not settle; well over it is one that is not getting up.
 */
function restScore(events, s) {
  if (!s.camera.behaviour) return null;
  const mins = events.filter((e) => e.kind === "rest").reduce((a, e) => a + e.mins, 0);
  const hours = mins / 60;
  let score = 100;
  if (hours < 1.5) score = clamp(45 + hours * 30);
  else if (hours > 6) score = clamp(100 - (hours - 6) * 14);
  return { score, why: `${round(hours)} h lying down so far today` };
}

/* --------------------------------- the index ------------------------------ */

export const normalise = (weights) => {
  const w = { ...DEFAULT_WEIGHTS, ...(weights || {}) };
  const total = COMPONENTS.reduce((a, c) => a + Math.max(0, Number(w[c.key]) || 0), 0);
  if (!total) return Object.fromEntries(COMPONENTS.map((c) => [c.key, 1 / COMPONENTS.length]));
  return Object.fromEntries(COMPONENTS.map((c) => [c.key, Math.max(0, Number(w[c.key]) || 0) / total]));
};

/**
 * The welfare index for one stall at one moment.
 *
 * `parts` carries every component that scored, with the share of the headline
 * it actually contributed — that is what the profile draws, and what makes the
 * number arguable rather than magic.
 */
export function welfareIndex(world, stall, animal, now, pre) {
  const s = world.settings;
  const weights = normalise(s.weights);
  if (!animal) return null;

  const t = pre?.today || today(stall, animal, now);
  const past = pre?.past || trailing(stall, animal, now, 6);
  const events = pre?.events || cameraEvents(stall, animal, startOfDay(now)).filter((e) => e.at <= now);

  const raw = {
    hydration: hydrationScore(t, past, s),
    climate: climateScore(t, s),
    air: airScore(t, s),
    behaviour: behaviourScore(events, s),
    gait: gaitScore(events, s),
    rest: restScore(events, s),
  };

  // drop what has no data and renormalise across the rest
  const live = COMPONENTS.filter((c) => raw[c.key]);
  const liveWeight = live.reduce((a, c) => a + weights[c.key], 0);
  if (!liveWeight) return null;

  const parts = live.map((c) => {
    const share = weights[c.key] / liveWeight;
    return {
      ...c,
      score: Math.round(raw[c.key].score),
      why: raw[c.key].why,
      weight: Math.round(weights[c.key] * 100),
      share: Math.round(share * 100),
      contribution: raw[c.key].score * share,
    };
  });

  const score = Math.round(parts.reduce((a, p) => a + p.contribution, 0));
  const missing = COMPONENTS.filter((c) => !raw[c.key]);

  return {
    score,
    band: bandOf(score),
    parts: parts.sort((a, b) => a.score - b.score), // worst first: that is the story
    missing,
    // how much of the configured weight actually had data behind it
    confidence: Math.round(liveWeight * 100),
    weakest: parts[0] || null,
  };
}

/**
 * The same index for a past day, so the profile can draw a trend. Uses that
 * day's closing readings rather than a partial day.
 */
export function welfareOnDay(world, stall, animal, dayStart) {
  const end = dayStart + DAY_MS - 60000;
  const d = dayReadings(stall, animal, dayStart);
  const t = {
    ...d,
    now: end,
    intakeL: d.intakeL,
    pctOfGoal: Math.round((d.intakeL / d.goal) * 100),
    hoursSinceDrink: 1,
    tempNow: d.tempC,
    airNow: d.air,
    humidityNow: d.humidity,
    nh3Now: d.nh3,
  };
  const past = trailing(stall, animal, dayStart, 6);
  const events = cameraEvents(stall, animal, dayStart);
  return welfareIndex(world, stall, animal, end, { today: t, past, events });
}

/**
 * Where the horse is heading: today against the average of the six days behind
 * it. This is the recovery read — a horse can sit at 68 and be climbing out of
 * something, or sit at 68 on the way down, and those are different mornings.
 */
export function welfareTrend(world, stall, animal, now, current) {
  const start = startOfDay(now);
  const history = [];
  for (let i = 6; i >= 1; i--) {
    const w = welfareOnDay(world, stall, animal, start - i * DAY_MS);
    if (w) history.push({ at: start - i * DAY_MS, score: w.score });
  }
  const today = current ?? welfareIndex(world, stall, animal, now)?.score;
  if (today == null) return null;
  history.push({ at: start, score: today });

  const base = history.slice(0, -1);
  const avg = base.length ? base.reduce((a, h) => a + h.score, 0) / base.length : today;
  const delta = Math.round(today - avg);
  return {
    history,
    baseline: Math.round(avg),
    delta,
    direction: delta >= 4 ? "improving" : delta <= -4 ? "declining" : "steady",
    label: delta >= 4 ? "Improving" : delta <= -4 ? "Declining" : "Steady",
    tone: delta >= 4 ? "good" : delta <= -4 ? "serious" : "flat",
  };
}

/** The yard's average index, and the horses sitting at the bottom of it. */
export function yardWelfare(live, world, now) {
  const scored = live
    .map((x) => ({ ...x, welfare: welfareIndex(world, x.stall, x.animal, now, x) }))
    .filter((x) => x.welfare);
  if (!scored.length) return { average: null, scored: [], lowest: [] };
  const average = Math.round(scored.reduce((a, x) => a + x.welfare.score, 0) / scored.length);
  return {
    average,
    scored,
    lowest: scored.slice().sort((a, b) => a.welfare.score - b.welfare.score).slice(0, 6),
  };
}
