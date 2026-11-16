/* ==========================================================================
   The screen on the front of the box.

   This is hardware, not a web page: a fixed landscape panel at head height on
   the stall front, read at a glance from the aisle and operated with a gloved
   hand. So it is laid out for distance and for thumbs — three readings down the
   left, who the horse is in the middle, and two targets big enough to hit
   without looking on the right.

   The two targets are the whole point. The yard sets how many feeds and how
   many muck-outs a horse gets in the web app, and the camera over the box
   recognises most of them as they happen — so on a normal morning nobody
   touches this screen at all and the rings fill on their own.

   The buttons are the override, for the rest: a round the camera did not call
   confidently enough, and a round it called that did not happen. Both have to
   be possible standing in front of the box with a gloved hand, which is why
   the correction is on the same confirm panel as the confirmation.
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
  const commit = (at) => {
    actions.logCare(stall.id, animal.id, confirm, s.operator, at);
    setConfirm(null);
  };
  // the correction: the camera called a round that did not happen
  const strike = (entry) => {
    actions.undoCare(entry);
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
        <Confirm
          kind={confirm}
          c={care[confirm]}
          animal={animal}
          stall={stall}
          by={s.operator}
          onCancel={() => setConfirm(null)}
          onCommit={commit}
          onStrike={strike}
        />
      )}
    </div>
  );
}

/**
 * The confirm panel, which does both halves of the override.
 *
 * It opens on what the box already has on it today and where each round came
 * from, because somebody standing here with the ring half full needs to know
 * whether the camera has it before they add another one.
 */
function Confirm({ kind, c, animal, stall, by, onCancel, onCommit, onStrike }) {
  const meta = CARE[kind];
  const lastCamera = [...c.entries].reverse().find((e) => e.source === "camera");
  // the round the camera half-saw: the commonest reason anybody presses this
  const waiting = c.unsure?.[0] || null;

  return (
    <div className="fos-confirm" role="dialog" aria-label="Confirm">
      <div className="fos-confirm-box">
        <Icon name={meta.icon} size={40} />
        <h3>{meta.label}</h3>
        {waiting ? (
          <p>
            The camera thinks it saw this at <b className="nums">{hhmm(waiting.at)}</b> but is only{" "}
            <b>{waiting.confidence}%</b> sure, so it has not counted it. Was <b>{animal.name}</b>{" "}
            {kind === "feed" ? "fed" : "done"}?
          </p>
        ) : (
          <p>
            Record a {kind === "feed" ? "feed" : "muck out"} for <b>{animal.name}</b> in {stall.name}, now, as{" "}
            <b>{by}</b>?
          </p>
        )}

        {(c.entries.length > 0 || c.unsure?.length > 0) && (
          <ul className="fos-seen">
            {c.entries.map((e) => (
              <li key={e.id}>
                <Icon name={e.source === "camera" ? "camera" : "check"} size={16} />
                <b className="nums">{hhmm(e.at)}</b>
                <span>{e.source === "camera" ? `Camera · ${e.confidence}% sure` : e.by}</span>
              </li>
            ))}
            {(c.unsure || []).map((e) => (
              <li key={e.id} className="unsure">
                <Icon name="camera" size={16} />
                <b className="nums">{hhmm(e.at)}</b>
                <span>Camera · {e.confidence}% sure — not counted</span>
              </li>
            ))}
          </ul>
        )}
        {!c.entries.length && !c.unsure?.length && (
          <p className="fos-seen-none">
            Nothing recorded for this box today — the camera has not seen one and nobody has confirmed one.
          </p>
        )}

        <div className="fos-confirm-acts">
          <button className="fos-btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="fos-btn go" onClick={() => onCommit(waiting?.at)}>
            <Icon name="check" size={20} /> {waiting ? "Yes, it was done" : "Confirm"}
          </button>
        </div>

        {lastCamera && (
          <button className="fos-undo" onClick={() => onStrike(lastCamera)}>
            <Icon name="close" size={15} /> The camera is wrong — {hhmm(lastCamera.at)} did not happen
          </button>
        )}
      </div>
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
  const waiting = (c.unsure || []).length;
  const tone = c.complete ? "done" : c.behind ? "behind" : "open";
  const next = c.nextDue != null ? dueTimes(c.target)[c.done] : null;

  return (
    <button className={`fos-task ${tone}${waiting ? " asking" : ""}`} onClick={() => onPress(kind)} aria-label={`${meta.label}, ${c.done} of ${c.target} done`}>
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
          {waiting ? "Confirm?" : c.complete ? meta.done : c.behind ? `${c.behind} behind` : meta.label}
          {/* the camera is keeping this box, so the ring filled on its own */}
          {(c.camera > 0 || waiting > 0) && (
            <Icon name="camera" size={11} title={waiting ? "The camera is not sure — confirm on the box" : `${c.camera} seen by the camera`} />
          )}
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
      {c.last && (
        <span className="fos-task-last">
          {c.last.source === "camera" && <Icon name="camera" size={13} />}
          Last {hhmm(c.last.at)} · {c.last.by}
        </span>
      )}
    </button>
  );
}
