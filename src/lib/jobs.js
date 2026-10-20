/* ==========================================================================
   The job planner.

   A racing yard's morning is not only riding. The string goes out in lots, but
   at the same time the boxes are being mucked out, the farrier is working down
   one barn and the vet is seeing three horses before lunch. All of it is one
   plan, because all of it competes for the same people and the same horses, and
   all of it has to end up in the message a member of staff gets at five in the
   morning.

   So the day's plan holds two things:

     • lots   — ridden work. A lot has a time, a gallop, and a ride per rider.
                A ride is a rider, a horse, how far it is going, and any
                activity tags on top of that.
     • jobs   — everything else. A job is a kind (muck out, farrier, vet…), the
                person doing it, a time, and the horses it covers.

   Gallops belong to a yard, because they are a thing you can walk on. Activity
   tags belong to the operator, because the same yard group will use the same
   words across every yard it runs. Both are editable — a yard that calls its
   gallop "the top of the hill" should see that in the text, not our guess.
   ========================================================================== */

import { dayKey, startOfDay } from "./sim";

/* ------------------------------- what we ship ----------------------------- */

export const DEFAULT_LOTS = [
  { label: "Lot 1", time: "07:00" },
  { label: "Lot 2", time: "08:15" },
  { label: "Lot 3", time: "09:30" },
  { label: "Lot 4", time: "10:45" },
];

/** The ground a yard works on. Named, because riders are told a name. */
export const DEFAULT_GALLOPS = [
  { id: "gl_round", label: "Round Gallop", surface: "Woodchip", furlongs: 7 },
  { id: "gl_straight", label: "Straight Gallop", surface: "Polytrack", furlongs: 6 },
  { id: "gl_hill", label: "Hill Gallop", surface: "Sand", furlongs: 5 },
  { id: "gl_grass", label: "Grass Gallop", surface: "Grass", furlongs: 8 },
  { id: "gl_school", label: "Schooling Ground", surface: "Grass", furlongs: 4 },
  { id: "gl_canter", label: "Sand Canter", surface: "Sand", furlongs: 4 },
];

/** What a horse can be down for on top of its lot. The yard edits this list. */
export const DEFAULT_ACTIVITIES = [
  { id: "ac_canter", label: "Canter", colour: "#2a78d6" },
  { id: "ac_work", label: "Work / gallop", colour: "#15407e" },
  { id: "ac_swim", label: "Swimming", colour: "#1296c0" },
  { id: "ac_walker", label: "Horse walker", colour: "#1baf7a" },
  { id: "ac_water", label: "Water walker", colour: "#0f8f96" },
  { id: "ac_lunge", label: "Lunge", colour: "#8a6fd0" },
  { id: "ac_school", label: "Schooling", colour: "#c2558a" },
  { id: "ac_hack", label: "Hack / road work", colour: "#a8761f" },
  { id: "ac_turnout", label: "Turnout", colour: "#5c8a3a" },
];

/** The work that is not ridden. `group` is the staff group offered first. */
/* `at` is the hour that job usually happens, so a card starts with a sensible
   time on it rather than blank. The manager changes it on the card. */
export const JOB_KINDS = [
  { id: "muckout", label: "Muck out", group: "yard", icon: "clean", colour: "#1baf7a", at: "06:30" },
  { id: "feed", label: "Feeding", group: "yard", icon: "feed", colour: "#4e9a4e", at: "07:00" },
  { id: "farrier", label: "Farrier", group: "farriers", icon: "hoof", colour: "#eb6834", at: "10:00" },
  { id: "vet", label: "Vet", group: "vets", icon: "vet", colour: "#d03b3b", at: "09:00" },
  { id: "dentist", label: "Dentist", group: "vets", icon: "vet", colour: "#b8456f", at: "11:00" },
  { id: "physio", label: "Physio", group: "vets", icon: "head", colour: "#8a6fd0", at: "11:30" },
  { id: "travel", label: "Travel / racing", group: "yard", icon: "right", colour: "#6b4bbd", at: "06:00" },
  { id: "other", label: "Other", group: "all", icon: "note", colour: "#45607a", at: "" },
];

