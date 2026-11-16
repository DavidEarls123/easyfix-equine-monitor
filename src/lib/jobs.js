/* ==========================================================================
   The job planner.

   Everything that is done TO a horse on a given day, by a named person, at a
   time: the farrier working down one barn, the vet seeing three before lunch,
   two going swimming, one on the lorry at six. All of it is one plan, because
   all of it competes for the same people and the same horses, and all of it
   has to end up in the message a member of staff gets at five in the morning.

   A job is a kind, the person doing it, a time, the horses it covers, and any
   activity tags on top of that. Activity tags belong to the operator, because
   the same yard group will use the same words across every yard it runs, and
   they are editable — a yard that calls it "the aqua" should see that in the
   text, not our guess.

   Mucking out and feeding are deliberately NOT here. They are not a day's
   plan, they are a standing round of boxes, and they live in rounds.js.
   ========================================================================== */

import { dayKey, startOfDay } from "./sim";
import { ROUND_KINDS, describeRound, roundFor } from "./rounds";

/* ------------------------------- what we ship ----------------------------- */

/** What a horse can be put down for. The yard edits this list. */
export const DEFAULT_ACTIVITIES = [
  { id: "ac_swim", label: "Swimming", colour: "#1296c0" },
  { id: "ac_walker", label: "Horse walker", colour: "#1baf7a" },
  { id: "ac_water", label: "Water walker", colour: "#0f8f96" },
  { id: "ac_lunge", label: "Lunge", colour: "#8a6fd0" },
  { id: "ac_school", label: "Schooling", colour: "#c2558a" },
  { id: "ac_hack", label: "Hack / road work", colour: "#a8761f" },
  { id: "ac_turnout", label: "Turnout", colour: "#5c8a3a" },
  { id: "ac_solarium", label: "Solarium", colour: "#d08a1f" },
];

/** The work of the day. `group` is the staff group offered first, `at` the
    hour it usually happens, so a card starts with a sensible time on it. */
export const JOB_KINDS = [
  { id: "exercise", label: "Exercise", group: "yard", icon: "right", colour: "#2a78d6", at: "08:00" },
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

/* --------------------------------- the plan ------------------------------- */

/** An empty day: no jobs on it. */
export const emptyPlan = () => ({ jobs: [] });

/** Plans are held per yard as well as per day — two yards have two mornings. */
export const planKey = (yardId, when) => `${yardId || "yard"}|${dayKey(when)}`;

/** The yard the app is currently looking at. Kept here so the planner has no
    dependency on world.js, which depends on this file for its defaults. */
export const planYard = (world) =>
  (world.yards || []).find((y) => y.id === world.yardId) || (world.yards || [])[0] || null;

/** The plan for a day at a yard, or a blank one. */
export function planFor(world, when, yard) {
  const y = yard || planYard(world);
  const stored = world.ridePlan?.[planKey(y?.id, when)];
  // a plan saved before a field existed — or before the lots came out — should
  // still read cleanly, so everything comes off a blank one
  return { ...emptyPlan(), ...(stored || {}), jobs: stored?.jobs || [] };
}

/* --------------------------------- reading -------------------------------- */

/** Every job a person is down for, earliest first. */
export function jobsOf(plan, staffId) {
  return (plan.jobs || [])
    .filter((j) => j.staffId === staffId)
    .slice()
    .sort((a, b) => (a.at || "").localeCompare(b.at || ""));
}

/** Everything a horse is down for today. */
export function dayOfAnimal(plan, animalId) {
  const jobs = (plan.jobs || []).filter((j) => (j.animalIds || []).includes(animalId));
  return { jobs };
}

/** What the plan adds up to — the line a manager checks before sending it. */
export function planSummary(plan, staff, animals) {
  const jobs = plan.jobs || [];
  const animalIds = new Set();
  jobs.forEach((j) => (j.animalIds || []).forEach((id) => animalIds.add(id)));
  const jobStaff = new Set(jobs.map((j) => j.staffId).filter(Boolean));
  return {
    jobs: jobs.length,
    horses: animalIds.size,
    people: jobStaff.size,
    jobStaff: jobStaff.size,
    unstaffedJobs: jobs.filter((j) => !j.staffId).length,
    emptyJobs: jobs.filter((j) => !(j.animalIds || []).length).length,
    untouched: (animals || []).filter((a) => !animalIds.has(a.id)).length,
  };
}

/* ------------------------------- the message ------------------------------ */

/**
 * What one person is sent. Built from the plan rather than typed, because a
 * manager who has to retype twenty jobs every morning will stop sending them.
 *
 * One message per person covering their whole day: their standing round of
 * boxes first, because that is what they start on, then anything booked in.
 */
export function dayMessage(plan, person, world, yard) {
  const jobs = jobsOf(plan, person.id);
  const rounds = ROUND_KINDS.map((k) => {
    const round = roundFor(world, k.id, person.id, yard?.id);
    return round && (round.stallIds || []).length ? { kind: k, round } : null;
  }).filter(Boolean);
  if (!jobs.length && !rounds.length) return null;

  const named = (id) => world.animals.find((a) => a.id === id);
  const lines = [];

  if (rounds.length) {
    lines.push(rounds.length === 1 ? "Your round:" : "Your rounds:");
    rounds.forEach(({ kind, round }) => {
      lines.push(`${kind.at} ${kind.label}\n   ${describeRound(world, round)}`);
    });
  }

  if (jobs.length) {
    if (lines.length) lines.push("");
    lines.push(jobs.length === 1 ? "Your job:" : `Your jobs (${jobs.length}):`);
    jobs.forEach((j) => {
      const kind = jobKind(j.kind);
      const label = j.kind === "other" && j.label ? j.label : kind.label;
      const names = (j.animalIds || []).map((id) => named(id)?.name).filter(Boolean);
      const tags = (j.activities || [])
        .map((id) => activityOf(world.settings, id)?.label)
        .filter(Boolean);
      lines.push(
        `${j.at ? `${j.at} ` : ""}${label}` +
          (tags.length ? ` — ${tags.join(" · ")}` : "") +
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
    jobCount: jobs.length,
    roundCount: rounds.length,
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
