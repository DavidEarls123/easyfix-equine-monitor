/* ==========================================================================
   Feeding and mucking out, as the stall screen records them.

   Every box has a screen on the front of it. The yard decides in the web app
   how often a given horse is fed and how often its box is done; the worker
   standing in front of the stall presses the button and confirms, and that is
   the whole interaction. This is the part that turns the screen from a poster
   into a record: who did what, in which box, at what time.

   Targets live on the animal because they belong to the horse, not the box —
   a horse moved to another stall takes its feeding regime with it.
   ========================================================================== */

import { DAY_MS, startOfDay } from "./sim";

export const DEFAULT_CARE = { feeds: 3, cleans: 2 };

/** The working day the rounds are spread across. */
const FIRST_HOUR = 6.5;
const LAST_HOUR = 19.5;

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

/**
 * Today's record for one animal: what was asked for, what has been done, and
 * whether the yard is behind at this hour.
 */
export function careToday(world, animal, now) {
  const target = { ...DEFAULT_CARE, ...(world.settings.care || {}), ...(animal?.care || {}) };
  const from = startOfDay(now);
  const to = from + DAY_MS;
  const log = (world.careLog || []).filter((e) => e.animalId === animal?.id && e.at >= from && e.at < to);

  const build = (kind) => {
    const field = CARE[kind].field;
    const entries = log.filter((e) => e.kind === kind).sort((a, b) => a.at - b.at);
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
  states.forEach((x) => {
    if (!x.animal) return;
    const c = careToday(world, x.animal, now);
    behind += c.feed.behind + c.clean.behind;
    done += c.feed.done + c.clean.done;
    target += c.feed.target + c.clean.target;
  });
  return { behind, done, target };
}

export const careTone = (c) => (c.behind >= 2 ? "serious" : c.behind ? "warning" : c.complete ? "good" : "flat");
