/* ==========================================================================
   What a reading means.

   Every screen was showing figures — 86%, 20.3°C, 94% — and leaving the reader
   to remember where the thresholds sit. These turn a reading into the word a
   yard would actually use for it, and the colour that goes with it, so the
   dashboard, the barn tiles and the stall tables all say the same thing about
   the same number.

   Tones match the alert severities, so a box reading "Poor" here and a serious
   alert in the feed are the same colour.
   ========================================================================== */

/** Water: measured against the pace for the time of day, not the day's total. */
export function waterStatus(t, s) {
  if (!t) return { tone: "flat", label: "—", hint: "No box assigned" };
  if (t.offline) return { tone: "critical", label: "No data", hint: "The flow meter has not reported today" };
  const pct = t.pctOfGoal;
  if (pct < 50)
    return { tone: "critical", label: "Barely drinking", hint: `${pct}% of the pace for a ${t.goal} L day` };
  if (pct < s.intakeLowPct)
    return { tone: "warning", label: "Behind", hint: `${pct}% of the pace, below the ${s.intakeLowPct}% floor` };
  if (pct > 130) return { tone: "warning", label: "Drinking hard", hint: `${pct}% of the expected pace` };
  return { tone: "good", label: "On track", hint: `${pct}% of the pace for a ${t.goal} L day` };
}

/** Stall temperature against the comfort band. */
export function tempStatus(tempC, s) {
  if (tempC == null) return { tone: "flat", label: "—", hint: "No reading" };
  if (tempC > s.tempMax + 4)
    return { tone: "serious", label: "Hot", hint: `${Math.round(tempC - s.tempMax)}°C over the ${s.tempMax}°C ceiling` };
  if (tempC > s.tempMax) return { tone: "warning", label: "Warm", hint: `Above the ${s.tempMax}°C ceiling` };
  if (tempC < s.tempMin) return { tone: "warning", label: "Cold", hint: `Below the ${s.tempMin}°C floor` };
  return { tone: "good", label: "In band", hint: `Inside ${s.tempMin}–${s.tempMax}°C` };
}

/** Air quality score, with the ammonia limit folded in. */
export function airStatus(air, s, nh3) {
  if (air == null) return { tone: "flat", label: "—", hint: "No reading" };
  if (nh3 != null && nh3 > s.nh3Max)
    return { tone: "serious", label: "Ammonia high", hint: `${nh3} ppm against a ${s.nh3Max} ppm limit` };
  if (air < s.airMin - 10) return { tone: "serious", label: "Poor", hint: `Well under the ${s.airMin}% target` };
  if (air < s.airMin) return { tone: "warning", label: "Slipping", hint: `Under the ${s.airMin}% target` };
  return { tone: "good", label: "Good", hint: `At or above the ${s.airMin}% target` };
}

/** The worst of a set of tones — what a barn tile should colour itself by. */
const ORDER = ["critical", "serious", "warning", "good", "flat"];
export const worstTone = (...tones) => ORDER.find((t) => tones.includes(t)) || "flat";
