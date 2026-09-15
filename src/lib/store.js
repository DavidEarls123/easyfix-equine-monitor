/* ==========================================================================
   Persistence and the app clock.

   The configuration lives in localStorage — it is what the customer set up, and
   it has to survive a refresh. Readings do not: they are re-derived from the
   stall seeds, so the browser holds a yard, not a database.
   ========================================================================== */

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { VERSION, seedWorld, syncStalls, uid } from "./world";

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
          w.animals = [...w.animals, animal];
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
      /** The line the grooms see on the screen on the front of the box. */
      setStallNote(animalId, text) {
        edit((w) => {
          w.animals = w.animals.map((a) => (a.id === animalId ? { ...a, stallNote: text } : a));
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
      addBarn(name, yardId = "yard1") {
        const id = uid("bn_");
        edit((w) => {
          w.barns = [
            ...w.barns,
            { id, yardId, name, configured: false, cols: 0, rows: 0, cells: [], waterTankPct: 80, feedDays: 12, beddingDays: 9 },
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
