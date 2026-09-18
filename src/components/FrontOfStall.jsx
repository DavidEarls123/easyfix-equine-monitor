/* ==========================================================================
   The screen on the front of the box.

   This is hardware, not a web page: a fixed landscape panel at head height on
   the stall front, read at a glance from the aisle and operated with a gloved
   hand. So it is laid out for distance and for thumbs — three readings down the
   left, who the horse is in the middle, and two targets big enough to hit
   without looking on the right.

   The two buttons are the whole point. The yard sets how many feeds and how
   many muck-outs a horse gets in the web app; the groom presses and confirms,
   and the system has a record of who did what and when. Everything else on the
   panel is there so the person standing in front of it does not have to go and
   ask someone.
   ========================================================================== */

import { useState } from "react";
import Icon from "./Icons";
import Silks from "./Silks";
import ScrollName from "./ScrollName";
import { hhmm } from "./ui";
import { useWorld } from "../lib/store";
import { CARE, careToday, dueTimes } from "../lib/care";
import { ageOf } from "../lib/registry";
import { airStatus, tempStatus, waterStatus } from "../lib/status";
import { colourOf } from "../lib/colours";

export default function FrontOfStall({ stall, animal, state, now, onClose }) {
  const { world, actions } = useWorld();
  const [confirm, setConfirm] = useState(null); // the "are you sure" the panel asks
  const s = world.settings;
  const t = state?.today;
  const care = animal ? careToday(world, animal, now) : null;

  const water = waterStatus(t, s);
  const temp = tempStatus(t?.tempNow, s);
  const air = airStatus(t?.airNow, s, t?.nh3Now);

  const press = (kind) => setConfirm(kind);
  const commit = () => {
    actions.logCare(stall.id, animal.id, confirm, s.operator);
    setConfirm(null);
  };

  return (
    <div className="fos" role="group" aria-label={`Stall screen for ${stall.name}`}>
      <div className="fos-screen">
        {/* the left rail carries the brand and the three readings, as on the box */}
        <aside className="fos-rail">
          <img
            className="fos-logo"
            src={`${import.meta.env.BASE_URL}brand/easyfix-logo.svg`}
            alt="EASYFIX Equine"
          />
          <div className="fos-metrics">
            <Metric icon="air" label="AQI" value={t ? `${Math.round(t.airNow)}` : "—"} st={air} />
            <Metric icon="temp" label="TEMP" value={t?.tempNow != null ? `${t.tempNow}°` : "—"} st={temp} />
            <Metric icon="water" label="WATER" value={t ? `${t.intakeL}L` : "—"} st={water} />
          </div>
        </aside>

        <div className="fos-main">
          {/* the horse, with the owner's colours and the clock opposite */}
          <div className="fos-head">
            <div className="fos-id">
              <h2>
                <ScrollName>{animal ? animal.name : "Empty box"}</ScrollName>
              </h2>
              {animal && (
                <div className="fos-sub">
                  <span>
                    <b>Age:</b>
                    {ageOf(animal.foaled, now) ?? "—"}
                  </span>
                  <span>
                    <b>Sex:</b>
                    {animal.sex}
                  </span>
                  <span>
                    <b>Type:</b>
                    {colourOf(animal.colour).label}
                  </span>
                </div>
              )}
            </div>
            <div className="fos-owner">
              {animal && <Silks animal={animal} size={118} />}
              <span className="fos-clock nums">{new Date(now).toLocaleTimeString([], { hour12: false })}</span>
            </div>
          </div>

          {animal && (
            <dl className="fos-facts">
              {[
                ["Sire", animal.sire],
                ["Dam", animal.dam],
                ["Owner", animal.owner],
                ["Groom", animal.groom || care?.feed.last?.by],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}:</dt>
                  <dd>{v || "—"}</dd>
                </div>
              ))}
            </dl>
          )}

          {/* notes on the left of the foot, the two targets and the menu on the right */}
          <footer className="fos-foot">
            <div className="fos-note">
              <Icon name="note" size={21} />
              <p>{animal?.stallNote || "No notes for this box today."}</p>
            </div>
            {animal && care && (
              <div className="fos-tasks">
                <Task kind="clean" c={care.clean} onPress={press} />
                <Task kind="feed" c={care.feed} onPress={press} />
              </div>
            )}
            <button className="fos-menu" onClick={onClose} aria-label="Close">
              <span />
              <span />
              <span />
            </button>
          </footer>
        </div>
      </div>

      {confirm && (
        <div className="fos-confirm" role="dialog" aria-label="Confirm">
          <div className="fos-confirm-box">
            <Icon name={CARE[confirm].icon} size={40} />
            <h3>{CARE[confirm].label}</h3>
            <p>
              Record a {confirm === "feed" ? "feed" : "muck out"} for <b>{animal.name}</b> in {stall.name}, now, as{" "}
              <b>{s.operator}</b>?
            </p>
            <div className="fos-confirm-acts">
              <button className="fos-btn ghost" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button className="fos-btn go" onClick={commit}>
                <Icon name="check" size={20} /> Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ icon, label, value, st }) {
  return (
    <div className={`fos-metric ${st.tone}`} title={st.hint}>
      <Icon name={icon} size={26} />
      <div className="fos-metric-v nums">{value}</div>
      <div className="fos-metric-l">{label}</div>
    </div>
  );
}

/**
 * One target. The ring fills as the rounds are done, so a groom walking the
 * aisle can see an unfinished box without stopping at it.
 */
function Task({ kind, c, onPress }) {
  const meta = CARE[kind];
  const pct = c.target ? Math.min(1, c.done / c.target) : 0;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const tone = c.complete ? "done" : c.behind ? "behind" : "open";
  const next = c.nextDue != null ? dueTimes(c.target)[c.done] : null;

  return (
    <button className={`fos-task ${tone}`} onClick={() => onPress(kind)} aria-label={`${meta.label}, ${c.done} of ${c.target} done`}>
      <svg viewBox="0 0 100 100" className="fos-ring" aria-hidden="true">
        <circle cx="50" cy="50" r={r} className="track" />
        {pct > 0 && (
          <circle
            cx="50"
            cy="50"
            r={r}
            className="fill"
            strokeDasharray={`${pct * circ} ${circ}`}
            transform="rotate(-90 50 50)"
          />
        )}
      </svg>
      <span className="fos-task-ico">
        <Icon name={meta.icon} size={30} />
      </span>
      <span className="fos-task-meta">
        <span className="fos-task-count nums">
          {c.done}
          <i>/{c.target}</i>
        </span>
        <span className="fos-task-note">
          {c.complete ? meta.done : c.behind ? `${c.behind} behind` : meta.label}
        </span>
      </span>
      <span className="fos-task-label">
        {c.complete
          ? `${meta.done} — all done`
          : c.behind
          ? `${c.behind} round${c.behind === 1 ? "" : "s"} behind`
          : next != null
          ? `Next due ${String(Math.floor(next)).padStart(2, "0")}:${String(Math.round((next % 1) * 60)).padStart(2, "0")}`
          : meta.label}
      </span>
      {c.last && <span className="fos-task-last">Last {hhmm(c.last.at)} · {c.last.by}</span>}
    </button>
  );
}
