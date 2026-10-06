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
import { DEFAULT_ACTIVITIES, DEFAULT_GALLOPS, DEFAULT_LOTS, emptyPlan, lotsOf, planKey } from "./jobs";
import { silksForOwner } from "../components/Silks";

export const VERSION = 11;

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
export function syncStalls(world, barn) {
  const existing = stallsOf(world, barn.id);
  const byPos = new Map(existing.map((s) => [`${s.r}:${s.c}`, s]));
  const kept = [];
  let i = 0;
  barn.cells
    .filter((c) => c.kind === "stall")
    .sort((a, b) => a.r - b.r || a.c - b.c)
    .forEach((c) => {
      i++;
      const was = byPos.get(`${c.r}:${c.c}`);
      if (was) kept.push({ ...was, index: i, name: was.renamed ? was.name : `Stall ${i}` });
      else kept.push(makeStall(barn.id, i, c.r, c.c));
    });
  const dropped = existing.filter((s) => !kept.some((k) => k.id === s.id));
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
   yard to ignore the app. Roughly one box in six has something worth seeing. */
const SCENARIO_POOL = [
  ...Array(34).fill("normal"),
  "lowIntake", "poorAir", "hot", "restless", "lameness", "sensorOffline", "cold",
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
    dam: rec.dam,
    damSire: rec.damSire,
    owner: rec.owner,
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
    // the owner's registered colours, matched on import where we hold them
    silks: rec.silks || silksForOwner(rec.owner)?.id || null,
    stallNote: "",
    noteLog: [],
    seenAs: null,
    notes: [],
    joined: Date.now(),
    ...extra,
  };
}

/* ------------------------------ the demo yard ----------------------------- */

const BARN1 = [
  ["Ndaawi", "sensorOffline"],
  ["Honesty Policy", "normal"],
  ["Wodhooh", "colic"],
  ["Romeo Coolio", "normal"],
  ["Brighterdaysahead", "normal"],
  ["Casheldale Lad", "poorAir"],
  ["Mordor", "hot"],
  ["Irish Point", "lameness"],
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
  const main = makeYard("Rathmore Lodge", "yard1");
  main.lots[0].gallopId = "gl_round";
  main.lots[1].gallopId = "gl_straight";
  main.lots[2].gallopId = "gl_hill";
  main.lots[3].gallopId = "gl_canter";

  const hill = makeYard("Hillside Yard", "yard2");
  hill.gallops = [
    { id: "gl_top", label: "Top Of The Hill", surface: "Grass", furlongs: 6 },
    { id: "gl_lower", label: "Lower Canter", surface: "Woodchip", furlongs: 5 },
    { id: "gl_sandring", label: "Sand Ring", surface: "Sand", furlongs: 2 },
  ];
  hill.lots = hill.lots.slice(0, 2);
  hill.lots[0].gallopId = "gl_top";
  hill.lots[1].gallopId = "gl_lower";

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

  const b1 = addBarn("Barn 1", 8);
  const b2 = addBarn("Barn 2", 12);
  const b3 = addBarn("Barn 3", 20);
  ["Barn 4", "Barn 5", "Barn 6", "Barn 7", "Barn 8", "Barn 9"].forEach((nm) => addBarn(nm, 0, false));

  // Barn 1 is the hand-built demo: named horses, one of each thing worth catching.
  const s1 = stallsOf(world, b1.id).sort((a, b) => a.index - b.index);
  BARN1.forEach(([name, scenario], i) => {
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
  const bright = world.animals.find((a) => a.name === "Brighterdaysahead");
  const cash = world.animals.find((a) => a.name === "Casheldale Lad");
  if (bright && cash) {
    bright.seenAs = cash.id;
    cash.seenAs = bright.id;
  }

  // the rest of the boxes are filled from the registry, mostly settled
  const pool = REGISTRY.filter((r) => !BARN1.some(([nm]) => nm === r.name));
  let p = 0;
  const fill = (barn, count, yardId) => {
    const stalls = stallsOf(world, barn.id).sort((a, b) => a.index - b.index);
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
  fill(b2, 10, main.id);
  fill(b3, 17, main.id);

  // the satellite: one barn working, one shed still to be laid out
  const h1 = addBarn("Hillside Barn", 12, true, hill.id);
  addBarn("Hillside Shed", 0, false, hill.id);
  fill(h1, 9, hill.id);

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
    "Honesty Policy": "Racing in Limerick 10/10/26 — cheekpieces",
    Wodhooh: "Vet due 09:00. No hard feed until seen.",
    Ndaawi: "Bucket by hand until the meter is fixed",
    "Irish Point": "Trot up before work — watch the off fore",
    Mordor: "Top door open, box runs warm",
    "Casheldale Lad": "Extra bedding, skip out again this evening",
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

  const boxes = mine.slice(0, 18).map((a) => a.id);
  plan.jobs = [
    { id: "jb_seed_1", kind: "muckout", staffId: hands[0]?.id || null, at: "06:30", animalIds: boxes.slice(0, 9), note: "Barn 1 and the top of Barn 2" },
    { id: "jb_seed_2", kind: "muckout", staffId: hands[1]?.id || null, at: "06:30", animalIds: boxes.slice(9, 18), note: "" },
    { id: "jb_seed_3", kind: "farrier", staffId: farrier?.id || null, at: "10:00", animalIds: mine.slice(2, 5).map((a) => a.id), note: "Front shoes, bring the travelling box in" },
    { id: "jb_seed_4", kind: "vet", staffId: vet?.id || null, at: "09:00", animalIds: mine.slice(2, 3).map((a) => a.id), note: "Scope before any hard feed" },
  ];

  world.ridePlan = { [planKey(yard.id, Date.now())]: plan };
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
