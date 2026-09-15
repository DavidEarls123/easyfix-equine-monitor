/* ==========================================================================
   The insight layer: turn simulated readings into things a yard would act on.

   Every alert carries a recommendation, because a number on a screen at 3am is
   not what the customer is buying — knowing what to do about it is. Alert ids
   are stable for the day so an acknowledgement sticks across a reload.
   ========================================================================== */

import { today, trailing, cameraEvents, behaviourAt, identityCheck, dayKey, startOfDay, DAY_MS, HOUR_MS } from "./sim";
import { animalOf, stallsOf } from "./world";
import { yardWelfare } from "./score";

export const RANK = { critical: 0, serious: 1, warning: 2, good: 3, info: 4 };
export const bySeverity = (a, b) => RANK[a.severity] - RANK[b.severity] || b.ts - a.ts;

const mk = (o) => ({ severity: "warning", actions: [], ...o });

/* ---------------------------- one stall at a time -------------------------- */

/** Everything the app knows about one stall right now. */
export function stallState(world, stall, now) {
  const animal = stall.animalId ? animalOf(world, stall.animalId) : null;
  const t = today(stall, animal, now);
  const past = trailing(stall, animal, now, 6);
  const behaviour = animal ? behaviourAt(stall, animal, now) : null;
  const id = animal ? identityCheck(stall, animal, now) : null;
  const events = animal ? cameraEvents(stall, animal, startOfDay(now)).filter((e) => e.at <= now) : [];
  return { stall, animal, today: t, past, behaviour, identity: id, events };
}