export const jobKind = (id) => JOB_KINDS.find((k) => k.id === id) || JOB_KINDS[JOB_KINDS.length - 1];

/* ------------------------- the lists a yard can edit ---------------------- */

export const activitiesOf = (settings) =>
  settings?.activities?.length ? settings.activities : DEFAULT_ACTIVITIES;
export const activityOf = (settings, id) => activitiesOf(settings).find((a) => a.id === id) || null;

export const gallopsOf = (yard) => (yard?.gallops?.length ? yard.gallops : DEFAULT_GALLOPS);
export const gallopOf = (yard, id) => (id ? gallopsOf(yard).find((g) => g.id === id) || null : null);

export const lotsOf = (yard) => (yard?.lots?.length ? yard.lots : DEFAULT_LOTS);

/** Furlongs the way a yard says them: 6f, 1m, 1m 2f. */
export function furlongs(f) {
  const n = Number(f);
  if (!n || n <= 0) return null;
  const miles = Math.floor(n / 8);
  const rest = n % 8;
  if (!miles) return `${n}f`;
  return rest ? `${miles}m ${rest}f` : `${miles}m`;
}

/* --------------------------------- the plan ------------------------------- */

/** An empty day: the lots this yard runs, with nothing in them, and no jobs. */
export const emptyPlan = (lots = DEFAULT_LOTS) => ({
  lots: lots.map((l, i) => ({
    id: l.id || `lot${i + 1}`,
    label: l.label,
    time: l.time,
    gallopId: l.gallopId || null,
    rides: [],
  })),
  jobs: [],
});

/** Plans are held per yard as well as per day — two yards have two mornings. */
export const planKey = (yardId, when) => `${yardId || "yard"}|${dayKey(when)}`;

/** The yard the app is currently looking at. Kept here so the planner has no
    dependency on world.js, which depends on this file for its defaults. */
export const planYard = (world) =>
  (world.yards || []).find((y) => y.id === world.yardId) || (world.yards || [])[0] || null;

/** The plan for a day at a yard, or a blank one built from that yard's lots. */
export function planFor(world, when, yard) {
  const y = yard || planYard(world);
  const stored = world.ridePlan?.[planKey(y?.id, when)];
  const blank = emptyPlan(lotsOf(y));
  if (!stored) return blank;
  // a plan saved before a field existed should still read cleanly
  return { ...blank, ...stored, jobs: stored.jobs || [] };
}

/* --------------------------------- reading -------------------------------- */

/** Every ride a person has, across the lots, in order. */
export function ridesOf(plan, riderId) {
  const out = [];
  plan.lots.forEach((lot) => {
    lot.rides.filter((r) => r.riderId === riderId).forEach((r) => out.push({ ...r, lot }));
  });
  return out;
}

/** Every job a person is down for, earliest first. */
export function jobsOf(plan, staffId) {
  return (plan.jobs || [])
    .filter((j) => j.staffId === staffId)
    .slice()
    .sort((a, b) => (a.at || "").localeCompare(b.at || ""));
}

/** Everything a horse is down for today, ridden and not. */
export function dayOfAnimal(plan, animalId) {
  const rides = [];
  plan.lots.forEach((lot) =>
    lot.rides.filter((r) => r.animalId === animalId).forEach((r) => rides.push({ ...r, lot }))
  );
  const jobs = (plan.jobs || []).filter((j) => (j.animalIds || []).includes(animalId));
  return { rides, jobs };
}

/** Which lot a horse is already down for, if any. */
export function lotOfAnimal(plan, animalId) {
  for (const lot of plan.lots) if (lot.rides.some((r) => r.animalId === animalId)) return lot;
  return null;
}

/** The furlongs a horse is down to cover today, across every lot. */
export function distanceOfAnimal(plan, animalId) {
  let f = 0;
  plan.lots.forEach((lot) =>
    lot.rides.filter((r) => r.animalId === animalId).forEach((r) => (f += Number(r.distanceF) || 0))
  );
  return f;
}

