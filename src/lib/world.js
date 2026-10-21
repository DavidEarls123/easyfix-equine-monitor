/* ==========================================================================
   The yard itself: yards, barns, stall layouts, animals and settings.

   This is the part a customer configures, so it is the part that persists.
   Sensor history is never stored — it is derived from the stall seed in sim.js,
   which is what keeps a 300-stall yard cheap to hold in a browser.
   ========================================================================== */

import { REGISTRY, byName } from "./registry";
import { noise, between } from "./sim";
import { DEFAULT_WEIGHTS } from "./score";
import { DEFAULT_PASSPORT } from "./passport";
import { DEFAULT_BASELINE } from "./baseline";
import { DEFAULT_CARE, dueByNow, dueTimes } from "./care";
import { DEFAULT_HORSE_STYLE } from "./horse-style";
import { DEFAULT_ACTIVITIES, DEFAULT_GALLOPS, DEFAULT_LOTS, emptyPlan, lotsOf, planKey } from "./jobs";


export const VERSION = 16;

export const CELL = {
  stall: { label: "Stall", hint: "A monitored box" },
  aisle: { label: "Aisle", hint: "Walkway" },
  door: { label: "Door", hint: "Barn entrance" },
  tack: { label: "Tack room", hint: "Storage" },
  wash: { label: "Wash bay", hint: "Wash / vet bay" },
  feed: { label: "Feed store", hint: "Feed and bedding" },
  empty: { label: "Empty", hint: "Nothing here" },
};

export const DEFAULT_SETTINGS = {
  yardLabel: "Yard 1",
  operator: "Super Admin",
  email: "superadmin@easyfix.com",
  tempMin: 5,
  tempMax: 25,
  airMin: 80,
  humidityMax: 80,
  nh3Max: 10,
  intakeGoal: 35,
  intakeLowPct: 70,
  noDrinkHours: 6,
  camera: { identify: true, behaviour: true, minConfidence: 90, retentionDays: 14 },
  // how the horse is drawn on the feeds — a house preference, not a threshold
  horseStyle: DEFAULT_HORSE_STYLE,
  // how the welfare index is weighted — normalised at read time, so these
  // are relative to each other rather than required to total anything
  weights: { ...DEFAULT_WEIGHTS },
  // which external index profile creation searches
  passport: { ...DEFAULT_PASSPORT },
  // how the app learns what is normal for each individual horse
  baseline: { ...DEFAULT_BASELINE },
  // default rounds per day; a horse can override its own
  care: { ...DEFAULT_CARE },
  // what a horse can be down for on top of its lot, named by the operator and
  // shared across every yard they run
  activities: DEFAULT_ACTIVITIES.map((a) => ({ ...a })),
  // the hour a published morning goes out, if it is not sent there and then
  ridesSendAt: "05:30",
  notify: { push: true, email: true, sms: false, quietFrom: 22, quietTo: 6 },
};