/** Alerts raised by one stall, newest state first. */
export function stallAlerts(world, st, now) {
  const { stall, animal, today: t, behaviour, identity, events } = st;
  if (!animal) return [];
  const s = world.settings;
  const key = dayKey(now);
  const base = { scope: "animal", barnId: stall.barnId, stallId: stall.id, animalId: animal.id, ts: now };
  const where = `${animal.name} · ${stall.name}`;
  const out = [];

  if (t.offline) {
    out.push(
      mk({
        ...base,
        id: `flow:${stall.id}:${key}`,
        severity: "critical",
        kind: "sensor",
        title: `No water data from ${stall.name}`,
        detail: `${where} — the flow meter has reported nothing today. Intake cannot be confirmed.`,
        recommendation: "Check the meter's isolation valve and battery, and water the horse by bucket until readings return.",
        actions: [{ id: "openStall", label: "Open stall" }, { id: "openCamera", label: "Watch camera" }],
      })
    );
  } else {
    // a percentage on its own fires on any quiet morning, so the shortfall has
    // to be worth walking down the yard for as well
    const pct = t.pctOfGoal;
    const short = Math.round((t.expectedL - t.intakeL) * 10) / 10;
    if (pct < 50 && short >= 5)
      out.push(
        mk({
          ...base,
          id: `intake:${stall.id}:${key}`,
          severity: "critical",
          kind: "intake",
          title: `${animal.name} is barely drinking`,
          detail: `${t.intakeL} L so far against ${t.expectedL} L expected by now — ${pct}% of the pace for a ${t.goal} L day, and a 6-day average of ${st.past.intakeL} L.`,
          recommendation: "Check the drinker flows and the water is clean, then take a temperature and gut sounds. Call the vet if nothing has changed by the next feed.",
          actions: [{ id: "openAnimal", label: "Open profile" }, { id: "openCamera", label: "Watch camera" }],
        })
      );
    else if (pct < s.intakeLowPct && short >= 3)
      out.push(
        mk({
          ...base,
          id: `intake:${stall.id}:${key}`,
          severity: "warning",
          kind: "intake",
          title: `${animal.name} is behind on water`,
          detail: `${t.intakeL} L so far against ${t.expectedL} L expected by now — ${pct}% of the pace for a ${t.goal} L day (6-day average ${st.past.intakeL} L).`,
          recommendation: "Check the drinker for airlocks and offer a fresh bucket at the next feed. Worth a second look this evening.",
          actions: [{ id: "openAnimal", label: "Open profile" }],
        })
      );

    if (t.hoursSinceDrink > s.noDrinkHours && behaviour?.state !== "turnout")
      out.push(
        mk({
          ...base,
          id: `dry:${stall.id}:${key}`,
          severity: "serious",
          kind: "intake",
          title: `No drinking event for ${Math.floor(t.hoursSinceDrink)} h`,
          detail: `${where} — last measured draw ${t.lastDrinkAt ? new Date(t.lastDrinkAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "not today"}.`,
          recommendation: "Confirm the drinker is delivering, then watch for gut sounds and droppings. Persistent refusal to drink is an early colic sign.",
          actions: [{ id: "openCamera", label: "Watch camera" }],
        })
      );
  }

  if (t.tempNow != null) {
    if (t.tempNow > s.tempMax + 4)
      out.push(
        mk({
          ...base,
          id: `hot:${stall.id}:${key}`,
          severity: "serious",
          kind: "temp",
          title: `${stall.name} is ${t.tempNow}°C`,
          detail: `${where} — ${Math.round(t.tempNow - s.tempMax)}°C above the comfort ceiling of ${s.tempMax}°C, peaking at ${t.tempMax}°C today.`,
          recommendation: "Open the top door and ridge vents, add a second water source, and hold off rugging until the box drops back under 25°C.",
          actions: [{ id: "openBarn", label: "Open barn" }],
        })
      );
    else if (t.tempNow > s.tempMax)
      out.push(
        mk({
          ...base,
          id: `hot:${stall.id}:${key}`,
          severity: "warning",
          kind: "temp",
          title: `${stall.name} above comfort range`,
          detail: `${where} — ${t.tempNow}°C against a ${s.tempMin}–${s.tempMax}°C band.`,
          recommendation: "Increase ventilation on this side of the barn and check the horse is not over-rugged.",
          actions: [{ id: "openBarn", label: "Open barn" }],
        })
      );
    else if (t.tempNow < s.tempMin)
      out.push(
        mk({
          ...base,
          id: `cold:${stall.id}:${key}`,
          severity: "warning",
          kind: "temp",
          title: `${stall.name} is cold at ${t.tempNow}°C`,
          detail: `${where} — below the ${s.tempMin}°C floor. Overnight low ${t.tempMin}°C.`,
          recommendation: "Check for a draught from the far door, add a rug, and confirm the horse is dry after work.",
          actions: [{ id: "openBarn", label: "Open barn" }],
        })
      );
  }

  if (t.airNow < s.airMin - 10)
    out.push(
      mk({
        ...base,
        id: `air:${stall.id}:${key}`,
        severity: "serious",
        kind: "air",
        title: `Air quality poor in ${stall.name}`,
        detail: `${where} — score ${t.airNow}%, ammonia ${t.nh3Now} ppm (limit ${s.nh3Max} ppm), humidity ${t.humidityNow}%.`,
        recommendation: "Muck out fully rather than deep-littering, lift the bedding off the floor to dry, and leave the top door open overnight.",
        actions: [{ id: "openBarn", label: "Open barn" }],
      })
    );
  else if (t.airNow < s.airMin)
    out.push(
      mk({
        ...base,
        id: `air:${stall.id}:${key}`,
        severity: "warning",
        kind: "air",
        title: `Air quality slipping in ${stall.name}`,
        detail: `${where} — score ${t.airNow}%, ammonia ${t.nh3Now} ppm.`,
        recommendation: "Skip out again this evening and check the ventilation path is not blocked by stored bedding.",
        actions: [{ id: "openBarn", label: "Open barn" }],
      })
    );

  if (identity?.mismatch && world.settings.camera.identify) {
    const seen = animalOf(world, animal.seenAs);
    out.push(
      mk({
        ...base,
        id: `ident:${stall.id}:${key}`,
        severity: "serious",
        kind: "identity",
        title: `Identity mismatch in ${stall.name}`,
        detail: `The camera recognises ${seen ? seen.name : "another horse"} in ${stall.name} at ${identity.conf}% confidence, but the app has ${animal.name} here.`,
        recommendation: seen
          ? `If ${animal.name} and ${seen.name} were swapped over, update the stall assignment so the intake history follows the right horse.`
          : "Confirm which horse is in the box and update the assignment.",
        actions: seen
          ? [{ id: "swapStalls", label: `Swap with ${seen.name}` }, { id: "openCamera", label: "Watch camera" }]
          : [{ id: "openCamera", label: "Watch camera" }],
      })
    );
  }

  if (world.settings.camera.behaviour) {
    const worst = events.filter((e) => e.severity === "critical" || e.severity === "serious").pop();
    const restless = events.filter((e) => e.kind === "restless");
    if (worst) {
      const at = new Date(worst.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const colic = worst.kind === "cast" || worst.kind === "flank";
      out.push(
        mk({
          ...base,
          id: `cam:${worst.kind}:${stall.id}:${key}`,
          severity: worst.severity,
          kind: "camera",
          title: colic ? `Possible colic — ${animal.name}` : `${worst.title} — ${animal.name}`,
          detail: `${worst.detail} at ${at}, ${worst.mins} min, ${worst.conf}% confidence.`,
          recommendation: colic
            ? "Go to the box now. Check pulse, gut sounds and droppings, remove feed, and have the vet's number to hand — this pattern with falling water intake is the classic early colic picture."
            : "Trot the horse up in hand on a hard surface and check for heat and digital pulse in the off fore before work tomorrow.",
          actions: [{ id: "openCamera", label: "Review clip" }, { id: "openAnimal", label: "Open profile" }],
          at: worst.at,
        })
      );
    } else if (restless.length >= 3) {
      out.push(
        mk({
          ...base,
          id: `cam:restless:${stall.id}:${key}`,
          severity: "warning",
          kind: "camera",
          title: `${animal.name} unsettled`,
          detail: `${restless.length} box-walking spells recorded today, ${restless.reduce((a, e) => a + e.mins, 0)} min in total.`,
          recommendation: "Try more forage in front of the horse and a companion in sight; if it continues, review turnout and workload.",
          actions: [{ id: "openCamera", label: "Watch camera" }],
        })
      );
    }
  }

  return out;
}

/* ------------------------------ barns and yard ---------------------------- */

export function barnRollup(world, barn, now) {
  const stalls = stallsOf(world, barn.id);
  const states = stalls.map((s) => stallState(world, s, now));
  const live = states.filter((s) => s.animal);
  const avg = (f) => (live.length ? live.reduce((a, x) => a + f(x), 0) / live.length : 0);
  const alerts = live.flatMap((s) => stallAlerts(world, s, now));
  return {
    barn,
    stalls,
    states,
    occupied: live.length,
    intakeL: Math.round(avg((s) => s.today.intakeL) * 10) / 10,
    pctOfGoal: Math.round(avg((s) => (s.today.offline ? 100 : s.today.pctOfGoal))),
    tempC: Math.round(avg((s) => s.today.tempNow ?? 0) * 10) / 10,
    air: Math.round(avg((s) => s.today.airNow) * 10) / 10,
    humidity: Math.round(avg((s) => s.today.humidityNow)),
    alerts,
    worst: alerts.slice().sort(bySeverity)[0] || null,
  };
}

export function barnAlerts(world, roll, now) {
  const s = world.settings;
  const b = roll.barn;
  const key = dayKey(now);
  const base = { scope: "barn", barnId: b.id, ts: now, actions: [{ id: "openBarn", label: "Open barn" }] };
  const out = [];

  if (!b.configured) {
    out.push(
      mk({
        ...base,
        id: `setup:${b.id}`,
        severity: "info",
        kind: "setup",
        title: `${b.name} is not laid out yet`,
        detail: "No stalls have been placed, so nothing in this barn is being monitored.",
        recommendation: "Open the barn's layout editor and place the boxes to match the building.",
        actions: [{ id: "openLayout", label: "Set up layout" }],
      })
    );
    return out;
  }
  if (!roll.occupied) return out;

  if (roll.tempC > s.tempMax)
    out.push(
      mk({
        ...base,
        id: `barnhot:${b.id}:${key}`,
        severity: "warning",
        kind: "temp",
        title: `${b.name} is running hot`,
        detail: `${roll.tempC}°C average across ${roll.occupied} occupied boxes, ceiling ${s.tempMax}°C.`,
        recommendation: "Open both ends of the barn and run the ridge extraction through the afternoon.",
      })
    );
  if (roll.air < s.airMin)
    out.push(
      mk({
        ...base,
        id: `barnair:${b.id}:${key}`,
        severity: "warning",
        kind: "air",
        title: `${b.name} air quality below target`,
        detail: `${roll.air}% average score, humidity ${roll.humidity}%.`,
        recommendation: "Bring the muck-out forward and check the inlet vents at the low end are clear.",
      })
    );

  const dry = roll.states.filter((x) => x.animal && !x.today.offline && x.today.pctOfGoal < s.intakeLowPct);
  if (dry.length >= 3)
    out.push(
      mk({
        ...base,
        id: `supply:${b.id}:${key}`,
        severity: "serious",
        kind: "intake",
        title: `Water supply suspect in ${b.name}`,
        detail: `${dry.length} boxes are behind on intake at the same time — ${dry.map((x) => x.animal.name).slice(0, 4).join(", ")}${dry.length > 4 ? "…" : ""}.`,
        recommendation: "Check the header tank level and the pressure on this spur before treating these as individual horses.",
      })
    );

  if (b.waterTankPct < 25)
    out.push(
      mk({
        ...base,
        id: `tank:${b.id}:${key}`,
        severity: b.waterTankPct < 15 ? "serious" : "warning",
        kind: "stock",
        title: `Header tank at ${b.waterTankPct}% in ${b.name}`,
        detail: `About ${Math.max(1, Math.round((b.waterTankPct / 100) * 18))} hours of supply at the current draw.`,
        recommendation: "Refill now and check the ballcock — a slow fill overnight is what empties these tanks.",
      })
    );
  if (b.feedDays < 4)
    out.push(
      mk({
        ...base,
        id: `feed:${b.id}:${key}`,
        severity: "warning",
        kind: "stock",
        title: `${b.feedDays} days of feed left in ${b.name}`,
        detail: "Based on the current ration for the occupied boxes.",
        recommendation: "Place the order today so delivery lands before the weekend.",
      })
    );
  if (b.beddingDays < 3)
    out.push(
      mk({
        ...base,
        id: `bed:${b.id}:${key}`,
        severity: "info",
        kind: "stock",
        title: `Bedding low in ${b.name}`,
        detail: `${b.beddingDays} days remaining.`,
        recommendation: "Add to the next feed order rather than making a separate trip.",
      })
    );
  return out;
}

/* --------------------------------- the yard ------------------------------- */

/** One pass over the whole yard: rollups, alerts and the outliers worth naming. */
export function yardSnapshot(world, now) {
  const rolls = world.barns.map((b) => barnRollup(world, b, now));
  const alerts = [];
  rolls.forEach((r) => {
    alerts.push(...barnAlerts(world, r, now));
    alerts.push(...r.alerts);
  });

  const live = rolls.flatMap((r) => r.states.filter((s) => s.animal));
  const n = live.length || 1;
  const sum = (f) => live.reduce((a, x) => a + f(x), 0);
  const measured = live.filter((x) => !x.today.offline);

  const intakePct = Math.round(measured.reduce((a, x) => a + x.today.pctOfGoal, 0) / (measured.length || 1));
  const outliers = measured
    .slice()
    .sort((a, b) => a.today.pctOfGoal - b.today.pctOfGoal)
    .slice(0, 6)
    .map((x) => ({
      animal: x.animal,
      stall: x.stall,
      pct: x.today.pctOfGoal,
      intakeL: x.today.intakeL,
      avgL: x.past.intakeL,
      delta: Math.round((x.today.intakeL - x.past.intakeL) * 10) / 10,
    }));

  const visible = alerts.filter((a) => world.alertState?.[a.id] !== "dismissed").sort(bySeverity);
  // one welfare index per occupied box, and the yard average behind it
  const welfare = yardWelfare(live, world, now);
  return {
    now,
    rolls,
    welfare,
    alerts: visible,
    allAlerts: alerts,
    counts: {
      barns: world.barns.length,
      configured: world.barns.filter((b) => b.configured).length,
      stalls: world.stalls.length,
      occupied: live.length,
      animals: world.animals.length,
      critical: visible.filter((a) => a.severity === "critical").length,
      serious: visible.filter((a) => a.severity === "serious").length,
      warning: visible.filter((a) => a.severity === "warning").length,
      offline: live.filter((x) => x.today.offline).length,
    },
    intakeL: Math.round((sum((x) => x.today.intakeL) / n) * 10) / 10,
    intakePct,
    tempC: Math.round((sum((x) => x.today.tempNow ?? 0) / n) * 10) / 10,
    air: Math.round((sum((x) => x.today.airNow) / n) * 10) / 10,
    humidity: Math.round(sum((x) => x.today.humidityNow) / n),
    outliers,
    live,
  };
}

/* ---------------------------- notification feed --------------------------- */

/**
 * The bell menu: today's live alerts, then the same engine replayed over the
 * previous days so the history looks like a system that has been running.
 */
export function notificationFeed(world, now, days = 7) {
  const feed = [];
  const snap = yardSnapshot(world, now);
  snap.alerts.forEach((a) => feed.push({ ...a, at: a.at || a.ts }));

  // Replaying every stall over every day is the one expensive thing in the app,
  // so a big yard gets a shorter history rather than a slow page.
  const budget = Math.max(1, Math.min(days, Math.ceil(600 / Math.max(1, world.stalls.length))));
  for (let d = 1; d <= budget; d++) {
    const then = startOfDay(now) - (d - 1) * DAY_MS - HOUR_MS * 3; // late evening of that day
    world.stalls.forEach((stall) => {
      if (!stall.animalId) return;
      const st = stallState(world, stall, then);
      stallAlerts(world, st, then).forEach((a) => {
        if (a.severity === "info") return;
        feed.push({ ...a, at: a.at || then, ts: then, historic: true });
      });
    });
  }
  return feed.sort((a, b) => b.at - a.at).slice(0, 160);
}