/** What the plan adds up to — the line a manager checks before sending it. */
export function planSummary(plan, staff, animals) {
  const riderIds = new Set();
  const animalIds = new Set();
  let rides = 0;
  let unmanned = 0;
  let furlongsOut = 0;
  plan.lots.forEach((lot) =>
    lot.rides.forEach((r) => {
      rides++;
      if (r.riderId) riderIds.add(r.riderId);
      else unmanned++;
      if (r.animalId) animalIds.add(r.animalId);
      furlongsOut += Number(r.distanceF) || 0;
    })
  );
  const jobs = plan.jobs || [];
  const jobStaff = new Set(jobs.map((j) => j.staffId).filter(Boolean));
  return {
    rides,
    unmanned,
    riders: riderIds.size,
    horses: animalIds.size,
    furlongs: furlongsOut,
    jobs: jobs.length,
    jobStaff: jobStaff.size,
    unstaffedJobs: jobs.filter((j) => !j.staffId).length,
    people: new Set([...riderIds, ...jobStaff]).size,
    idleRiders: availableRiders(staff).filter((p) => !riderIds.has(p.id)).length,
    unridden: (animals || []).filter((a) => !animalIds.has(a.id)).length,
  };
}

/* A rider is someone in the riders group who has not been stood down today.
   Declared here rather than imported, so the planner is one file to read. */
export const availableRiders = (staff) =>
  (staff || []).filter((p) => (p.groups || []).includes("riders") && p.riding !== false);

/* ------------------------------- the message ------------------------------ */

/**
 * What one person is sent. Built from the plan rather than typed, because a
 * manager who has to retype fifty rides and twenty jobs will stop sending them.
 *
 * One message per person covering their whole day: three lots and the farrier
 * is one text listing four things, not four texts.
 */
export function dayMessage(plan, person, world, yard) {
  const rides = ridesOf(plan, person.id);
  const jobs = jobsOf(plan, person.id);
  if (!rides.length && !jobs.length) return null;

  const named = (id) => world.animals.find((a) => a.id === id);
  const lines = [];

  if (rides.length) {
    lines.push(rides.length === 1 ? "Your ride:" : `Your rides (${rides.length}):`);
    rides.forEach((r) => {
      const a = r.animalId ? named(r.animalId) : null;
      const detail = [];
      const g = gallopOf(yard, r.lot.gallopId);
      if (g) detail.push(g.label);
      const d = furlongs(r.distanceF);
      if (d) detail.push(d);
      (r.activities || []).forEach((id) => {
        const tag = activityOf(world.settings, id);
        if (tag) detail.push(tag.label);
      });
      lines.push(
        `${r.lot.time} ${r.lot.label} — ${a ? a.name : "TBC"}` +
          (detail.length ? `\n   ${detail.join(" · ")}` : "") +
          (r.note ? `\n   ${r.note}` : "")
      );
    });
  }

  if (jobs.length) {
    if (lines.length) lines.push("");
    lines.push(jobs.length === 1 ? "Your job:" : `Your jobs (${jobs.length}):`);
    jobs.forEach((j) => {
      const kind = jobKind(j.kind);
      const label = j.kind === "other" && j.label ? j.label : kind.label;
      const names = (j.animalIds || []).map((id) => named(id)?.name).filter(Boolean);
      lines.push(
        `${j.at ? `${j.at} ` : ""}${label}` +
          (names.length ? `\n   ${names.join(", ")}` : "") +
          (j.note ? `\n   ${j.note}` : "")
      );
    });
  }

  const yardName = yard?.name || "Yard";
  return {
    to: person,
    subject: `${yardName}: your morning`,
    body: [`Morning ${person.name.split(" ")[0]},`, "", ...lines, "", "Any changes will come through here."].join("\n"),
    rideCount: rides.length,
    jobCount: jobs.length,
  };
}

/** Everyone who has anything to be told about today. */
export function dayMessages(plan, world, yard) {
  return (world.staff || [])
    .map((p) => dayMessage(plan, p, world, yard))
    .filter(Boolean)
    .sort((a, b) => a.to.name.localeCompare(b.to.name));
}

/** A tidy default for a broadcast, so the compose box is never empty. */
export const messageStamp = (now) =>
  new Date(now).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });

export const startOfPlanDay = (when) => startOfDay(when);
