/* ==========================================================================
   Feeding and mucking out: what the camera sees, and what a person confirms.

   Every box has a camera over it and a screen on the front of it. The yard
   decides in the web app how often a given horse is fed and how often its box
   is done; after that, nobody should have to tell the system anything it can
   see for itself.

   So a round is recorded one of two ways:

     • the camera recognises it — a feed going in, a box being mucked out —
       and records it with the confidence it had, or
     • somebody presses the button on the stall front, which is the override:
       it is how a round gets on the record when the camera did not call it,
       and how a camera call gets taken off when it was wrong.

   The camera's record is derived rather than stored: the same seed and the
   same day always give the same rounds, so a yard of three hundred boxes
   costs nothing to keep. What a person presses IS stored, in careLog, because
   nothing can derive what a person did. Anything the camera got wrong is
   stored too, in careVoid, because a correction has to outlive the derivation.

   Targets live on the animal because they belong to the horse, not the box —
   a horse moved to another stall takes its feeding regime with it.
   ========================================================================== */

import { DAY_MS, HOUR_MS, between, dayKey, noise, startOfDay } from "./sim";

export const DEFAULT_CARE = { feeds: 3, cleans: 2 };

/** The working day the rounds are spread across. */
const FIRST_HOUR = 6.5;
const LAST_HOUR = 19.5;

/** Two records of the same round, this far apart, are one round. */
const SAME_ROUND_MS = 75 * 60 * 1000;

export const CARE = {
  feed: { key: "feed", label: "Feed", done: "Fed", icon: "feed", field: "feeds" },
  clean: { key: "clean", label: "Muck out", done: "Cleaned", icon: "clean", field: "cleans" },
};

/** The times of day a horse on `n` rounds is due, spread across the working day. */
export function dueTimes(n) {
  if (n <= 0) return [];
  if (n === 1) return [FIRST_HOUR];
  const step = (LAST_HOUR - FIRST_HOUR) / (n - 1);
  return Array.from({ length: n }, (_, i) => FIRST_HOUR + i * step);
}

const hourOf = (ms) => {
  const d = new Date(ms);
  return d.getHours() + d.getMinutes() / 60;
};

/** How many rounds should have happened by now. */
export function dueByNow(n, now) {
  const h = hourOf(now);
  // a round counts as due once its slot has passed by half an hour's grace
  return dueTimes(n).filter((t) => h >= t + 0.5).length;
}

/** What the yard asks for this horse: its own regime, or the house default. */
export const careTarget = (world, animal) => ({
  ...DEFAULT_CARE,
  ...(world.settings?.care || {}),
  ...(animal?.care || {}),
});

/* ------------------------------- the camera ------------------------------- */

/**
 * What the camera recognised in this box today.
 *
 * It only ever reports rounds that have actually happened — the work is late
 * in about one box in five, and a round that has not been done cannot be seen.
 * Of the rest it calls most but not all: every sighting carries a confidence,
 * and anything under the threshold the yard set is left for a person to
 * confirm on the box. That is the whole point of the override — the camera is
 * the normal case, the button is for when it is not.
 */
export function cameraCare(world, animal, now) {
  if (!animal || world.settings?.camera?.care === false) return [];
  const target = careTarget(world, animal);
  const day = startOfDay(now);
  const key = dayKey(now);
  const min = Number(world.settings?.camera?.minConfidence) || 90;
  const out = [];

  Object.values(CARE).forEach(({ key: kind, field }) => {
    const want = Math.max(0, Number(target[field]) || 0);
    const due = dueByNow(want, now);
    // roughly one box in five is a round behind, which is what a yard looks like
    const slip = noise(`slip|${animal.id}|${kind}|${key}`) < 0.2 ? 1 : 0;
    const happened = Math.max(0, due - slip);

    dueTimes(want)
      .slice(0, happened)
      .forEach((hour, i) => {
        const seed = `cam|${animal.id}|${key}|${kind}|${i}`;
        const at = day + Math.round((hour + between(`late|${seed}`, -0.15, 0.45)) * HOUR_MS);
        if (at > now) return;
        // most rounds are unmistakable — a full bucket going over the door, a
        // barrow and a fork in the box. About one in fourteen is not: the view
        // is half blocked, two boxes are done at once, the light has gone.
        const unsure = noise(`sure|${seed}`) < 0.07;
        const confidence = Math.round(
          unsure ? between(`cf|${seed}`, 68, 88) : between(`cf|${seed}`, 92, 99)
        );
        out.push({
          id: seed,
          at,
          animalId: animal.id,
          kind,
          by: "Camera",
          source: "camera",
          confidence,
          // under the yard's own threshold the camera will not call it on its
          // own. The sighting is kept rather than thrown away, because "the
          // camera thinks it saw this, is it right?" is a better question to
          // put on the box than a blank ring
          below: confidence < min,
        });
      });
  });

  return out;
}

/* -------------------------------- the record ------------------------------- */

/**
 * Today's record for one animal: what was asked for, what has been done,
 * whether the yard is behind at this hour, and how each round was recorded.
 *
 * The two sources are merged rather than added up. If the camera saw a feed at
 * 07:04 and the groom also pressed the button at 07:20, that is one feed, not
 * two — so a camera sighting is dropped when a person recorded the same round.
 * The person wins, because the person has a name.
 */
export function careToday(world, animal, now) {
  const target = careTarget(world, animal);
  const from = startOfDay(now);
  const to = from + DAY_MS;
  const voided = world.careVoid || [];
  const log = (world.careLog || []).filter((e) => e.animalId === animal?.id && e.at >= from && e.at < to);
  const seen = cameraCare(world, animal, now).filter((e) => !voided.includes(e.id));

  const build = (kind) => {
    const field = CARE[kind].field;
    const manual = log.filter((e) => e.kind === kind).map((e) => ({ ...e, source: e.source || "manual" }));
    const sightings = seen.filter(
      (e) => e.kind === kind && !manual.some((m) => Math.abs(m.at - e.at) < SAME_ROUND_MS)
    );
    const camera = sightings.filter((e) => !e.below);
    // seen, but not confidently enough to count: these are what the button on
    // the box front is for, and the screen names them rather than asking blind
    const unsure = sightings.filter((e) => e.below);
    const entries = [...manual, ...camera].sort((a, b) => a.at - b.at);
    const want = Math.max(0, Number(target[field]) || 0);
    const due = dueByNow(want, now);
    return {
      kind,
      done: entries.length,
      target: want,
      due,
      behind: Math.max(0, due - entries.length),
      complete: want > 0 && entries.length >= want,
      entries,
      unsure,
      camera: camera.length,
      byHand: manual.length,
      last: entries[entries.length - 1] || null,
      nextDue: dueTimes(want)[entries.length] ?? null,
    };
  };

  return { feed: build("feed"), clean: build("clean"), target };
}

/** The same question for a whole barn, for the screen on the barn door. */
export function careRollup(world, states, now) {
  let behind = 0;
  let done = 0;
  let target = 0;
  let camera = 0;
  states.forEach((x) => {
    if (!x.animal) return;
    const c = careToday(world, x.animal, now);
    behind += c.feed.behind + c.clean.behind;
    done += c.feed.done + c.clean.done;
    target += c.feed.target + c.clean.target;
    camera += c.feed.camera + c.clean.camera;
  });
  return { behind, done, target, camera };
}

export const careTone = (c) => (c.behind >= 2 ? "serious" : c.behind ? "warning" : c.complete ? "good" : "flat");
