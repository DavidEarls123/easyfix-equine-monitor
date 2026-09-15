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
import { useWorld } from "../lib/store";
import { go } from "../lib/router";
import { availableRiders, planFor, ridesOf } from "../lib/staff";
import { stallOfAnimal } from "../lib/world";

const ROLL_MS = 12000;

export default function Board() {
  const { world, now } = useWorld();
  const plan = planFor(world, now);
  const active = plan.lots.filter((l) => l.rides.some((r) => r.animalId));
  const [i, setI] = useState(0);
  const [rolling, setRolling] = useState(true);

  // the lot that is next up, so the board opens on the useful one
  useEffect(() => {
    const hhmm = new Date(now).toTimeString().slice(0, 5);
    const next = active.findIndex((l) => l.time >= hhmm);
    setI(next >= 0 ? next : 0);
    // only on mount: after that the board rolls or the user steers it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.length]);

  useEffect(() => {
    if (!rolling || active.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % active.length), ROLL_MS);
    return () => clearInterval(t);
  }, [rolling, active.length]);

  const lot = active[i];
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

  const idle = availableRiders(world.staff).filter((p) => !ridesOf(plan, p.id).length);

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
            <h1>{world.yards[0]?.name || "Yard"}</h1>
            <span>
              {new Date(now).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>
          <div className="bd-clock nums">{new Date(now).toLocaleTimeString([], { hour12: false }).slice(0, 5)}</div>
        </header>

        {!lot ? (
          <div className="bd-empty">
            <Icon name="horse" size={50} />
            <h2>No lots planned</h2>
            <p>Assign horses on the planning screen and they appear here.</p>
          </div>
        ) : (
          <>
            <div className="bd-lot">
              <span className="bd-lot-time nums">{lot.time}</span>
              <span className="bd-lot-name">{lot.label}</span>
              <span className="bd-lot-n nums">{rows.length} out</span>
              <div className="bd-dots">
                {active.map((l, k) => (
                  <span key={l.id} className={k === i ? "on" : ""} onClick={() => setI(k)} />
                ))}
              </div>
            </div>

            <div className="bd-rows" style={{ "--cols": rows.length > 14 ? 3 : rows.length > 6 ? 2 : 1 }}>
              {rows.map(({ ride, rider, animal }) => (
                <div className="bd-row" key={ride.id}>
                  <Silks owner={animal?.owner} size={40} showCap={false} />
                  <div className="bd-pair">
                    <span className="bd-rider">{rider?.name || "Unmanned"}</span>
                    <span className="bd-horse">{animal?.name || "TBC"}</span>
                  </div>
                  <span className="bd-box nums">{animal ? boxLabel(world, animal) : ""}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <footer className="bd-ft">
          <span>
            {plan.lots.length} lots · {plan.lots.reduce((n, l) => n + l.rides.filter((r) => r.animalId).length, 0)} rides
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

const boxLabel = (world, animal) => {
  const st = stallOfAnimal(world, animal.id);
  if (!st) return "";
  const barn = world.barns.find((b) => b.id === st.barnId);
  return `${barn?.name || ""} ${st.name}`.trim();
};
