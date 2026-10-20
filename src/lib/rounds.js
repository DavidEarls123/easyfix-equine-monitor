/* ==========================================================================
   Rounds: who does which boxes.

   Mucking out and feeding are not like riding. A rider is put on a horse for
   one morning and it changes tomorrow; a groom is given a run of boxes and
   keeps them for months. The work is assigned to the box rather than to the
   horse standing in it — when a horse moves, whoever does that corner of the
   barn still does that corner.

   And it goes by proximity. Nobody is given eight boxes scattered over three
   barns: they are given one end of Barn 2, because that is how the work is
   actually walked. So a round is a set of stalls, offered a barn at a time.

   A round is therefore standing configuration, not part of the day's plan. The
   plan says who is riding what this morning; the rounds say who does the boxes
   every morning. Progress against a round comes from the care log — the taps
   on the screen on the front of each box — so it is live without anybody
   having to report anything.
   ========================================================================== */

import { CARE, careToday, dueByNow, DEFAULT_CARE } from "./care";

/** The two kinds of round. The care log calls mucking out "clean". */
export const ROUND_KINDS = [
  { id: "muckout", care: "clean", label: "Muck out", icon: "clean", colour: "#1baf7a", at: "06:30" },
  { id: "feed", care: "feed", label: "Feeding", icon: "feed", colour: "#4e9a4e", at: "07:00" },
];

export const roundKind = (id) => ROUND_KINDS.find((k) => k.id === id) || ROUND_KINDS[0];
export const isRoundKind = (id) => ROUND_KINDS.some((k) => k.id === id);

/* --------------------------------- reading -------------------------------- */

/* Rounds belong to a yard: the same groom can keep one run of boxes at the
   main yard and another at the satellite, and they are not the same round. */
export const roundsOf = (world, kind, yardId) =>
  (world.rounds || []).filter((r) => r.kind === kind && (!yardId || r.yardId === yardId));

export const roundFor = (world, kind, staffId, yardId) =>
  (world.rounds || []).find(
    (r) => r.kind === kind && r.staffId === staffId && (!yardId || r.yardId === yardId)
  ) || null;

/** Which round a box belongs to for a kind of work, if any. */
export const roundOfStall = (world, kind, stallId) =>
  (world.rounds || []).find((r) => r.kind === kind && (r.stallIds || []).includes(stallId)) || null;

/** Boxes in this yard that nobody has been given, for this kind of work. */
export function unassigned(world, kind, stalls) {
  const taken = new Set(roundsOf(world, kind).flatMap((r) => r.stallIds || []));
  return stalls.filter((st) => !taken.has(st.id));
}

/**
 * What a round has actually got through today.
 *
 * Only occupied boxes count: an empty box is not work. "Done" means the box
 * has had everything it is due at this hour, which is the number a groom
 * would give you if you asked how they were getting on.
 */
export function roundProgress(world, round, now) {
  const care = roundKind(round.kind).care;
  const stalls = (round.stallIds || [])
    .map((id) => world.stalls.find((st) => st.id === id))
    .filter(Boolean);

  let boxes = 0;
  let done = 0;
  let behind = 0;
  let rounds = 0;
  let target = 0;

  stalls.forEach((st) => {
    const animal = st.animalId ? world.animals.find((a) => a.id === st.animalId) : null;
    if (!animal) return;
    boxes++;
    const c = careToday(world, animal, now)[care];
    rounds += c.done;
    target += c.target;
    if (c.behind) behind++;
    else if (c.due > 0 && c.done >= c.due) done++;
    else if (c.due === 0) done++; // nothing asked for yet, so not behind
  });

  return {
    boxes,
    empty: stalls.length - boxes,
    done,
    behind,
    rounds,
    target,
    pct: boxes ? Math.round((done / boxes) * 100) : 100,
    tone: behind >= 3 ? "serious" : behind ? "warning" : boxes && done === boxes ? "good" : "flat",
  };
}

/** The same question for a whole barn, for the overview and the barn screen. */
export function barnRoundProgress(world, barnId, now) {
  const stalls = world.stalls.filter((st) => st.barnId === barnId && st.animalId);
  const out = {};
  ROUND_KINDS.forEach((k) => {
    let done = 0;
    let behind = 0;
    stalls.forEach((st) => {
      const animal = world.animals.find((a) => a.id === st.animalId);
      if (!animal) return;
      const c = careToday(world, animal, now)[k.care];
      if (c.behind) behind++;
      else done++;
    });
    out[k.id] = {
      boxes: stalls.length,
      done,
      behind,
      pct: stalls.length ? Math.round((done / stalls.length) * 100) : 100,
      tone: behind >= 3 ? "serious" : behind ? "warning" : stalls.length ? "good" : "flat",
    };
  });
  return out;
}

/* ------------------------------- suggesting ------------------------------- */

/**
 * What to offer somebody who has just been given this kind of work.
 *
 * A run of boxes, in box order, from whichever barn has the most still
 * unassigned — which is the one the yard manager was about to point at.
 */
export function suggestRun(world, kind, stalls, size = 10) {
  const free = unassigned(world, kind, stalls);
  if (!free.length) return [];
  const byBarn = new Map();
  free.forEach((st) => byBarn.set(st.barnId, [...(byBarn.get(st.barnId) || []), st]));
  const [, best] = [...byBarn.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  return best.sort((a, b) => a.index - b.index).slice(0, size);
}

/** A tidy description of a round's boxes: "Barn 1 · 8 boxes, 1–8". */
export function describeRound(world, round) {
  const stalls = (round.stallIds || [])
    .map((id) => world.stalls.find((st) => st.id === id))
    .filter(Boolean);
  if (!stalls.length) return "No boxes yet";
  const byBarn = new Map();
  stalls.forEach((st) => byBarn.set(st.barnId, [...(byBarn.get(st.barnId) || []), st]));
  return [...byBarn.entries()]
    .map(([barnId, list]) => {
      const barn = world.barns.find((b) => b.id === barnId);
      const idx = list.map((st) => st.index).sort((a, b) => a - b);
      const run = idx.length > 1 && idx[idx.length - 1] - idx[0] === idx.length - 1;
      return `${barn?.name || "Barn"} ${run ? `${idx[0]}–${idx[idx.length - 1]}` : idx.join(", ")}`;
    })
    .join(" · ");
}

/** How many rounds a box is still due today, for the picker's hints. */
export function stallDue(world, stall, kind, now) {
  const animal = stall.animalId ? world.animals.find((a) => a.id === stall.animalId) : null;
  if (!animal) return null;
  const care = roundKind(kind).care;
  const target = { ...DEFAULT_CARE, ...(world.settings.care || {}), ...(animal.care || {}) };
  const want = Number(target[CARE[care].field]) || 0;
  const c = careToday(world, animal, now)[care];
  return { want, done: c.done, due: dueByNow(want, now), behind: c.behind };
}
