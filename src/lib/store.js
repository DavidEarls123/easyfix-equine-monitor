/* ==========================================================================
   Persistence and the app clock.

   The configuration lives in localStorage — it is what the customer set up, and
   it has to survive a refresh. Readings do not: they are re-derived from the
   stall seeds, so the browser holds a yard, not a database.
   ========================================================================== */

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { VERSION, makeYard, seedWorld, syncStalls, uid } from "./world";
import { emptyPlan, lotsOf, planKey, planYard } from "./jobs";

const KEY = "easyfix.equine.world";
const Ctx = createContext(null);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seedWorld();
    const w = JSON.parse(raw);
    if (!w || w.version !== VERSION) return seedWorld(); // demo data, so a version bump just reseeds
    return w;
  } catch {
    return seedWorld();
  }
}

function save(world) {
  try {
    localStorage.setItem(KEY, JSON.stringify(world));
  } catch {
    /* private mode or a full quota — the app still runs, it just won't remember */
  }
}

/** The stored plan for a day at the open yard, and the key it is filed under. */
function openPlan(w, when) {
  const yard = planYard(w);
  const key = planKey(yard?.id, when);
  const stored = w.ridePlan?.[key];
  return [key, stored ? { ...emptyPlan(lotsOf(yard)), ...stored, jobs: stored.jobs || [] } : emptyPlan(lotsOf(yard))];
}

