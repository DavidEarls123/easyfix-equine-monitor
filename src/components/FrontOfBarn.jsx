/* ==========================================================================
   The screen on the barn door.

   State of the nation for one building: the plan of the barn as it was laid
   out, every box on it live, and enough per box to decide where to walk first.
   It is a touchscreen on a wall, so a box is a target rather than a table row —
   press one and the stall's own panel comes up over the plan.

   The plan is the same grid the layout editor produces, drawn sleeker: the
   service rooms recede, the boxes carry the horse and the state of its rounds,
   and anything wrong is a colour rather than a number to be looked up.
   ========================================================================== */

import { useState } from "react";
import Icon from "./Icons";
import Silks from "./Silks";
import FrontOfStall from "./FrontOfStall";
import { careRollup, careToday } from "../lib/care";
import { CELL } from "../lib/world";
import { airStatus, tempStatus, waterStatus, worstTone } from "../lib/status";
import { useWorld } from "../lib/store";

export default function FrontOfBarn({ roll, now }) {
  const { world } = useWorld();
  const s = world.settings;
  const barn = roll.barn;
  const [open, setOpen] = useState(null); // the box whose panel is up

  const rounds = careRollup(world, roll.states, now);
  const water = waterStatus(roll.occupied ? { pctOfGoal: roll.pctOfGoal, goal: s.intakeGoal, offline: false } : null, s);
  const temp = tempStatus(roll.occupied ? roll.tempC : null, s);
  const air = airStatus(roll.occupied ? roll.air : null, s);
  const openAlerts = roll.alerts.filter((a) => a.severity !== "info");

  const grid = [];
  for (let r = 0; r < barn.rows; r++)
    for (let c = 0; c < barn.cols; c++)
      grid.push(barn.cells.find((x) => x.r === r && x.c === c) || { r, c, kind: "empty" });

  return (
    <div className="fob">
      <header className="fob-hd">
        <div>
          <h2>{barn.name}</h2>
          <div className="fob-sub">
            {roll.occupied} of {roll.stalls.length} boxes occupied ·{" "}
            {openAlerts.length ? `${openAlerts.length} open` : "nothing open"}
          </div>
        </div>
        <div className="fob-readings">
          <Reading icon="water" label="Water" value={`${roll.pctOfGoal}%`} st={water} />
          <Reading icon="temp" label="Temperature" value={`${roll.tempC}°C`} st={temp} />
          <Reading icon="air" label="Air" value={`${roll.air}%`} st={air} />
          <Reading
            icon="feed"
            label="Rounds today"
            value={`${rounds.done}/${rounds.target}`}
            st={{ tone: rounds.behind >= 3 ? "serious" : rounds.behind ? "warning" : "good", hint: `${rounds.behind} behind` }}
          />
        </div>
        <span className="fob-clock nums">{new Date(now).toLocaleTimeString([], { hour12: false })}</span>
      </header>

      <div
        className="fob-plan"
        style={{ gridTemplateColumns: `repeat(${barn.cols}, minmax(0, 1fr))` }}
      >
        {grid.map((cell) => {
          if (cell.kind !== "stall")
            return (
              <div key={`${cell.r}:${cell.c}`} className={`fob-cell ${cell.kind}`}>
                {cell.kind !== "empty" && <span>{CELL[cell.kind].label}</span>}
              </div>
            );
          const stall = roll.stalls.find((x) => x.r === cell.r && x.c === cell.c);
          const st = stall ? roll.states.find((x) => x.stall.id === stall.id) : null;
          const animal = st?.animal;
          if (!stall) return <div key={`${cell.r}:${cell.c}`} className="fob-cell empty" />;

          if (!animal)
            return (
              <button key={stall.id} className="fob-box free" onClick={() => setOpen({ stall, st })}>
                <span className="fob-box-nm">{stall.name}</span>
                <span className="fob-box-free">Empty</span>
              </button>
            );

          const t = st.today;
          const care = careToday(world, animal, now);
          const behind = care.feed.behind + care.clean.behind;
          const tone = worstTone(
            waterStatus(t, s).tone,
            tempStatus(t.tempNow, s).tone,
            airStatus(t.airNow, s, t.nh3Now).tone,
            behind >= 2 ? "warning" : "good"
          );

          return (
            <button key={stall.id} className={`fob-box ${tone}`} onClick={() => setOpen({ stall, st })}>
              <span className="fob-box-hd">
                <span className="fob-box-nm">{stall.name}</span>
                <Silks owner={animal.owner} size={20} showCap={false} />
              </span>
              <span className="fob-box-an">{animal.name}</span>
              <span className="fob-box-stats nums">
                <i>{t.offline ? "—" : `${t.intakeL}L`}</i>
                <i>{t.tempNow != null ? `${t.tempNow}°` : "—"}</i>
                <i>{Math.round(t.airNow)}%</i>
              </span>
              <span className="fob-box-rounds">
                <span className={care.clean.complete ? "ok" : care.clean.behind ? "late" : ""}>
                  <Icon name="clean" size={11} /> {care.clean.done}/{care.clean.target}
                </span>
                <span className={care.feed.complete ? "ok" : care.feed.behind ? "late" : ""}>
                  <Icon name="feed" size={11} /> {care.feed.done}/{care.feed.target}
                </span>
              </span>
              {st.events?.some((e) => e.severity === "critical" || e.severity === "serious") && (
                <span className="fob-box-flag">
                  <Icon name="alert" size={12} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <footer className="fob-key">
        <span><i className="k good" /> Settled</span>
        <span><i className="k warning" /> Watch</span>
        <span><i className="k serious" /> Needs attention</span>
        <span><i className="k critical" /> Urgent</span>
        <span className="fob-key-hint">Press a box for its stall screen</span>
      </footer>

      {open && (
        <div className="fob-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="fob-overlay-inner">
            <FrontOfStall
              stall={open.stall}
              animal={open.st?.animal}
              state={open.st}
              now={now}
              onClose={() => setOpen(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Reading({ icon, label, value, st }) {
  return (
    <div className={`fob-reading ${st.tone}`} title={st.hint}>
      <Icon name={icon} size={15} />
      <span className="v nums">{value}</span>
      <span className="l">{label}</span>
    </div>
  );
}
