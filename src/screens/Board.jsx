/* ==========================================================================
   The board on the yard wall.

   A big screen by the tack room that the string reads on the way past. Nobody
   operates it, so there is nothing to press: it shows the lot that matters now,
   rolls on by itself, and is legible from the other side of the yard.

   Everything here is sized for distance rather than density — a rider should be
   able to find their own name from twenty feet without stopping.
   ========================================================================== */

import { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icons";
import Silks from "../components/Silks";
import ScrollName from "../components/ScrollName";
import { useWorld } from "../lib/store";
import { go } from "../lib/router";
import {
  activityOf,
  availableRiders,
  furlongs,
  gallopOf,
  jobKind,
  jobsOf,
  planFor,
  ridesOf,
} from "../lib/jobs";
import { currentYard, stallOfAnimal } from "../lib/world";

const ROLL_MS = 12000;

export default function Board() {
  const { world, now } = useWorld();
  const yard = currentYard(world);
  const plan = planFor(world, now, yard);
  const jobs = (plan.jobs || []).filter((j) => j.staffId || (j.animalIds || []).length);
  // the board rolls through the lots and then, if there is any, the other work
  const slides = useMemo(
    () => [
      ...plan.lots.filter((l) => l.rides.some((r) => r.animalId)).map((l) => ({ kind: "lot", lot: l })),
      ...(jobs.length ? [{ kind: "jobs" }] : []),
    ],
    [plan, jobs.length]
  );
  const [i, setI] = useState(0);
  const [rolling, setRolling] = useState(true);

  // the lot that is next up, so the board opens on the useful one
  useEffect(() => {
    const hhmm = new Date(now).toTimeString().slice(0, 5);
    const next = slides.findIndex((s) => s.kind === "lot" && s.lot.time >= hhmm);
    setI(next >= 0 ? next : 0);
    // only on mount: after that the board rolls or the user steers it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length]);

  useEffect(() => {
    if (!rolling || slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), ROLL_MS);
    return () => clearInterval(t);
  }, [rolling, slides.length]);

  const slide = slides[Math.min(i, Math.max(0, slides.length - 1))];
  const lot = slide?.kind === "lot" ? slide.lot : null;
  const gallop = gallopOf(yard, lot?.gallopId);
  const rows = useMemo(() => {
    if (!lot) return [];
    return lot.rides
      .filter((r) => r.animalId)
      .map((r) => ({
        ride: r,
        rider: (world.staff || []).find((p) => p.id === r.riderId),
        animal: world.animals.find((a) => a.id === r.animalId),
      }))
      .sort((a, b) => (a.rider?.name || "").localeCompare(b.rider?.name || ""));
  }, [lot, world]);

  // somebody mucking out is not idle, so the board does not call them out
  const idle = availableRiders(world.staff).filter((p) => !ridesOf(plan, p.id).length && !jobsOf(plan, p.id).length);

  return (
    <div className="board-wrap">
      <div className="board-bar">
        <button className="btn sm" onClick={() => go("rides")}>
          <Icon name="left" size={14} /> Back to planning
        </button>
        <span className="small mute">
          A mock-up of the screen on the yard wall — it rolls through the lots on its own.
        </span>
        <button className={`btn sm ${rolling ? "pri" : ""}`} onClick={() => setRolling((r) => !r)}>
          <Icon name={rolling ? "pause" : "play"} size={14} /> {rolling ? "Rolling" : "Paused"}
        </button>
      </div>

      <div className="board">
        <header className="bd-hd">
          <img className="bd-logo" src={`${import.meta.env.BASE_URL}brand/easyfix-logo.svg`} alt="EASYFIX Equine" />
          <div className="bd-title">
            <h1>{yard?.name || "Yard"}</h1>
            <span>
              {new Date(now).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>
          <div className="bd-clock nums">{new Date(now).toLocaleTimeString([], { hour12: false }).slice(0, 5)}</div>
        </header>

        {!slide ? (
          <div className="bd-empty">
            <Icon name="head" size={50} />
            <h2>Nothing planned</h2>
            <p>Assign horses and jobs on the planner and they appear here.</p>
          </div>
        ) : (
          <>
            <div className="bd-lot">
              {lot ? (
                <>
                  <span className="bd-lot-time nums">{lot.time}</span>
                  <span className="bd-lot-name">{lot.label}</span>
                  {gallop && <span className="bd-gallop">{gallop.label}</span>}
                  <span className="bd-lot-n nums">{rows.length} out</span>
                </>
              ) : (
                <>
                  <span className="bd-lot-name">Around the yard</span>
                  <span className="bd-lot-n nums">{jobs.length} jobs</span>
                </>
              )}
              <div className="bd-dots">
                {slides.map((sl, k) => (
                  <span key={k} className={k === i ? "on" : ""} onClick={() => setI(k)} />
                ))}
              </div>
            </div>

            {lot ? (
              <div className="bd-rows" style={{ "--cols": rows.length > 14 ? 3 : rows.length > 6 ? 2 : 1 }}>
                {rows.map(({ ride, rider, animal }) => (
                  <div className="bd-row" key={ride.id}>
                    <Silks animal={animal} size={40} />
                    <div className="bd-pair">
                      <ScrollName className="bd-rider">{rider?.name || "Unmanned"}</ScrollName>
                      <ScrollName className="bd-horse">{animal?.name || "TBC"}</ScrollName>
                    </div>
                    <span className="bd-work">{workLabel(world, ride)}</span>
                    <span className="bd-box nums">{animal ? boxLabel(world, animal) : ""}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bd-rows" style={{ "--cols": jobs.length > 8 ? 2 : 1 }}>
                {jobs.map((j) => {
                  const kind = jobKind(j.kind);
                  const person = (world.staff || []).find((p) => p.id === j.staffId);
                  const names = (j.animalIds || [])
                    .map((id) => world.animals.find((a) => a.id === id)?.name)
                    .filter(Boolean);
                  return (
                    <div className="bd-row" key={j.id}>
                      <span className="bd-job-ico" style={{ color: kind.colour }}>
                        <Icon name={kind.icon} size={30} />
                      </span>
                      <div className="bd-pair">
                        <ScrollName className="bd-rider">{person?.name || "Nobody yet"}</ScrollName>
                        <ScrollName className="bd-horse">
                          {j.kind === "other" && j.label ? j.label : kind.label}
                          {names.length ? ` — ${names.join(", ")}` : ""}
                        </ScrollName>
                      </div>
                      <span className="bd-box nums">{j.at || ""}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <footer className="bd-ft">
          <span>
            {plan.lots.length} lots · {plan.lots.reduce((n, l) => n + l.rides.filter((r) => r.animalId).length, 0)} rides
            {jobs.length ? ` · ${jobs.length} jobs` : ""}
          </span>
          {idle.length > 0 && (
            <span className="bd-idle">
              Not down to ride: {idle.slice(0, 6).map((p) => p.name.split(" ")[0]).join(", ")}
              {idle.length > 6 ? ` +${idle.length - 6}` : ""}
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}

/** How far, and anything else the horse is down for, in one line. */
function workLabel(world, ride) {
  const bits = [];
  const d = furlongs(ride.distanceF);
  if (d) bits.push(d);
  (ride.activities || []).forEach((id) => {
    const tag = activityOf(world.settings, id);
    if (tag) bits.push(tag.label);
  });
  return bits.join(" · ");
}

const boxLabel = (world, animal) => {
  const st = stallOfAnimal(world, animal.id);
  if (!st) return "";
  const barn = world.barns.find((b) => b.id === st.barnId);
  return `${barn?.name || ""} ${st.name}`.trim();
};