export function WorldProvider({ children }) {
  const [world, setWorld] = useState(load);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState(null);
  const timer = useRef(0);

  useEffect(() => save(world), [world]);

  // the live clock: readings are a function of time, so ticking re-renders them
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const say = useCallback((msg) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const edit = useCallback((fn) => setWorld((w) => fn({ ...w }) || w), []);

  const actions = useMemo(
    () => ({
      /* ------------------------------- animals ------------------------------ */
      addAnimal(animal, stallId) {
        edit((w) => {
          // a horse belongs to a yard even before it is given a box
          w.animals = [...w.animals, { yardId: planYard(w)?.id || null, ...animal }];
          if (stallId) w.stalls = w.stalls.map((s) => (s.id === stallId ? { ...s, animalId: animal.id } : s));
          w.log = [{ at: Date.now(), text: `Profile created for ${animal.name}` }, ...(w.log || [])].slice(0, 200);
          return w;
        });
        say(`${animal.name} added`);
      },
      updateAnimal(id, patch) {
        edit((w) => {
          w.animals = w.animals.map((a) => (a.id === id ? { ...a, ...patch } : a));
          return w;
        });
      },
      addNote(id, text) {
        edit((w) => {
          w.animals = w.animals.map((a) =>
            a.id === id ? { ...a, notes: [{ at: Date.now(), text }, ...(a.notes || [])] } : a
          );
          return w;
        });
        say("Note saved");
      },
      removeAnimal(id) {
        edit((w) => {
          w.animals = w.animals.filter((a) => a.id !== id);
          w.stalls = w.stalls.map((s) => (s.animalId === id ? { ...s, animalId: null } : s));
          return w;
        });
        say("Profile removed");
      },

      /* --------------------------------- staff ------------------------------- */
      addStaff(person) {
        const p = { id: uid("sf_"), groups: [], riding: true, ...person };
        edit((w) => {
          w.staff = [...(w.staff || []), p];
          return w;
        });
        say(`${p.name} added`);
        return p;
      },
      updateStaff(id, patch) {
        edit((w) => {
          w.staff = (w.staff || []).map((p) => (p.id === id ? { ...p, ...patch } : p));
          return w;
        });
      },
      removeStaff(id) {
        edit((w) => {
          w.staff = (w.staff || []).filter((p) => p.id !== id);
          // and out of any day they were down to work
          w.ridePlan = Object.fromEntries(
            Object.entries(w.ridePlan || {}).map(([k, plan]) => [
              k,
              {
                ...plan,
                lots: plan.lots.map((l) => ({ ...l, rides: l.rides.filter((r) => r.riderId !== id) })),
                jobs: (plan.jobs || []).map((j) => (j.staffId === id ? { ...j, staffId: null } : j)),
              },
            ])
          );
          return w;
        });
        say("Removed");
      },

      /* -------------------------------- planning ---------------------------- */

      /* The day's plan is held per yard as well as per day: a trainer with two
         yards runs two mornings, and they must not overwrite each other. */

      /** Put a horse under a rider in a lot. A horse is ridden once a morning. */
      assignRide(when, lotId, riderId, animalId) {
        edit((w) => {
          const [key, plan] = openPlan(w, when);
          const lots = plan.lots.map((lot) => {
            let rides = lot.rides;
            // a horse cannot be in two places at once, so lift it out of wherever
            // it was before putting it down here
            if (animalId) rides = rides.filter((r) => r.animalId !== animalId);
            if (lot.id === lotId) {
              // one horse per rider per lot: replace rather than stack
              rides = rides.filter((r) => r.riderId !== riderId);
              rides = [...rides, { id: uid("rd_"), riderId, animalId, distanceF: null, activities: [] }];
            }
            return { ...lot, rides };
          });
          w.ridePlan = { ...(w.ridePlan || {}), [key]: { ...plan, lots } };
          return w;
        });
      },
      clearRide(when, lotId, rideId) {
        edit((w) => {
          const [key, plan] = openPlan(w, when);
          w.ridePlan = {
            ...w.ridePlan,
            [key]: {
              ...plan,
              lots: plan.lots.map((l) => (l.id === lotId ? { ...l, rides: l.rides.filter((r) => r.id !== rideId) } : l)),
            },
          };
          return w;
        });
      },
      /** How far this horse is going, what it is doing, and anything said about it. */
      setRideDetail(when, lotId, rideId, patch) {
        edit((w) => {
          const [key, plan] = openPlan(w, when);
          w.ridePlan = {
            ...w.ridePlan,
            [key]: {
              ...plan,
              lots: plan.lots.map((l) =>
                l.id === lotId
                  ? { ...l, rides: l.rides.map((r) => (r.id === rideId ? { ...r, ...patch } : r)) }
                  : l
              ),
            },
          };
          return w;
        });
      },
      setLots(when, lots) {
        edit((w) => {
          const [key, plan] = openPlan(w, when);
          w.ridePlan = { ...(w.ridePlan || {}), [key]: { ...plan, lots } };
          return w;
        });
      },
      /** Which piece of ground this lot is working on. */
      setLotGallop(when, lotId, gallopId) {
        edit((w) => {
          const [key, plan] = openPlan(w, when);
          w.ridePlan = {
            ...w.ridePlan,
            [key]: { ...plan, lots: plan.lots.map((l) => (l.id === lotId ? { ...l, gallopId } : l)) },
          };
          return w;
        });
      },

      /* ------------------------------ the other work ------------------------ */

      /** Mucking out, the farrier, the vet — work that is not ridden. */
      addJob(when, job) {
        const entry = { id: uid("jb_"), kind: "muckout", staffId: null, at: "", animalIds: [], note: "", ...job };
        edit((w) => {
          const [key, plan] = openPlan(w, when);
          w.ridePlan = { ...(w.ridePlan || {}), [key]: { ...plan, jobs: [...(plan.jobs || []), entry] } };
          return w;
        });
        return entry;
      },
      updateJob(when, jobId, patch) {
        edit((w) => {
          const [key, plan] = openPlan(w, when);
          w.ridePlan = {
            ...w.ridePlan,
            [key]: { ...plan, jobs: (plan.jobs || []).map((j) => (j.id === jobId ? { ...j, ...patch } : j)) },
          };
          return w;
        });
      },
      removeJob(when, jobId) {
        edit((w) => {
          const [key, plan] = openPlan(w, when);
          w.ridePlan = { ...w.ridePlan, [key]: { ...plan, jobs: (plan.jobs || []).filter((j) => j.id !== jobId) } };
          return w;
        });
      },
      /** A horse goes on or comes off a job. The same horse can be on several. */
      toggleJobAnimal(when, jobId, animalId) {
        edit((w) => {
          const [key, plan] = openPlan(w, when);
          w.ridePlan = {
            ...w.ridePlan,
            [key]: {
              ...plan,
              jobs: (plan.jobs || []).map((j) => {
                if (j.id !== jobId) return j;
                const on = (j.animalIds || []).includes(animalId);
                return { ...j, animalIds: on ? j.animalIds.filter((x) => x !== animalId) : [...(j.animalIds || []), animalId] };
              }),
            },
          };
          return w;
        });
      },

      /**
       * Put a horse down for a job with a person, the way a horse is put under
       * a rider: one gesture, no form. The job for that person and that kind
       * is made if it does not exist yet, and cleared away again when the last
       * horse comes off it, so the plan never fills with empty cards.
       */
      assignJob(when, kind, staffId, animalId, at) {
        edit((w) => {
          const [key, plan] = openPlan(w, when);
          const jobs = [...(plan.jobs || [])];
          let job = jobs.find((j) => j.kind === kind && j.staffId === staffId);
          if (!job) {
            job = { id: uid("jb_"), kind, staffId, at: at || "", animalIds: [], note: "" };
            jobs.push(job);
          }
          if (!(job.animalIds || []).includes(animalId))
            jobs[jobs.indexOf(job)] = { ...job, animalIds: [...(job.animalIds || []), animalId] };
          w.ridePlan = { ...(w.ridePlan || {}), [key]: { ...plan, jobs } };
          return w;
        });
      },
      /** Take a horse off a job, and drop the job if that was the last one. */
      unassignJob(when, jobId, animalId) {
        edit((w) => {
          const [key, plan] = openPlan(w, when);
          const jobs = (plan.jobs || [])
            .map((j) => (j.id === jobId ? { ...j, animalIds: (j.animalIds || []).filter((x) => x !== animalId) } : j))
            .filter((j) => j.id !== jobId || (j.animalIds || []).length > 0 || j.note || j.at);
          w.ridePlan = { ...(w.ridePlan || {}), [key]: { ...plan, jobs } };
          return w;
        });
      },

      /* --------------------------------- rounds ----------------------------- */

      /* A round is standing work — a run of boxes somebody keeps. It lives on
         the world rather than in a day's plan, because it does not change
         with the morning. */

      setRound(kind, staffId, patch) {
        edit((w) => {
          const yardId = planYard(w)?.id;
          const rounds = [...(w.rounds || [])];
          const i = rounds.findIndex((r) => r.kind === kind && r.staffId === staffId && r.yardId === yardId);
          if (i < 0) rounds.push({ id: uid("rd_"), kind, staffId, yardId, stallIds: [], at: "", note: "", ...patch });
          else rounds[i] = { ...rounds[i], ...patch };
          w.rounds = rounds;
          return w;
        });
      },
      /** Give up a round: the boxes go back to being unassigned. */
      clearRound(kind, staffId) {
        edit((w) => {
          const yardId = planYard(w)?.id;
          w.rounds = (w.rounds || []).filter(
            (r) => !(r.kind === kind && r.staffId === staffId && r.yardId === yardId)
          );
          return w;
        });
        say("Round cleared");
      },
      /**
       * The same boxes, for the other job. Mucking out and feeding are usually
       * walked together, so a feeding round is nearly always a copy of the
       * muck-out round rather than something assigned from scratch.
       */
      copyRounds(fromKind, toKind) {
        let n = 0;
        edit((w) => {
          const yardId = planYard(w)?.id;
          const from = (w.rounds || []).filter(
            (r) => r.kind === fromKind && r.yardId === yardId && (r.stallIds || []).length
          );
          // only this yard's rounds of that kind are replaced
          const rest = (w.rounds || []).filter((r) => !(r.kind === toKind && r.yardId === yardId));
          w.rounds = [
            ...rest,
            ...from.map((r) => {
              n++;
              return {
                id: uid("rd_"),
                kind: toKind,
                staffId: r.staffId,
                yardId,
                stallIds: [...r.stallIds],
                at: "",
                note: "",
              };
            }),
          ];
          return w;
        });
        say(n ? `Copied ${n} round${n === 1 ? "" : "s"}` : "Nothing to copy");
      },

      /** The manager's marker that this day is settled. */
      markPlanSaved(when) {
        edit((w) => {
          const [key, plan] = openPlan(w, when);
          w.ridePlan = { ...(w.ridePlan || {}), [key]: { ...plan, savedAt: Date.now() } };
          return w;
        });
        say("Plan saved");
      },
      clearPlan(when) {
        edit((w) => {
          const [key, plan] = openPlan(w, when);
          w.ridePlan = {
            ...(w.ridePlan || {}),
            [key]: { ...plan, lots: plan.lots.map((l) => ({ ...l, rides: [] })), jobs: [] },
          };
          return w;
        });
        say("Day cleared");
      },

      /* ------------------------------ notifications -------------------------- */

      /** A broadcast. Recorded rather than actually sent — there is no mail server here. */
      sendMessage(msg) {
        const entry = { id: uid("ms_"), at: Date.now(), ...msg };
        edit((w) => {
          w.messages = [entry, ...(w.messages || [])].slice(0, 300);
          return w;
        });
        say(`Sent to ${msg.recipients} ${msg.recipients === 1 ? "person" : "people"}`);
        return entry;
      },

      /* --------------------------- feeding and mucking out -------------------- */

      /** A worker pressed the button on the front of a box and confirmed it. */
      logCare(stallId, animalId, kind, by) {
        const entry = { id: uid("cr_"), at: Date.now(), stallId, animalId, kind, by: by || "Yard" };
        edit((w) => {
          // the log is the record the yard is keeping, so it is capped rather
          // than trimmed by date — a week of a 300-box yard still fits
          w.careLog = [entry, ...(w.careLog || [])].slice(0, 4000);
          return w;
        });
        say(kind === "feed" ? "Feed recorded" : "Muck out recorded");
        return entry;
      },
      undoCare(entryId) {
        edit((w) => {
          w.careLog = (w.careLog || []).filter((e) => e.id !== entryId);
          return w;
        });
        say("Entry removed");
      },
      /** How often this horse is fed and its box done, set in the web app. */
      setCare(animalId, patch) {
        edit((w) => {
          w.animals = w.animals.map((a) => (a.id === animalId ? { ...a, care: { ...(a.care || {}), ...patch } } : a));
          return w;
        });
      },
      /**
       * The line the grooms see on the screen on the front of the box.
       * Every note is kept — what was on the box and when is part of the record,
       * not something to be overwritten.
       */
      setStallNote(animalId, text, by) {
        const entry = text ? { at: Date.now(), text, by: by || "Yard" } : null;
        edit((w) => {
          w.animals = w.animals.map((a) =>
            a.id === animalId
              ? { ...a, stallNote: text, noteLog: entry ? [entry, ...(a.noteLog || [])].slice(0, 200) : a.noteLog }
              : a
          );
          return w;
        });
        say(text ? "Sent to the stall screen" : "Cleared from the stall screen");
      },

      /* -------------------------------- stalls ------------------------------ */
      assign(stallId, animalId) {
        edit((w) => {
          w.stalls = w.stalls.map((s) => {
            if (s.id === stallId) return { ...s, animalId };
            if (animalId && s.animalId === animalId) return { ...s, animalId: null }; // one box each
            return s;
          });
          return w;
        });
        say(animalId ? "Stall assigned" : "Stall cleared");
      },
      swapStalls(aStallId, bStallId) {
        edit((w) => {
          const a = w.stalls.find((s) => s.id === aStallId);
          const b = w.stalls.find((s) => s.id === bStallId);
          if (!a || !b) return w;
          w.stalls = w.stalls.map((s) =>
            s.id === a.id ? { ...s, animalId: b.animalId } : s.id === b.id ? { ...s, animalId: a.animalId } : s
          );
          // once the app agrees with the camera, the mismatch is resolved
          w.animals = w.animals.map((an) =>
            an.id === a.animalId || an.id === b.animalId ? { ...an, seenAs: null } : an
          );
          w.log = [{ at: Date.now(), text: "Stall assignments swapped from a camera identity match" }, ...(w.log || [])].slice(0, 200);
          return w;
        });
        say("Assignments updated");
      },
      renameStall(stallId, name) {
        edit((w) => {
          w.stalls = w.stalls.map((s) => (s.id === stallId ? { ...s, name, renamed: true } : s));
          return w;
        });
      },
      setCamera(stallId, on) {
        edit((w) => {
          w.stalls = w.stalls.map((s) => (s.id === stallId ? { ...s, camera: on } : s));
          return w;
        });
      },

      /* --------------------------------- barns ------------------------------ */
      addBarn(name, yardId) {
        const id = uid("bn_");
        edit((w) => {
          w.barns = [
            ...w.barns,
            {
              id,
              yardId: yardId || planYard(w)?.id,
              name,
              configured: false,
              cols: 0,
              rows: 0,
              cells: [],
              waterTankPct: 80,
              feedDays: 12,
              beddingDays: 9,
            },
          ];
          return w;
        });
        say(`${name} created`);
        return id;
      },
      renameBarn(barnId, name) {
        edit((w) => {
          w.barns = w.barns.map((b) => (b.id === barnId ? { ...b, name } : b));
          return w;
        });
      },
      saveLayout(barnId, layout) {
        edit((w) => {
          const barn = { ...w.barns.find((b) => b.id === barnId), ...layout, configured: true };
          w.barns = w.barns.map((b) => (b.id === barnId ? barn : b));
          const synced = syncStalls(w, barn);
          w.stalls = synced.stalls;
          return w;
        });
        say("Layout saved");
      },
      removeBarn(barnId) {
        edit((w) => {
          w.barns = w.barns.filter((b) => b.id !== barnId);
          w.stalls = w.stalls.filter((s) => s.barnId !== barnId);
          return w;
        });
        say("Barn removed");
      },
      setStock(barnId, patch) {
        edit((w) => {
          w.barns = w.barns.map((b) => (b.id === barnId ? { ...b, ...patch } : b));
          return w;
        });
      },

      /* ------------------------------- settings ----------------------------- */
      setSettings(patch) {
        edit((w) => {
          w.settings = { ...w.settings, ...patch };
          return w;
        });
      },
      renameYard(yardId, name) {
        edit((w) => {
          w.yards = w.yards.map((y) => (y.id === yardId ? { ...y, name } : y));
          return w;
        });
      },

      /* --------------------------------- yards ------------------------------ */

      /* One operator, several yards. Everything the app shows — the dashboard,
         the barns, the horses, the day's plan — is about the yard that is open. */

      openYard(yardId) {
        edit((w) => {
          w.yardId = yardId;
          return w;
        });
      },
      addYard(name) {
        const yard = makeYard(name);
        edit((w) => {
          w.yards = [...w.yards, yard];
          w.yardId = yard.id;
          return w;
        });
        say(`${name} created`);
        return yard;
      },
      /** A yard goes, and its barns, boxes and horses go with it. */
      removeYard(yardId) {
        edit((w) => {
          if ((w.yards || []).length < 2) return w; // an operator always has one
          const barns = w.barns.filter((b) => b.yardId === yardId).map((b) => b.id);
          const stalls = w.stalls.filter((st) => barns.includes(st.barnId)).map((st) => st.id);
          w.yards = w.yards.filter((y) => y.id !== yardId);
          w.barns = w.barns.filter((b) => b.yardId !== yardId);
          w.stalls = w.stalls.filter((st) => !barns.includes(st.barnId));
          w.animals = w.animals.filter((a) => (a.yardId || w.yards[0]?.id) !== yardId);
          w.careLog = (w.careLog || []).filter((e) => !stalls.includes(e.stallId));
          w.ridePlan = Object.fromEntries(
            Object.entries(w.ridePlan || {}).filter(([k]) => !k.startsWith(`${yardId}|`))
          );
          if (w.yardId === yardId) w.yardId = w.yards[0]?.id;
          return w;
        });
        say("Yard removed");
      },
      /** The lots a yard runs and the ground it works on. */
      setYardConfig(yardId, patch) {
        edit((w) => {
          w.yards = w.yards.map((y) => (y.id === yardId ? { ...y, ...patch } : y));
          return w;
        });
      },

      /* -------------------------------- alerts ------------------------------ */
      setAlertState(id, state) {
        edit((w) => {
          w.alertState = { ...(w.alertState || {}), [id]: state };
          return w;
        });
        say(state === "dismissed" ? "Alert dismissed" : "Acknowledged");
      },
      markSeen(ids) {
        edit((w) => {
          const seen = { ...(w.seenNotifications || {}) };
          ids.forEach((i) => (seen[i] = Date.now()));
          w.seenNotifications = seen;
          return w;
        });
      },

      /* --------------------------------- demo ------------------------------- */
      replace(next) {
        setWorld(next);
      },
      reset() {
        setWorld(seedWorld());
        say("Demo yard reset");
      },
    }),
    [edit, say]
  );

  const value = useMemo(() => ({ world, now, actions, toast, say }), [world, now, actions, toast, say]);
  return createElement(Ctx.Provider, { value }, children);
}

export function useWorld() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorld outside WorldProvider");
  return v;
}
