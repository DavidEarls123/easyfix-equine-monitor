/* ==========================================================================
   What is normal for THIS horse.

   The thresholds in Settings are yard-wide, and for the box they are the right
   shape: a stall at 28°C is too warm whichever horse is standing in it, and
   ammonia at 15 ppm is bad air for all of them. Temperature and air quality are
   properties of the building.

   Water intake and movement are not. A 16.2hh eventer in hard work and a
   retired pony on the same yard have daily intakes that differ by a factor of
   three, and a fixed "below 70% of a 35 L goal" flags the second one every day
   while missing the first one losing a third of its normal. So those two are
   learned per animal and judged against the horse's own history instead.

   ── How the baseline is built ───────────────────────────────────────────────

   Median and MAD, not mean and standard deviation. A horse that colicked last
   Tuesday has one very low day in its window; a mean would be dragged down by
   it and a standard deviation inflated, so the next episode would have to be
   worse to trip the same threshold. The median ignores it and the MAD barely
   moves — the baseline stays the horse's normal rather than its average
   including the bad days.

   Days where the meter was offline are excluded rather than counted as zero,
   and a baseline is not used at all until it has `minDays` behind it. Until
   then the animal is `learning` and the yard-wide goal carries the judgement —
   said plainly on screen rather than dressed up as a personal read.
   ========================================================================== */

import { DAY_MS, behaviourDay, dayKey, dayReadings, profileShare, startOfDay } from "./sim";

export const DEFAULT_BASELINE = {
  personalise: true, // judge intake and movement against the horse's own history
  windowDays: 21, // how far back the learned normal looks
  minDays: 7, // days of clean data before the baseline is trusted
  sensitivity: 2, // robust z-score at which a deviation is called
  tempAdjust: true, // expect more water on a warm day
  tempPerDegree: 6, // % more intake expected per °C above the horse's own norm
};

/* ------------------------------ robust stats ------------------------------ */

