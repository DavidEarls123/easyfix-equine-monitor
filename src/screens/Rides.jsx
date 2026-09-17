/* ==========================================================================
   Ride planning.

   A racing yard sends its string out in lots. The manager decides the night
   before, or over breakfast, who sits on what — and at a big yard that is fifty
   riders against fifty horses, seven lots deep. So the constraint this screen is
   built against is not prettiness, it is doing three hundred assignments without
   the manager losing their place.

   Two ways to assign, because a manager with a mouse and a manager with a
   touchscreen want different things:
     • drag a horse from the pool onto a rider, or
     • tap a horse to pick it up, then tap the rider to put it down.
   Both end in the same action, and the pool filters itself as horses are used.
   ========================================================================== */

import { useMemo, useState } from "react";
import Icon from "../components/Icons";
import { Card, Coat, Empty, Field, Modal, Pill, Switch } from "../components/ui";
import Silks from "../components/Silks";
import { useWorld } from "../lib/store";
import { go } from "../lib/router";
import { availableRiders, groupOf, lotOfAnimal, morningMessage, planFor, planSummary, ridesOf } from "../lib/staff";
import { stallOfAnimal } from "../lib/world";
import { Compose } from "./Staff";

export default function Rides() {
  const { world, now, actions } = useWorld();
  const plan = planFor(world, now);
  const [lotId, setLotId] = useState(plan.lots[0]?.id);
  const [held, setHeld] = useState(null); // the horse picked up, waiting for a rider
  const [q, setQ] = useState("");
  const [showRiders, setShowRiders] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(null); // whose message the manager is reading

  // the plan is already stored on every change; Save is the manager's marker
  // that they are happy with it, and is what Publish checks against
  const saveDraft = () => {
    actions.markPlanSaved(now);
  };
  const plannedAt = world.ridePlan?.[new Date(now).toISOString().slice(0, 10)]?.savedAt;

  const lot = plan.lots.find((l) => l.id === lotId) || plan.lots[0];
  const riders = availableRiders(world.staff);
  const summary = planSummary(plan, world.staff, world.animals);

  // horses not yet down for this morning, filtered as the manager types
  const pool = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return world.animals
      .filter((a) => !lotOfAnimal(plan, a.id))
      .filter(
        (a) =>
          needle.length < 2 ||
          [a.name, a.owner, a.trainer].filter(Boolean).some((f) => String(f).toLowerCase().includes(needle))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [world.animals, plan, q]);

  const place = (riderId, animalId) => {
    if (!animalId || !lot) return;
    actions.assignRide(now, lot.id, riderId, animalId);
    setHeld(null);
  };

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Ride planning</h1>
          <div className="sub">
            {new Date(now).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })} ·{" "}
            {summary.rides} rides across {plan.lots.length} lots · {summary.riders} riders out · {summary.unridden}{" "}
            horses not down
          </div>
        </div>
        <div className="hd-actions">
          <button className="btn" onClick={() => setShowRiders(true)}>
            <Icon name="id" size={15} /> Riders ({riders.length})
          </button>
          <button className="btn" onClick={() => go("board")}>
            <Icon name="screen" size={15} /> Yard board
          </button>
          <button className="btn pri" disabled={!summary.rides} onClick={() => setSending(true)}>
            <Icon name="bell" size={15} /> Publish
          </button>
        </div>
      </div>

      {/* the lots, as the manager thinks of them */}
      <div className="lot-bar">
        {plan.lots.map((l) => {
          const filled = l.rides.filter((r) => r.animalId).length;
          return (
            <button key={l.id} className={`lot-tab ${l.id === lotId ? "on" : ""}`} onClick={() => setLotId(l.id)}>
              <span className="lt-time nums">{l.time}</span>
              <span className="lt-name">{l.label}</span>
              <span className="lt-count nums">{filled}</span>
            </button>
          );
        })}
        <button className="lot-tab add" onClick={() => actions.setLots(now, [...plan.lots, nextLot(plan.lots)])}>
          <Icon name="plus" size={16} />
          <span className="lt-name">Add lot</span>
        </button>
      </div>

      {/* this row is always here, filled or not, so picking a horse up never
          shifts the lot underneath the manager's cursor */}
      <div className={`held-bar ${held ? "on" : ""}`}>
        {held ? (
          <>
            <Coat animal={held} size={26} />
            <b>{held.name}</b>
            <span>picked up — now tap the rider who is on it</span>
            <button className="btn sm ghost" onClick={() => setHeld(null)}>
              Put back
            </button>
          </>
        ) : (
          <>
            <Icon name="head" size={18} />
            <span>Tap a horse to pick it up, or drag it straight onto a rider.</span>
          </>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(300px,0.52fr)", alignItems: "start" }}>
        {/* riders for the chosen lot */}
        <Card
          title={`${lot?.label} — ${lot?.time}`}
          sub={`${lot?.rides.filter((r) => r.animalId).length || 0} of ${riders.length} riders have a horse`}
          right={
            <button className="btn sm act" disabled={!summary.rides} onClick={saveDraft}>
              <Icon name="check" size={14} /> Save the morning
            </button>
          }
        >
          {riders.length === 0 ? (
            <Empty icon="id">
              Nobody is marked as riding today.
              <div style={{ marginTop: 10 }}>
                <button className="btn pri" onClick={() => setShowRiders(true)}>
                  Choose the riders
                </button>
              </div>
            </Empty>
          ) : (
            <div className="rider-grid">
              {riders.map((p) => {
                const ride = lot?.rides.find((r) => r.riderId === p.id);
                const animal = ride?.animalId ? world.animals.find((a) => a.id === ride.animalId) : null;
                const all = ridesOf(plan, p.id).length;
                return (
                  <div
                    key={p.id}
                    className={`rider-card ${animal ? "filled" : ""} ${held ? "target" : ""}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      place(p.id, e.dataTransfer.getData("text/animal"));
                    }}
                    onClick={() => held && place(p.id, held.id)}
                  >
                    <div className="rc-hd">
                      <span className="rc-nm">{p.name}</span>
                      <span className="rc-lots nums" title={`${all} rides this morning`}>
                        {all}
                      </span>
                    </div>
                    {animal ? (
                      <div className="rc-horse">
                        <Silks animal={animal} size={26} />
                        <div className="grow" style={{ minWidth: 0 }}>
                          <b>{animal.name}</b>
                          <div className="tiny mute">{boxOf(world, animal)}</div>
                        </div>
                        <button
                          className="icon-btn sm"
                          title="Take this horse off"
                          onClick={(e) => {
                            e.stopPropagation();
                            actions.clearRide(now, lot.id, ride.id);
                          }}
                        >
                          <Icon name="close" size={13} />
                        </button>
                      </div>
                    ) : (
                      <div className="rc-slot">{held ? `Tap to put ${held.name} up` : "Drop a horse here"}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* the destructive one lives at the foot, clear of everything else */}
          {lot?.rides.length > 0 && (
            <div className="lot-foot">
              <button
                className="btn sm ghost"
                onClick={() => lot.rides.forEach((r) => actions.clearRide(now, lot.id, r.id))}
              >
                <Icon name="close" size={13} /> Clear {lot.label}
              </button>
            </div>
          )}
        </Card>

        {/* the horses still to be found a rider, and what the plan will say */}
        <div className="grid">
        <Card
          title="Horses not down yet"
          sub={`${pool.length} of ${world.animals.length} unassigned this morning`}
        >
          <div className="filter-search" style={{ marginBottom: 10 }}>
            <Icon name="search" size={15} />
            <input
              className="inp"
              placeholder="Search a horse, owner or trainer"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="pool">
            {pool.length === 0 && <div className="small mute">Every horse is down for a lot.</div>}
            {pool.map((a) => (
              <button
                key={a.id}
                className={`pool-horse ${held?.id === a.id ? "held" : ""}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/animal", a.id);
                  setHeld(a);
                }}
                onDragEnd={() => setHeld(null)}
                onClick={() => setHeld(held?.id === a.id ? null : a)}
              >
                <Coat animal={a} size={26} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <b>{a.name}</b>
                  <div className="tiny mute">{boxOf(world, a)}</div>
                </div>
                <Icon name="right" size={14} style={{ color: "#86a0b8" }} />
              </button>
            ))}
          </div>
        </Card>

        <Card
          title="What a rider gets"
          sub="The exact message that goes out when this is published"
          right={
            <select
              className="sel"
              style={{ width: "auto", maxWidth: 170 }}
              value={preview || ""}
              onChange={(e) => setPreview(e.target.value || null)}
            >
              <option value="">First rider with a ride</option>
              {riders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          }
        >
          <RideTextPreview plan={plan} riderId={preview} />
        </Card>
        </div>
      </div>

      {showRiders && <RiderPicker onClose={() => setShowRiders(false)} />}
      {sending && <SendList plan={plan} onClose={() => setSending(false)} />}
    </>
  );
}

const boxOf = (world, animal) => {
  const st = stallOfAnimal(world, animal.id);
  if (!st) return "No box";
  const barn = world.barns.find((b) => b.id === st.barnId);
  return `${barn?.name || ""} · ${st.name}`;
};

const nextLot = (lots) => {
  const n = lots.length + 1;
  const last = lots[lots.length - 1]?.time || "07:00";
  const [h, m] = last.split(":").map(Number);
  const t = new Date();
  t.setHours(h, m + 75, 0, 0);
  return {
    id: `lot${n}`,
    label: `Lot ${n}`,
    time: `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`,
    rides: [],
  };
};

/* --------------------------- who is riding today --------------------------- */

function RiderPicker({ onClose }) {
  const { world, actions } = useWorld();
  const riders = (world.staff || []).filter((p) => (p.groups || []).includes("riders"));
  const on = riders.filter((p) => p.riding !== false).length;

  return (
    <Modal
      title="Riders today"
      onClose={onClose}
      footer={
        <>
          <span className="small mute" style={{ marginRight: "auto" }}>
            {on} of {riders.length} riding
          </span>
          <button className="btn" onClick={() => riders.forEach((p) => actions.updateStaff(p.id, { riding: true }))}>
            All on
          </button>
          <button className="btn pri" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <div className="grid" style={{ gap: 2 }}>
        {riders.map((p) => (
          <div className="row" key={p.id} style={{ gap: 10, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
            <Switch on={p.riding !== false} onChange={(v) => actions.updateStaff(p.id, { riding: v })} />
            <b style={{ fontSize: 13.5 }}>{p.name}</b>
            <span className="tiny mute" style={{ marginLeft: "auto" }}>
              {p.phone}
            </span>
          </div>
        ))}
        {!riders.length && <Empty icon="id">Nobody is in the riders group yet.</Empty>}
      </div>
    </Modal>
  );
}

/* --------------------------- sending the morning --------------------------- */

/**
 * Publishing the morning.
 *
 * One message per rider, carrying every ride they have across every lot —
 * a rider down for three lots gets one text listing three, not three texts.
 * It goes now, or it waits for the hour the yard sends at.
 */
function SendList({ plan, onClose }) {
  const { world, now, actions } = useWorld();
  const yardName = world.yards[0]?.name || "Yard";
  const [when, setWhen] = useState("now");
  const [at, setAt] = useState(world.settings.ridesSendAt || "05:30");
  const messages = availableRiders(world.staff)
    .map((p) => morningMessage(plan, p, world.animals, yardName))
    .filter(Boolean);
  const totalRides = messages.reduce((n, m) => n + m.rideCount, 0);

  const send = () => {
    if (when === "at" && at !== world.settings.ridesSendAt) actions.setSettings({ ridesSendAt: at });
    actions.sendMessage({
      subject: `${yardName}: rides for ${new Date(now).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}`,
      body: messages
        .map((m) => `${m.to.name} (${m.rideCount})\n${m.body.split("\n").slice(2, -2).join("\n")}`)
        .join("\n\n"),
      audience: "Riders with a ride",
      recipients: messages.length,
      channels: ["sms", "push"],
      to: messages.map((m) => m.to.id),
      scheduledFor: when === "at" ? at : null,
    });
    actions.markPlanSaved(now);
    onClose();
  };

  return (
    <Modal
      title="Publish the morning"
      wide
      onClose={onClose}
      footer={
        <>
          <span className="small mute" style={{ marginRight: "auto" }}>
            {messages.length} riders · {totalRides} rides · one message each
          </span>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn pri" disabled={!messages.length} onClick={send}>
            <Icon name="check" size={15} /> {when === "now" ? `Send to ${messages.length} now` : `Schedule for ${at}`}
          </button>
        </>
      }
    >
      {!messages.length ? (
        <Empty icon="bell">Nothing is assigned yet.</Empty>
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          <Field label="When it goes">
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className={`grp-pick ${when === "now" ? "on" : ""}`}
                onClick={() => setWhen("now")}
              >
                Send now
              </button>
              <button
                type="button"
                className={`grp-pick ${when === "at" ? "on" : ""}`}
                onClick={() => setWhen("at")}
              >
                Send in the morning
              </button>
              {when === "at" && (
                <input
                  className="inp nums"
                  style={{ width: 110 }}
                  type="time"
                  value={at}
                  onChange={(e) => setAt(e.target.value)}
                />
              )}
            </div>
          </Field>

          <div className="hint">
            Each rider gets one message with all of their lots in it. Riders with nothing down are not messaged.
          </div>

          <div className="grid" style={{ gap: 10, maxHeight: 360, overflowY: "auto" }}>
            {messages.map((m) => (
              <div className="msg-preview" key={m.to.id}>
                <div className="row" style={{ gap: 8 }}>
                  <b>{m.to.name}</b>
                  <Pill tone="flat">
                    {m.rideCount} ride{m.rideCount === 1 ? "" : "s"}
                  </Pill>
                  <span className="tiny mute" style={{ marginLeft: "auto" }}>
                    {m.to.phone}
                  </span>
                </div>
                <pre>{m.body}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ---------------------------- the message preview -------------------------- */

/** The message itself, on a phone, so a manager can see what they are sending. */
function RideTextPreview({ plan, riderId }) {
  const { world } = useWorld();
  const yardName = world.yards[0]?.name || "Yard";
  const riders = availableRiders(world.staff);
  const chosen =
    (riderId && riders.find((p) => p.id === riderId)) ||
    riders.find((p) => ridesOf(plan, p.id).length) ||
    riders[0];
  const msg = chosen ? morningMessage(plan, chosen, world.animals, yardName) : null;

  if (!chosen) return <div className="small mute">Nobody is marked as riding today.</div>;

  return (
    <div className="sms">
      <div className="sms-hd">
        <Icon name="bell" size={13} />
        <b>{chosen.name}</b>
        <span className="tiny mute" style={{ marginLeft: "auto" }}>
          {chosen.phone}
        </span>
      </div>
      <div className="sms-body">
        {msg ? (
          <div className="sms-bubble">
            <div className="sms-subject">{msg.subject}</div>
            {msg.body.split("\n").map((line, i) => (
              <div key={i} className={line.trim() ? "" : "sms-gap"}>
                {line}
              </div>
            ))}
          </div>
        ) : (
          <div className="sms-bubble empty">
            {chosen.name.split(" ")[0]} has no rides in this plan, so nothing would be sent to them.
          </div>
        )}
      </div>
    </div>
  );
}
