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

export const VERSION = 5;

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
    goalL: 35,
    scenario: "normal",
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

/** The yard the app opens on: three fitted-out barns and six shells to configure. */
export function seedWorld() {
  const world = {
    version: VERSION,
    settings: { ...DEFAULT_SETTINGS },
    yards: [{ id: "yard1", name: "Yard 1" }],
    barns: [],
    stalls: [],
    animals: [],
    alertState: {},
    seenNotifications: {},
    log: [],
  };

  const addBarn = (name, stallCount, configured = true) => {
    const id = uid("bn_");
    const layout = configured ? makeLayout(stallCount) : { cols: 0, rows: 0, cells: [] };
    const barn = { id, yardId: "yard1", name, configured, ...layout, waterTankPct: 0, feedDays: 0, beddingDays: 0 };
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
    const animal = animalFromRecord(rec, { scenario, goalL: 32 + Math.round(noise(`g|${name}`) * 8) });
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

  // Barns 2 and 3 are filled from the registry, mostly settled.
  const pool = REGISTRY.filter((r) => !BARN1.some(([nm]) => nm === r.name));
  let p = 0;
  [
    [b2, 10],
    [b3, 17],
  ].forEach(([barn, count]) => {
    const stalls = stallsOf(world, barn.id).sort((a, b) => a.index - b.index);
    for (let i = 0; i < count && p < pool.length; i++, p++) {
      const rec = pool[p];
      const scenario = SCENARIO_POOL[Math.floor(noise(`sc|${rec.name}`) * SCENARIO_POOL.length)];
      const animal = animalFromRecord(rec, { scenario, goalL: 30 + Math.round(noise(`g|${rec.name}`) * 12) });
      world.animals.push(animal);
      stalls[i].animalId = animal.id;
    }
  });

  return world;
}

/** Bulk yard for the scale demo: a customer running 300 monitored boxes. */
export function bigYard(world, barnCount = 10, perBarn = 30) {
  const next = { ...world, barns: [...world.barns], stalls: [...world.stalls], animals: [...world.animals] };
  const start = next.barns.length + 1;
  for (let b = 0; b < barnCount; b++) {
    const id = uid("bn_");
    const layout = makeLayout(perBarn);
    const barn = {
      id,
      yardId: "yard1",
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
        goalL: 30 + Math.round(noise(`g|${st.id}`) * 12),
      });
      next.animals.push(animal);
      st.animalId = animal.id;
    });
  }
  return next;
}

export { uid };