const median = (xs) => {
  if (!xs.length) return null;
  const a = xs.slice().sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

/** Median absolute deviation, scaled so it is comparable to a standard deviation. */
const mad = (xs, mid) => {
  if (xs.length < 2) return 0;
  return median(xs.map((x) => Math.abs(x - mid))) * 1.4826;
};

const round = (v, p = 1) => (v == null ? null : Math.round(v * 10 ** p) / 10 ** p);

/* -------------------------------- the cache ------------------------------- */
/* a baseline only changes when the day does, so it is built once per animal
   per day rather than on every five-second tick of the app clock */
const cache = new Map();
const MAX = 3000;
const memo = (key, make) => {
  const hit = cache.get(key);
  if (hit) return hit;
  const made = make();
  if (cache.size > MAX) cache.clear();
  cache.set(key, made);
  return made;
};

/* ------------------------------ the baseline ------------------------------ */

/** Minutes the camera saw the horse doing each kind of thing, for one day. */
function dayActivity(stall, animal, dayStart) {
  const segs = behaviourDay(stall, animal, dayStart);
  let active = 0;
  let lying = 0;
  let out = 0;
  segs.forEach((g) => {
    const mins = g.to - g.from;
    if (g.state === "turnout") out += mins;
    else if (g.state === "resting" || g.state === "cast") lying += mins;
    else if (g.state === "walking" || g.state === "restless" || g.state === "lame") active += mins;
  });
  return { active, lying, out };
}

/**
 * What this horse normally does, from the days behind it.
 *
 * `ready` is the flag every caller must respect: false means the app has not
 * watched this animal long enough to have an opinion of its own.
 */
export function learnedBaseline(world, stall, animal, now) {
  if (!animal) return null;
  const cfg = { ...DEFAULT_BASELINE, ...(world.settings.baseline || {}) };
  const key = `bl|${stall.id}|${animal.id}|${dayKey(now)}|${cfg.windowDays}`;
  return memo(key, () => build(stall, animal, now, cfg));
}

function build(stall, animal, now, cfg) {
  const start = startOfDay(now);
  const intake = [];
  const temps = [];
  const active = [];
  const lying = [];
  let skipped = 0;

  // yesterday backwards; today is the thing being judged, so it is not in here
  for (let i = 1; i <= cfg.windowDays; i++) {
    const dayStart = start - i * DAY_MS;
    // a profile cannot have history from before it existed
    if (animal.joined && dayStart < startOfDay(animal.joined)) break;
    const d = dayReadings(stall, animal, dayStart);
    if (d.offline) {
      skipped++;
      continue; // a dead meter is missing data, not a dry horse
    }
    intake.push(d.intakeL);
    temps.push(d.tempC);
    const a = dayActivity(stall, animal, dayStart);
    active.push(a.active);
    lying.push(a.lying);
  }

  const n = intake.length;
  const ready = n >= cfg.minDays;
  const mid = median(intake);
  const spread = mad(intake, mid ?? 0);

  return {
    cfg,
    days: n,
    skipped,
    ready,
    learning: !ready,
    needs: Math.max(0, cfg.minDays - n),
    intake: {
      median: round(mid),
      mad: round(spread),
      // the band a normal day for this horse falls in
      lo: mid == null ? null : round(Math.max(0, mid - cfg.sensitivity * spread)),
      hi: mid == null ? null : round(mid + cfg.sensitivity * spread),
      min: n ? round(Math.min(...intake)) : null,
      max: n ? round(Math.max(...intake)) : null,
      samples: intake.map(round),
    },
    temp: { median: round(median(temps)) },
    activity: {
      activeMedian: Math.round(median(active) ?? 0),
      activeMad: Math.round(mad(active, median(active) ?? 0)),
      lyingMedian: Math.round(median(lying) ?? 0),
      lyingMad: Math.round(mad(lying, median(lying) ?? 0)),
    },
  };
}

/* ------------------------------ judging today ----------------------------- */

/**
 * Today's intake against this horse's own normal.
 *
 * Compares a projection of the full day rather than the total so far, because
 * "9 L by 08:00" means nothing without knowing how this horse drinks through a
 * day. The projection is unreliable before the day has really started, so a
 * deviation is not called until enough of it has elapsed.
 */
export function intakeDeviation(t, baseline, stallTempC) {
  if (!baseline || !baseline.ready || !t || t.offline) return null;
  const { cfg, intake } = baseline;
  if (intake.median == null) return null;

  const elapsed = profileShare(minutesOf(t.now));
  if (elapsed < 0.2) return { tooEarly: true, elapsed };

  const projected = t.intakeL / Math.max(0.05, elapsed);

  // horses drink more when the box is warm; comparing a hot day against a mild
  // baseline otherwise reads as a horse drinking hard
  let expected = intake.median;
  if (cfg.tempAdjust && stallTempC != null && baseline.temp.median != null) {
    const delta = stallTempC - baseline.temp.median;
    const factor = 1 + (delta * cfg.tempPerDegree) / 100;
    expected = expected * Math.max(0.7, Math.min(1.5, factor));
  }

  // a MAD of zero (a metronomic horse) would make every wobble infinite, so the
  // spread has a floor of a litre or a tenth of the horse's normal
  const spread = Math.max(intake.mad, 1, expected * 0.1);
  const z = (projected - expected) / spread;
  const pct = Math.round((projected / expected) * 100);

  return {
    projected: round(projected),
    expected: round(expected),
    adjusted: cfg.tempAdjust && stallTempC != null && Math.abs(stallTempC - (baseline.temp.median ?? stallTempC)) >= 1,
    z: round(z, 2),
    pct,
    elapsed,
    low: z <= -cfg.sensitivity,
    high: z >= cfg.sensitivity,
    verdict:
      z <= -cfg.sensitivity * 1.5
        ? "far below"
        : z <= -cfg.sensitivity
        ? "below"
        : z >= cfg.sensitivity
        ? "above"
        : "normal",
  };
}

/** Today's movement against this horse's own normal. */
export function activityDeviation(stall, animal, baseline, now) {
  if (!baseline || !baseline.ready || !animal) return null;
  const { activity, cfg } = baseline;
  const todayA = dayActivity(stall, animal, startOfDay(now));
  const elapsed = Math.min(1, minutesOf(now) / 1440);
  if (elapsed < 0.25) return { tooEarly: true };

  const projected = todayA.active / Math.max(0.1, elapsed);
  const spread = Math.max(activity.activeMad, 15, activity.activeMedian * 0.15);
  const z = (projected - activity.activeMedian) / spread;
  return {
    activeMins: todayA.active,
    projected: Math.round(projected),
    expected: activity.activeMedian,
    z: round(z, 2),
    low: z <= -cfg.sensitivity,
    high: z >= cfg.sensitivity,
    verdict: z >= cfg.sensitivity ? "restless" : z <= -cfg.sensitivity ? "quiet" : "normal",
  };
}

const minutesOf = (ms) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};
