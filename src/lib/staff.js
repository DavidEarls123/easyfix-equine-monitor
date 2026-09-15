/* ==========================================================================
   People, and who is riding what.

   Two things a yard runs on that the sensors know nothing about: who works
   here, and what the string is doing tomorrow morning. Both are plain
   configuration — no simulation, no derived readings — so both live in the
   stored world alongside the barns.

   Lots are the unit a racing yard plans in: the string goes out in groups, and
   the manager decides the night before who sits on what. Fifty riders and fifty
   horses in a lot, seven lots, is a normal morning for a big yard, so the
   planner has to stay usable at that size rather than at demo size.
   ========================================================================== */

import { dayKey, startOfDay } from "./sim";

export const GROUPS = [
  { id: "riders", label: "Riders", colour: "#2a78d6", hint: "Anyone who sits on a horse" },
  { id: "yard", label: "Yard staff", colour: "#1baf7a", hint: "Grooms, feeding, mucking out" },
  { id: "vets", label: "Vets", colour: "#d03b3b", hint: "Veterinary" },
  { id: "farriers", label: "Farriers", colour: "#eb6834", hint: "Shoeing" },
  { id: "management", label: "Management", colour: "#6b4bbd", hint: "Yard manager, office" },
];

export const groupOf = (id) => GROUPS.find((g) => g.id === id) || { id, label: id, colour: "#86a0b8" };

export const DEFAULT_LOTS = [
  { label: "Lot 1", time: "07:00" },
  { label: "Lot 2", time: "08:15" },
  { label: "Lot 3", time: "09:30" },
  { label: "Lot 4", time: "10:45" },
];

/* --------------------------------- staff ---------------------------------- */

export const inGroup = (person, groupId) => (person.groups || []).includes(groupId);

/** Everyone in a group, or everyone if no group is named. */
export const staffIn = (staff, groupId) =>
  (staff || []).filter((p) => !groupId || groupId === "all" || inGroup(p, groupId));

/** The riders a manager actually has available this morning. */
export const availableRiders = (staff) =>
  (staff || []).filter((p) => inGroup(p, "riders") && p.riding !== false);

/* ------------------------------- the ride plan ---------------------------- */

/** An empty morning: the lots a yard runs, with nothing in them yet. */
export const emptyPlan = (lots = DEFAULT_LOTS) => ({
  lots: lots.map((l, i) => ({ id: `lot${i + 1}`, label: l.label, time: l.time, rides: [] })),
});

/** The plan for a given day, or a blank one. */
export function planFor(world, when) {
  const key = dayKey(when);
  return world.ridePlan?.[key] || emptyPlan(world.settings.lots || DEFAULT_LOTS);
}

/** Every ride a given rider has, across the lots, in order. */
export function ridesOf(plan, riderId) {
  const out = [];
  plan.lots.forEach((lot) => {
    lot.rides.filter((r) => r.riderId === riderId).forEach((r) => out.push({ ...r, lot }));
  });
  return out;
}

/** Which lot a horse is already down for, if any. */
export function lotOfAnimal(plan, animalId) {
  for (const lot of plan.lots) if (lot.rides.some((r) => r.animalId === animalId)) return lot;
  return null;
}

/** What the plan adds up to — the line a manager checks before sending it. */
export function planSummary(plan, staff, animals) {
  const riderIds = new Set();
  const animalIds = new Set();
  let rides = 0;
  let unmanned = 0;
  plan.lots.forEach((lot) =>
    lot.rides.forEach((r) => {
      rides++;
      if (r.riderId) riderIds.add(r.riderId);
      else unmanned++;
      if (r.animalId) animalIds.add(r.animalId);
    })
  );
  return {
    rides,
    unmanned,
    riders: riderIds.size,
    horses: animalIds.size,
    idleRiders: availableRiders(staff).filter((p) => !riderIds.has(p.id)).length,
    unridden: (animals || []).filter((a) => !animalIds.has(a.id)).length,
  };
}

/* ------------------------------- the message ------------------------------ */

/**
 * What one rider is sent in the morning. Built from the plan rather than typed,
 * because a manager who has to retype fifty rides will stop sending them.
 */
export function morningMessage(plan, rider, animals, yardName) {
  const mine = ridesOf(plan, rider.id);
  if (!mine.length) return null;
  const lines = mine.map((r) => {
    const a = animals.find((x) => x.id === r.animalId);
    return `${r.lot.time} ${r.lot.label} — ${a ? a.name : "TBC"}${r.note ? ` (${r.note})` : ""}`;
  });
  return {
    to: rider,
    subject: `${yardName}: your rides`,
    body: [`Morning ${rider.name.split(" ")[0]},`, "", ...lines, "", "Any changes will come through here."].join("\n"),
    rideCount: mine.length,
  };
}

/** A tidy default for a broadcast, so the compose box is never empty. */
export const messageStamp = (now) =>
  new Date(now).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });

export const startOfPlanDay = (when) => startOfDay(when);