let n = 0;
const uid = (p) => `${p}${Date.now().toString(36)}${(n++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/* ------------------------------- barn layout ------------------------------ */

/**
 * A double-sided barn: a row of boxes, an aisle, a row of boxes, with the
 * service rooms at the near end. Barn layouts are editable afterwards; this is
 * only the starting point offered when a barn is created.
 */
export function makeLayout(stallCount, opts = {}) {
  const perSide = Math.ceil(stallCount / 2);
  const cols = Math.max(2, perSide + (opts.services === false ? 0 : 1));
  const rows = 3;
  const cells = [];
  let made = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let kind = "empty";
      if (r === 1) kind = c === 0 ? "door" : "aisle";
      else if (c === 0) kind = r === 0 ? "tack" : "feed";
      else if (made < stallCount) {
        kind = "stall";
        made++;
      }
      cells.push({ r, c, kind });
    }
  }
  // fill the far side left-to-right rather than leaving a gap mid-row
  return { cols, rows, cells };
}

/**
 * A barn trimmed to the shape that was actually drawn.
 *
 * Not every shed is a rectangle. An L, a U and a T are all drawn on the same
 * grid with the corners left empty, and if the screens render the whole grid
 * those empty corners eat the space the boxes needed. So any row or column
 * with nothing in it at all is dropped — which trims the outside of an L
 * without closing the gap in the middle of a U, because that gap's column
 * still has the two arms in it.
 */
export function compactLayout(barn) {
  const cells = (barn?.cells || []).filter((c) => c.kind && c.kind !== "empty");
  if (!cells.length) return { cols: 0, rows: 0, grid: [] };

  const liveRows = [...new Set(cells.map((c) => c.r))].sort((a, b) => a - b);
  const liveCols = [...new Set(cells.map((c) => c.c))].sort((a, b) => a - b);
  const rowAt = new Map(liveRows.map((r, i) => [r, i]));
  const colAt = new Map(liveCols.map((c, i) => [c, i]));

  const at = new Map(cells.map((c) => [`${c.r}:${c.c}`, c]));
  const grid = [];
  liveRows.forEach((r) =>
    liveCols.forEach((c) => {
      const cell = at.get(`${r}:${c}`);
      grid.push(cell || { r, c, kind: "empty" });
    })
  );
  return { cols: liveCols.length, rows: liveRows.length, grid, rowAt, colAt };
}

export function stallsOf(world, barnId) {
  return world.stalls.filter((s) => s.barnId === barnId);
}
export function barnsOf(world, yardId) {
  return world.barns.filter((b) => b.yardId === yardId);
}

/* ------------------------------ one yard of many --------------------------- */

/* An operator is a trainer, and a trainer may run more than one yard: a main
   yard and a satellite up the road, each with its own barns, boxes, gallops and
   morning. Everything below answers "of the yard we are looking at". */

/** The yard the app is currently showing. */
export const currentYard = (world) =>
  (world.yards || []).find((y) => y.id === world.yardId) || (world.yards || [])[0] || null;

export const yardById = (world, yardId) => (world.yards || []).find((y) => y.id === yardId) || null;

export const barnsOfYard = (world, yardId = currentYard(world)?.id) =>
  world.barns.filter((b) => b.yardId === yardId);

export function stallsOfYard(world, yardId = currentYard(world)?.id) {
  const mine = new Set(barnsOfYard(world, yardId).map((b) => b.id));
  return world.stalls.filter((s) => mine.has(s.barnId));
}

/** Horses are held against a yard directly, so one standing in no box still
    belongs somewhere. Anything seeded before yards were separable counts as
    the first yard rather than disappearing. */
export function animalsOfYard(world, yardId = currentYard(world)?.id) {
  const first = (world.yards || [])[0]?.id;
  return world.animals.filter((a) => (a.yardId || first) === yardId);
}

/** Which yard a barn, box or horse sits in. */
export function yardOfBarn(world, barnId) {
  const barn = world.barns.find((b) => b.id === barnId);
  return barn ? yardById(world, barn.yardId) : null;
}
export function animalOf(world, animalId) {
  return world.animals.find((a) => a.id === animalId) || null;
}
export function stallOfAnimal(world, animalId) {
  return world.stalls.find((s) => s.animalId === animalId) || null;
}
export function barnOf(world, barnId) {
  return world.barns.find((b) => b.id === barnId) || null;
}
export function stallById(world, stallId) {
  return world.stalls.find((s) => s.id === stallId) || null;
}

/** Build the stall records for a barn from its layout, keeping any existing ones. */
/**
 * Rebuild a barn's boxes from its layout, keeping the ones that already exist.
 *
 * A box is matched by the id the layout cell carries, not by where it sits, so
 * moving a box in the editor moves the box — the horse in it, its name, its
 * camera and its history go with it. Only a cell with no id at all is a new
 * box. Layouts drawn before cells carried ids fall back to matching on
 * position, so an existing yard does not lose its boxes on first open.
 */
export function syncStalls(world, barn) {
  const existing = stallsOf(world, barn.id);
  const byId = new Map(existing.map((s) => [s.id, s]));
  const byPos = new Map(existing.map((s) => [`${s.r}:${s.c}`, s]));
  const claimed = new Set();
  const cells = barn.cells.filter((c) => c.kind === "stall").sort((a, b) => a.r - b.r || a.c - b.c);

  // ids first, so a box that moved cannot be stolen by whatever took its place
  const matched = cells.map((c) => {
    const was = c.sid ? byId.get(c.sid) : null;
    if (was && !claimed.has(was.id)) {
      claimed.add(was.id);
      return was;
    }
    return null;
  });
  cells.forEach((c, k) => {
    if (matched[k]) return;
    const was = byPos.get(`${c.r}:${c.c}`);
    if (was && !claimed.has(was.id)) {
      claimed.add(was.id);
      matched[k] = was;
    }
  });

  const kept = cells.map((c, k) => {
    const i = k + 1;
    const was = matched[k];
    return was
      ? { ...was, r: c.r, c: c.c, index: i, name: was.renamed ? was.name : `Stall ${i}` }
      : makeStall(barn.id, i, c.r, c.c);
  });

  const dropped = existing.filter((s) => !claimed.has(s.id));
  const others = world.stalls.filter((s) => s.barnId !== barn.id);
  return { stalls: [...others, ...kept], dropped };
}

export function makeStall(barnId, index, r, c) {
  const id = uid("st_");
  return {
    id,
    barnId,
    index,
    name: `Stall ${index}`,
    r,
    c,
    animalId: null,
    camera: true,
    seed: id,
    warmth: Math.round((noise(`w|${id}`) * 1.8 - 0.6) * 10) / 10,
  };
}

/* --------------------------------- animals -------------------------------- */

/* Most horses are fine most days — a demo that flags half the yard teaches the
   yard to ignore the app. Roughly one box in six has something worth seeing.

   These are real, named horses, so the demo only ever simulates the box and the
   kit — a warm box, poor air, a meter that has stopped, a horse off its water.
   Nothing here invents an illness in somebody's horse. Anything stronger is set
   deliberately, per horse, on its profile. */
const SCENARIO_POOL = [
  ...Array(26).fill("normal"),
  "lowIntake", "poorAir", "hot", "sensorOffline", "cold",
];

/** Demo horses arrived weeks or months ago, so they have history to learn from. */
const joinedLongAgo = (seed) => Date.now() - Math.round(between(`joined|${seed}`, 45, 400)) * 86400000;

export function animalFromRecord(rec, extra = {}) {
  return {
    id: uid("an_"),
    name: rec.name,
    passportId: rec.id,
    sex: rec.sex,
    colour: rec.colour,
    foaled: rec.foaled,
    breed: rec.breed,
    sire: rec.sire,
    sireCountry: rec.sireCountry,
    sireDist: rec.sireDist,
    dam: rec.dam,
    damCountry: rec.damCountry,
    damSire: rec.damSire,
    damSireCountry: rec.damSireCountry,
    damSireDist: rec.damSireDist,
    country: rec.country,
    owner: rec.owner,
    // the owner is the link to the colours: several owners here carry the same
    // registered set, so the set is never copied onto the horse
    ownerId: rec.ownerId || null,
    trainer: rec.trainer,
    breeder: rec.breeder,
    markings: rec.markings,
    microchip: rec.microchip,
    ueln: rec.ueln,
    height: rec.height,
    source: rec.source,
    yardId: null,
    goalL: 35,
    scenario: "normal",
    groom: rec.groom || "",
    // only set when this horse runs in something other than its owner's colours
    silks: rec.silks || null,
    stallNote: "",
    noteLog: [],
    seenAs: null,
    notes: [],
    joined: Date.now(),
    ...extra,
  };
}

/* ------------------------------ the demo yard ----------------------------- */

/* Barn 1 is the hand-built corner of the demo: the horses whose boxes show one
   of each thing worth catching, named so the walkthrough is repeatable. Every
   one of these is a box or a meter, never the horse itself. */
const BARN1 = [
  ["Comanche Brave", "sensorOffline"],
  ["A Boy Named Susie", "normal"],
  ["Balantina", "lowIntake"],
  ["Dee's Funny Girl", "normal"],
  ["Where Love Lives", "normal"],
  ["Shaihaan", "poorAir"],
  ["Glyfada", "hot"],
  ["Josh's Joy", "normal"],
];

/** A yard as the operator sets one up: a name, the lots it runs and the ground
    it works on. Every yard carries its own, because they are different places. */
export function makeYard(name, id = uid("yd_")) {
  return {
    id,
    name,
    lots: DEFAULT_LOTS.map((l, i) => ({ id: `lot${i + 1}`, ...l, gallopId: null })),
    gallops: DEFAULT_GALLOPS.map((g) => ({ ...g })),
  };
}

/**
 * The demo operator: a main yard of three fitted-out barns and six shells, and
 * a satellite up the road. Two yards rather than one because a trainer with a
 * second yard is the normal case, and a product that assumes one hides it.
 */
export function seedWorld() {
  const main = makeYard("Bawnmore", "yard1");
  main.lots[0].gallopId = "gl_round";
  main.lots[1].gallopId = "gl_straight";
  main.lots[2].gallopId = "gl_hill";
  main.lots[3].gallopId = "gl_canter";

  const hill = makeYard("Yearling Yard", "yard2");
  // a yearling yard is breaking and long-reining, not working on a gallop
  hill.gallops = [
    { id: "gl_sandring", label: "Sand Ring", surface: "Sand", furlongs: 2 },
    { id: "gl_lunge", label: "Lunge Ring", surface: "Sand", furlongs: 1 },
    { id: "gl_longwalk", label: "The Long Walk", surface: "Woodchip", furlongs: 4 },
  ];
  hill.lots = hill.lots.slice(0, 2);
  hill.lots[0].gallopId = "gl_sandring";
  hill.lots[1].gallopId = "gl_longwalk";

  const world = {
    version: VERSION,
    settings: { ...DEFAULT_SETTINGS },
    yards: [main, hill],
    yardId: main.id,
    barns: [],
    stalls: [],
    animals: [],
    alertState: {},
    careLog: [],
    staff: [],
    rounds: [],
    ridePlan: {},
    messages: [],
    seenNotifications: {},
    log: [],
  };

  const addBarn = (name, stallCount, configured = true, yardId = main.id) => {
    const id = uid("bn_");
    const layout = configured ? makeLayout(stallCount) : { cols: 0, rows: 0, cells: [] };
    const barn = { id, yardId, name, configured, ...layout, waterTankPct: 0, feedDays: 0, beddingDays: 0 };
    world.barns.push(barn);
    if (configured) {
      const synced = syncStalls(world, barn);
      world.stalls = synced.stalls;
      barn.waterTankPct = Math.round(between(`tank|${id}`, 35, 95));
      barn.feedDays = Math.round(between(`feed|${id}`, 3, 21));
      barn.beddingDays = Math.round(between(`bed|${id}`, 2, 18));
    }
    return barn;
  };

  const b1 = addBarn("Barn 1", 20);
  const b2 = addBarn("Barn 2", 12);
  const b3 = addBarn("Barn 3", 20);
  ["Barn 4", "Barn 5", "Barn 6", "Barn 7", "Barn 8", "Barn 9"].forEach((nm) => addBarn(nm, 0, false));

  /* How full the working barns are kept. A yard is not run at a hundred per
     cent: a box is always coming free as something goes out or comes back, and
     a demo with every door shut has nowhere to put a horse. All three working
     barns sit at nine tenths, which is 47 of the 52 boxes. */
  const FULL = 0.9;
  const boxesIn = (barn) => stallsOf(world, barn.id).length;
  const takes = (barn) => Math.round(boxesIn(barn) * FULL);

  // Barn 1 is the hand-built demo: named horses, one of each thing worth catching.
  const s1 = stallsOf(world, b1.id).sort((a, b) => a.index - b.index);
  BARN1.slice(0, takes(b1)).forEach(([name, scenario], i) => {
    const rec = byName(name);
    if (!rec || !s1[i]) return;
    const animal = animalFromRecord(rec, {
      scenario,
      yardId: main.id,
      goalL: 32 + Math.round(noise(`g|${name}`) * 8),
      joined: joinedLongAgo(name),
    });
    world.animals.push(animal);
    s1[i].animalId = animal.id;
  });

  // Two of them were moved between boxes without anyone updating the app — the
  // camera notices, which is the identity check the product is sold on.
  const bright = world.animals.find((a) => a.name === "Where Love Lives");
  const cash = world.animals.find((a) => a.name === "Dee's Funny Girl");
  if (bright && cash) {
    bright.seenAs = cash.id;
    cash.seenAs = bright.id;
  }

  /* The rest of the boxes are filled from the passport index, mostly settled.
     The index is in order — the string in training first, then the made-up
     horses — so the real ones go in before anything invented is reached for,
     and whatever is not needed stays in the index to be imported later. */
  const housed = new Set(world.animals.map((a) => a.name));
  const pool = REGISTRY.filter((r) => !housed.has(r.name));
  let p = 0;
  const fill = (barn, count, yardId) => {
    const stalls = stallsOf(world, barn.id)
      .filter((st) => !st.animalId)
      .sort((a, b) => a.index - b.index);
    for (let i = 0; i < count && p < pool.length; i++, p++) {
      const rec = pool[p];
      const scenario = SCENARIO_POOL[Math.floor(noise(`sc|${rec.name}`) * SCENARIO_POOL.length)];
      const animal = animalFromRecord(rec, {
        scenario,
        yardId,
        goalL: 30 + Math.round(noise(`g|${rec.name}`) * 12),
        joined: joinedLongAgo(rec.name),
      });
      world.animals.push(animal);
      stalls[i].animalId = animal.id;
    }
  };
  // Barn 1 is topped up past its named horses, then the other two
  fill(b1, takes(b1) - stallsOf(world, b1.id).filter((st) => st.animalId).length, main.id);
  fill(b2, takes(b2), main.id);
  fill(b3, takes(b3), main.id);

  /* The second yard is laid out and standing empty — this year's crop has not
     come in yet. It is here to show the app handles a second yard, so it has
     boxes to put horses in rather than horses in them. */
  addBarn("Barn 1", 16, true, hill.id);
  addBarn("Barn 2", 0, false, hill.id);

  return seedPlan(seedStaff(seedCare(world)));
}

/** Bulk yard for the scale demo: a customer running 300 monitored boxes. */
export function bigYard(world, barnCount = 10, perBarn = 30) {
  const next = { ...world, barns: [...world.barns], stalls: [...world.stalls], animals: [...world.animals] };
  const yardId = currentYard(next)?.id || next.yards[0]?.id;
  const start = barnsOfYard(next, yardId).length + 1;
  for (let b = 0; b < barnCount; b++) {
    const id = uid("bn_");
    const layout = makeLayout(perBarn);
    const barn = {
      id,
      yardId,
      name: `Barn ${start + b}`,
      configured: true,
      ...layout,
      waterTankPct: Math.round(between(`tank|${id}`, 40, 98)),
      feedDays: Math.round(between(`feed|${id}`, 4, 20)),
      beddingDays: Math.round(between(`bed|${id}`, 3, 16)),
    };
    next.barns.push(barn);
    const synced = syncStalls(next, barn);
    next.stalls = synced.stalls;
    const stalls = next.stalls.filter((s) => s.barnId === id).sort((a, b) => a.index - b.index);
    stalls.forEach((st, i) => {
      if (noise(`occ|${st.id}`) < 0.12) return; // a few empty boxes, as in life
      const rec = REGISTRY[(b * perBarn + i) % REGISTRY.length];
      const scenario = SCENARIO_POOL[Math.floor(noise(`sc|${st.id}`) * SCENARIO_POOL.length)];
      const animal = animalFromRecord(rec, {
        name: `${rec.name} ${String.fromCharCode(65 + (b % 26))}${i + 1}`,
        scenario,
        yardId,
        goalL: 30 + Math.round(noise(`g|${st.id}`) * 12),
        joined: joinedLongAgo(st.id),
      });
      next.animals.push(animal);
      st.animalId = animal.id;
    });
  }
  return seedCare(next);
}

export { uid };

/* --------------------------- the day's care record ------------------------- */

/**
 * A believable morning: most boxes done on time, a few behind. Without this the
 * stall screens all read 0 of 3 and the feature looks broken rather than idle.
 */
function seedCare(world) {
  const now = Date.now();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const grooms = ["Graham", "Aoife", "Danny", "Marta", "Sean"];
  const log = [];

  world.stalls.forEach((st) => {
    if (!st.animalId) return;
    const animal = world.animals.find((a) => a.id === st.animalId);
    if (!animal) return;
    const target = { ...DEFAULT_CARE, ...(animal.care || {}) };
    ["feed", "clean"].forEach((kind) => {
      const want = kind === "feed" ? target.feeds : target.cleans;
      const due = dueByNow(want, now);
      // roughly one box in five is a round behind, which is what a yard looks like
      const slip = noise(`slip|${st.id}|${kind}`) < 0.2 ? 1 : 0;
      const doneCount = Math.max(0, due - slip);
      dueTimes(want)
        .slice(0, doneCount)
        .forEach((hour, i) => {
          const at = dayStart.getTime() + Math.round((hour + between(`late|${st.id}|${kind}|${i}`, -0.15, 0.45)) * 3600000);
          if (at > now) return;
          log.push({
            id: `cr_seed_${st.id}_${kind}_${i}`,
            at,
            stallId: st.id,
            animalId: animal.id,
            kind,
            by: grooms[Math.floor(noise(`who|${st.id}|${kind}|${i}`) * grooms.length) % grooms.length],
          });
        });
    });
  });

  world.careLog = log.sort((a, b) => b.at - a.at);

  // the lines a yard actually pins to a box front
  const notes = {
    "A Boy Named Susie": "Entered at Naas Saturday — travelling box 06:00",
    Balantina: "Off her water since yesterday evening. Tell the vet at 09:00.",
    "Comanche Brave": "Bucket by hand until the meter is fixed",
    Glyfada: "Top door open, box runs warm",
    Shaihaan: "Extra bedding, skip out again this evening",
    "Dee's Funny Girl": "Hind shoes with the farrier at ten",
  };
  world.animals.forEach((a, i) => {
    if (notes[a.name]) {
      a.stallNote = notes[a.name];
      a.noteLog = [{ at: Date.now() - 3600000 * (2 + (i % 9)), text: notes[a.name], by: "Declan Murphy" }];
    }
  });
  return world;
}

/* ------------------------------- the day's work ---------------------------- */

/**
 * A morning already half planned, so the planner opens on something rather than
 * on an empty grid. Two lots out, a few horses doing more than cantering, and
 * the work that is not ridden: two people on the boxes, the farrier, the vet.
 */
function seedPlan(world) {
  const yard = world.yards[0];
  const plan = emptyPlan(lotsOf(yard));
  const riders = world.staff.filter((p) => (p.groups || []).includes("riders") && p.riding !== false);
  const mine = world.animals.filter((a) => a.yardId === yard.id);
  const hands = world.staff.filter((p) => (p.groups || []).includes("yard"));
  const farrier = world.staff.find((p) => (p.groups || []).includes("farriers"));
  const vet = world.staff.find((p) => (p.groups || []).includes("vets"));

  // the usual pattern: a working lot and then a steadier one
  const shape = [
    { ride: 6, distance: 6, tags: ["ac_work"] },
    { ride: 5, distance: 4, tags: ["ac_canter"] },
  ];
  let h = 0;
  plan.lots.slice(0, shape.length).forEach((lot, li) => {
    const { ride, distance, tags } = shape[li];
    riders.slice(0, ride).forEach((p, i) => {
      const animal = mine[h++];
      if (!animal) return;
      const extra = i === 1 ? ["ac_walker"] : i === 3 ? ["ac_swim"] : [];
      lot.rides.push({
        id: `rd_seed_${li}_${i}`,
        riderId: p.id,
        animalId: animal.id,
        distanceF: distance + (i % 3 === 0 ? 1 : 0),
        activities: [...tags, ...extra],
        note: i === 0 && li === 0 ? "Upsides with the grey, don't go past him" : "",
      });
    });
  });

  plan.jobs = [
    { id: "jb_seed_3", kind: "farrier", staffId: farrier?.id || null, at: "10:00", animalIds: mine.slice(2, 5).map((a) => a.id), note: "Front shoes, bring the travelling box in" },
    { id: "jb_seed_4", kind: "vet", staffId: vet?.id || null, at: "09:00", animalIds: mine.slice(2, 3).map((a) => a.id), note: "Scope before any hard feed" },
  ];

  world.ridePlan = { [planKey(yard.id, Date.now())]: plan };
  return seedRounds(world, hands);
}

/**
 * The standing rounds. A yard splits its boxes between the grooms a barn at a
 * time and leaves it that way, so the demo opens with the boxes already
 * divided up rather than with nobody doing anything.
 */
function seedRounds(world, hands) {
  const rounds = [];
  let i = 0;
  world.barns
    .filter((b) => b.configured && world.stalls.some((st) => st.barnId === b.id && st.animalId))
    .forEach((barn) => {
      const stalls = world.stalls
        .filter((st) => st.barnId === barn.id)
        .sort((a, b) => a.index - b.index);
      // a barn is split between no more than two people, in runs
      const parts = stalls.length > 10 ? 2 : 1;
      const size = Math.ceil(stalls.length / parts);
      for (let p = 0; p < parts; p++) {
        const person = hands[i++ % Math.max(1, hands.length)];
        if (!person) return;
        const mine = stalls.slice(p * size, (p + 1) * size);
        if (!mine.length) continue;
        ["muckout", "feed"].forEach((kind) =>
          rounds.push({
            id: `rd_seed_${kind}${rounds.length}`,
            kind,
            staffId: person.id,
            yardId: barn.yardId,
            stallIds: mine.map((st) => st.id),
            at: kind === "muckout" ? "06:30" : "07:00",
            note: "",
          })
        );
      }
    });
  world.rounds = rounds;
  return world;
}

/* ---------------------------------- people --------------------------------- */

const STAFF = `
Graham Nolan|riders,yard|087 214 6650
Aoife Brennan|riders,yard|086 771 2019
Danny Kearns|riders|085 330 4471
Marta Kowalski|riders,yard|083 908 5512
Sean Fitzgerald|riders|087 445 8830
Niamh O'Dwyer|riders|086 220 7743
Tom Hegarty|riders|085 617 9902
Ciara Walsh|riders,yard|083 774 3318
Pawel Nowak|riders,yard|087 991 2264
Eimear Ryan|riders|086 508 1177
Liam Costello|riders|085 229 6640
Katie Moran|riders,yard|083 116 4492
Joe Brady|yard|087 660 3315
Sinead Cullen|yard|086 337 8820
Marek Zielinski|yard|085 774 1163
Orla Byrne|yard|083 442 9908
Declan Murphy|management|087 118 2250
Fiona Keane|management|086 903 7741
Martin Slattery|farriers|085 550 3327
Hugh Dalton|vets|087 802 6614
Rachel Lyons|vets|086 441 9975
`.trim();

function seedStaff(world) {
  world.staff = STAFF.split("\n").map((line, i) => {
    const [name, groups, phone] = line.split("|");
    const slug = name.toLowerCase().replace(/[^a-z]+/g, ".");
    return {
      id: `sf_seed_${i}`,
      name,
      email: `${slug}@easyfixracing.ie`,
      phone,
      groups: groups.split(","),
      // most riders are out, one or two are not — a day off, a bad back
      riding: !groups.includes("riders") ? false : noise(`ride|${name}`) > 0.12,
    };
  });

  // every box has somebody who does it, and the stall screen names them
  const yardHands = world.staff.filter((p) => p.groups.includes("yard"));
  world.animals.forEach((a, i) => {
    if (!a.groom && yardHands.length) a.groom = yardHands[i % yardHands.length].name;
  });
  return world;
}
