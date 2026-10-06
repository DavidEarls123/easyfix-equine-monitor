/* ==========================================================================
   The job planner.

   The morning is not only riding. The string goes out in lots while the boxes
   are being mucked out, the farrier works down one barn and the vet sees three
   horses before lunch. It is one plan because it is one set of people and one
   set of horses, and because every bit of it has to end up in the message a
   member of staff reads at five in the morning.

   The constraint this screen is built against is not prettiness, it is doing
   three hundred assignments without the manager losing their place. So there
   are two ways to assign, because a manager with a mouse and a manager with a
   touchscreen want different things:
     • drag a horse from the pool onto a rider or a job, or
     • tap a horse to pick it up, then tap where it goes.
   ========================================================================== */

import { useMemo, useState } from "react";
import Icon from "../components/Icons";
import { Card, Coat, Empty, Field, Modal, Pill, Switch } from "../components/ui";
import Silks from "../components/Silks";
import ScrollName from "../components/ScrollName";
import { useWorld } from "../lib/store";
import { go } from "../lib/router";
import { groupOf, staffIn } from "../lib/staff";
import {
  JOB_KINDS,
  activitiesOf,
  activityOf,
  availableRiders,
  dayMessages,
  dayOfAnimal,
  furlongs,
  gallopOf,
  gallopsOf,
  jobKind,
  lotOfAnimal,
  planFor,
  planSummary,
  ridesOf,
} from "../lib/jobs";
import { currentYard, animalsOfYard, stallOfAnimal } from "../lib/world";

const JOBS_TAB = "__jobs";

export default function Planner() {
  const { world, now, actions } = useWorld();
  const yard = currentYard(world);
  const plan = planFor(world, now, yard);
  const horses = useMemo(() => animalsOfYard(world), [world]);
  const [tab, setTab] = useState(plan.lots[0]?.id);
  const [held, setHeld] = useState(null); // the horse picked up, waiting to be put down
  const [q, setQ] = useState("");
  const [showRiders, setShowRiders] = useState(false);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(null); // the ride whose detail is open
  const [preview, setPreview] = useState(null); // whose message the manager is reading

  const onJobs = tab === JOBS_TAB;
  const lot = onJobs ? null : plan.lots.find((l) => l.id === tab) || plan.lots[0];
  const riders = availableRiders(world.staff);
  const summary = planSummary(plan, world.staff, horses);
  const jobs = plan.jobs || [];

  // horses still to be found a job. On a lot that means horses not yet ridden;
  // on the jobs tab it means every horse, because a horse that worked at seven
  // can still be shod at eleven.
  const pool = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return horses
      .filter((a) => onJobs || !lotOfAnimal(plan, a.id))
      .filter(
        (a) =>
          needle.length < 2 ||
          [a.name, a.owner, a.trainer].filter(Boolean).some((f) => String(f).toLowerCase().includes(needle))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [horses, plan, q, onJobs]);

  const place = (riderId, animalId) => {
    if (!animalId || !lot) return;
    actions.assignRide(now, lot.id, riderId, animalId);
    setHeld(null);
  };
  const drop = (jobId, animalId) => {
    if (!animalId) return;
    const job = jobs.find((j) => j.id === jobId);
    if (job && (job.animalIds || []).includes(animalId)) return setHeld(null);
    actions.toggleJobAnimal(now, jobId, animalId);
    setHeld(null);
  };

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Job planner</h1>
          <div className="sub">
            {yard?.name} ·{" "}
            {new Date(now).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })} ·{" "}
            {summary.rides} rides across {plan.lots.length} lots
            {summary.furlongs ? ` · ${furlongs(summary.furlongs)} of work` : ""} · {summary.jobs} other jobs ·{" "}
            {summary.people} people
          </div>
        </div>
        <div className="hd-actions">
          <button className="btn" onClick={() => setShowRiders(true)}>
            <Icon name="id" size={15} /> Riders ({riders.length})
          </button>
          <button className="btn" onClick={() => go("board")}>
            <Icon name="screen" size={15} /> Yard board
          </button>
          <button
            className="btn pri"
            disabled={!summary.rides && !summary.jobs}
            onClick={() => setSending(true)}
          >
            <Icon name="bell" size={15} /> Publish
          </button>
        </div>
      </div>

      {/* the lots, as the manager thinks of them, and then everything else */}
      <div className="lot-bar">
        {plan.lots.map((l) => {
          const filled = l.rides.filter((r) => r.animalId).length;
          const g = gallopOf(yard, l.gallopId);
          return (
            <button key={l.id} className={`lot-tab ${l.id === tab ? "on" : ""}`} onClick={() => setTab(l.id)}>
              <span className="lt-time nums">{l.time}</span>
              <span className="lt-name">{l.label}</span>
              {g && <span className="lt-gallop">{g.label}</span>}
              <span className="lt-count nums">{filled}</span>
            </button>
          );
        })}
        <button className="lot-tab add" onClick={() => actions.setLots(now, [...plan.lots, nextLot(plan.lots)])}>
          <Icon name="plus" size={16} />
          <span className="lt-name">Add lot</span>
        </button>
        <button className={`lot-tab jobs ${onJobs ? "on" : ""}`} onClick={() => setTab(JOBS_TAB)}>
          <Icon name="job" size={16} />
          <span className="lt-name">Yard jobs</span>
          <span className="lt-count nums">{jobs.length}</span>
        </button>
      </div>

      {/* this row is always here, filled or not, so picking a horse up never
          shifts what is underneath the manager's cursor */}
      <div className={`held-bar ${held ? "on" : ""}`}>
        {held ? (
          <>
            <Coat animal={held} size={26} />
            <b>{held.name}</b>
            <span>picked up — now tap {onJobs ? "the job it belongs to" : "the rider who is on it"}</span>
            <button className="btn sm ghost" onClick={() => setHeld(null)}>
              Put back
            </button>
          </>
        ) : (
          <>
            <Icon name="head" size={18} />
            <span>
              Tap a horse to pick it up, or drag it straight onto {onJobs ? "a job" : "a rider"}.
            </span>
          </>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(300px,0.52fr)", alignItems: "start" }}>
        {onJobs ? (
          <JobsPanel plan={plan} held={held} onDrop={drop} />
        ) : (
          <LotPanel
            lot={lot}
            yard={yard}
            plan={plan}
            riders={riders}
            held={held}
            onPlace={place}
            onEdit={setEditing}
          />
        )}

        {/* the horses still to be found something to do, and what the plan says */}
        <div className="grid">
          <Card
            title={onJobs ? "Every horse" : "Horses not down yet"}
            sub={
              onJobs
                ? `${pool.length} in ${yard?.name || "this yard"} — a horse can be on more than one job`
                : `${pool.length} of ${horses.length} unassigned this morning`
            }
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
                  <span className="silks-cell">
                    <Silks animal={a} size={26} />
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <ScrollName className="strong">{a.name}</ScrollName>
                    <ScrollName className="tiny mute">{poolLine(world, plan, a)}</ScrollName>
                  </div>
                  <Icon name="right" size={14} style={{ color: "#86a0b8" }} />
                </button>
              ))}
            </div>
          </Card>

          <Card
            title="What a member of staff gets"
            sub="The exact message that goes out when this is published"
            right={
              <select
                className="sel"
                style={{ width: "auto", maxWidth: 170 }}
                value={preview || ""}
                onChange={(e) => setPreview(e.target.value || null)}
              >
                <option value="">First person with something on</option>
                {(world.staff || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            }
          >
            <DayTextPreview plan={plan} yard={yard} staffId={preview} />
          </Card>
        </div>
      </div>

      {showRiders && <RiderPicker onClose={() => setShowRiders(false)} />}
      {sending && <SendList plan={plan} yard={yard} onClose={() => setSending(false)} />}
      {editing && <RideDetail {...editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/* ------------------------------- one lot ---------------------------------- */

function LotPanel({ lot, yard, plan, riders, held, onPlace, onEdit }) {
  const { world, now, actions } = useWorld();
  const summary = planSummary(plan, world.staff, animalsOfYard(world));

  return (
    <Card
      title={`${lot?.label} — ${lot?.time}`}
      sub={`${lot?.rides.filter((r) => r.animalId).length || 0} of ${riders.length} riders have a horse`}
      right={
        <div className="row" style={{ gap: 8 }}>
          {/* a lot works on a named piece of ground, and the riders are told it */}
          <select
            className="sel"
            style={{ width: "auto", maxWidth: 190 }}
            value={lot?.gallopId || ""}
            onChange={(e) => actions.setLotGallop(now, lot.id, e.target.value || null)}
            title="Which gallop this lot is on"
          >
            <option value="">No gallop set</option>
            {gallopsOf(yard).map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <button className="btn sm act" disabled={!summary.rides && !summary.jobs} onClick={() => actions.markPlanSaved(now)}>
            <Icon name="check" size={14} /> Save the day
          </button>
        </div>
      }
    >
      {riders.length === 0 ? (
        <Empty icon="id">Nobody is marked as riding today.</Empty>
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
                  onPlace(p.id, e.dataTransfer.getData("text/animal"));
                }}
                onClick={() => held && onPlace(p.id, held.id)}
              >
                <div className="rc-hd">
                  <ScrollName className="rc-nm">{p.name}</ScrollName>
                  <span className="rc-lots nums" title={`${all} rides this morning`}>
                    {all}
                  </span>
                </div>
                {animal ? (
                  <>
                    <div className="rc-horse">
                      <span className="silks-cell">
                        <Silks animal={animal} size={28} />
                      </span>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <ScrollName className="strong">{animal.name}</ScrollName>
                        <ScrollName className="tiny mute">{boxOf(world, animal)}</ScrollName>
                      </div>
                      <button
                        className="icon-btn sm"
                        title="What this horse is doing"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit({ lot, ride, animal });
                        }}
                      >
                        <Icon name="edit" size={13} />
                      </button>
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
                    <RideTags ride={ride} />
                  </>
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
          <button className="btn sm ghost" onClick={() => lot.rides.forEach((r) => actions.clearRide(now, lot.id, r.id))}>
            <Icon name="close" size={13} /> Clear {lot.label}
          </button>
        </div>
      )}
    </Card>
  );
}

/** How far and what else, under the horse's name on the rider's card. */
function RideTags({ ride }) {
  const { world } = useWorld();
  const d = furlongs(ride.distanceF);
  const tags = (ride.activities || []).map((id) => activityOf(world.settings, id)).filter(Boolean);
  if (!d && !tags.length && !ride.note) return null;
  return (
    <div className="rc-tags">
      {d && <span className="tag dist nums">{d}</span>}
      {tags.map((t) => (
        <span key={t.id} className="tag" style={{ background: t.colour }}>
          {t.label}
        </span>
      ))}
      {ride.note && (
        <span className="tag note" title={ride.note}>
          <Icon name="note" size={10} /> {ride.note}
        </span>
      )}
    </div>
  );
}

/* ---------------------------- how far, and what --------------------------- */

const QUICK_F = [2, 3, 4, 5, 6, 7, 8, 10, 12];

function RideDetail({ lot, ride, animal, onClose }) {
  const { world, now, actions } = useWorld();
  const [distanceF, setDistance] = useState(ride.distanceF || "");
  const [activities, setActivities] = useState(ride.activities || []);
  const [note, setNote] = useState(ride.note || "");
  const tags = activitiesOf(world.settings);

  const save = () => {
    actions.setRideDetail(now, lot.id, ride.id, {
      distanceF: distanceF === "" ? null : Number(distanceF),
      activities,
      note: note.trim(),
    });
    onClose();
  };

  return (
    <Modal
      title={animal?.name || "This ride"}
      onClose={onClose}
      footer={
        <>
          <span className="small mute" style={{ marginRight: "auto" }}>
            {lot.label} · {lot.time}
          </span>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn pri" onClick={save}>
            <Icon name="check" size={15} /> Save
          </button>
        </>
      }
    >
      <div className="grid" style={{ gap: 14 }}>
        <Field label="How far" hint="Furlongs. It goes into the rider's message as 6f or 1m 2f.">
          <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
            {QUICK_F.map((f) => (
              <button
                key={f}
                type="button"
                className={`grp-pick ${Number(distanceF) === f ? "on" : ""}`}
                onClick={() => setDistance(Number(distanceF) === f ? "" : f)}
              >
                {furlongs(f)}
              </button>
            ))}
            <input
              className="inp nums"
              style={{ width: 92 }}
              type="number"
              min="0"
              max="40"
              placeholder="f"
              value={distanceF}
              onChange={(e) => setDistance(e.target.value)}
            />
          </div>
        </Field>

        <Field label="Doing what" hint="As many as apply — a horse can canter and then go on the walker.">
          <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
            {tags.map((t) => {
              const on = activities.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`grp-pick ${on ? "on" : ""}`}
                  style={on ? { background: t.colour, borderColor: t.colour } : undefined}
                  onClick={() => setActivities((x) => (on ? x.filter((i) => i !== t.id) : [...x, t.id]))}
                >
                  {on && <Icon name="check" size={12} />}
                  {t.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Anything else" hint="Goes out word for word.">
          <input
            className="inp"
            placeholder="Upsides with the grey, don't go past him"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------ the other work ---------------------------- */

function JobsPanel({ plan, held, onDrop }) {
  const { world, now, actions } = useWorld();
  const jobs = plan.jobs || [];
  const summary = planSummary(plan, world.staff, animalsOfYard(world));

  return (
    <Card
      title="Jobs around the yard"
      sub="Mucking out, the farrier, the vet — everything that is not ridden"
      right={
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm" onClick={() => actions.addJob(now, {})}>
            <Icon name="plus" size={14} /> Add a job
          </button>
          <button
            className="btn sm act"
            disabled={!summary.rides && !summary.jobs}
            onClick={() => actions.markPlanSaved(now)}
          >
            <Icon name="check" size={14} /> Save the day
          </button>
        </div>
      }
    >
      {!jobs.length ? (
        <Empty icon="job">
          Nothing else is down for today.
          <div style={{ marginTop: 10 }}>
            <button className="btn pri" onClick={() => actions.addJob(now, {})}>
              Add the first job
            </button>
          </div>
        </Empty>
      ) : (
        <div className="job-grid">
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} held={held} onDrop={onDrop} />
          ))}
        </div>
      )}
    </Card>
  );
}

function JobCard({ job, held, onDrop }) {
  const { world, now, actions } = useWorld();
  const kind = jobKind(job.kind);
  const people = kind.group === "all" ? world.staff || [] : staffIn(world.staff, kind.group);
  const horses = (job.animalIds || []).map((id) => world.animals.find((a) => a.id === id)).filter(Boolean);
  const person = (world.staff || []).find((p) => p.id === job.staffId);

  return (
    <div
      className={`job-card ${held ? "target" : ""} ${job.staffId ? "filled" : ""}`}
      style={{ "--kind": kind.colour }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(job.id, e.dataTransfer.getData("text/animal"));
      }}
      onClick={() => held && onDrop(job.id, held.id)}
    >
      <div className="jc-hd">
        <span className="jc-ico">
          <Icon name={kind.icon} size={15} />
        </span>
        <select
          className="sel sm"
          value={job.kind}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => actions.updateJob(now, job.id, { kind: e.target.value, staffId: null })}
        >
          {JOB_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          className="inp sm nums"
          style={{ width: 92 }}
          type="time"
          value={job.at || ""}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => actions.updateJob(now, job.id, { at: e.target.value })}
        />
        <button
          className="icon-btn sm"
          title="Remove this job"
          onClick={(e) => {
            e.stopPropagation();
            actions.removeJob(now, job.id);
          }}
        >
          <Icon name="trash" size={13} />
        </button>
      </div>

      {job.kind === "other" && (
        <input
          className="inp sm"
          placeholder="What is it?"
          value={job.label || ""}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => actions.updateJob(now, job.id, { label: e.target.value })}
        />
      )}

      <select
        className="sel sm"
        value={job.staffId || ""}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => actions.updateJob(now, job.id, { staffId: e.target.value || null })}
      >
        <option value="">Nobody assigned</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {!people.length && (
        <div className="tiny mute">Nobody is in the {groupOf(kind.group).label.toLowerCase()} group yet.</div>
      )}

      <div className="jc-horses">
        {horses.map((a) => (
          <span key={a.id} className="jc-horse">
            <Silks animal={a} size={18} />
            <ScrollName>{a.name}</ScrollName>
            <button
              className="icon-btn sm"
              title="Take this horse off"
              onClick={(e) => {
                e.stopPropagation();
                actions.toggleJobAnimal(now, job.id, a.id);
              }}
            >
              <Icon name="close" size={11} />
            </button>
          </span>
        ))}
        <span className="jc-drop">
          {held ? `Tap to add ${held.name}` : horses.length ? "Drop another horse here" : "Drop the horses here"}
        </span>
      </div>

      <input
        className="inp sm"
        placeholder="Anything to say about it"
        value={job.note || ""}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => actions.updateJob(now, job.id, { note: e.target.value })}
      />
      {person && (
        <div className="tiny mute">
          {person.phone} · {horses.length} horse{horses.length === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- helpers --------------------------------- */

const boxOf = (world, animal) => {
  const st = stallOfAnimal(world, animal.id);
  if (!st) return "No box";
  const barn = world.barns.find((b) => b.id === st.barnId);
  return `${barn?.name || ""} · ${st.name}`;
};

/** In the pool, a horse says where it lives — or what it is already down for. */
function poolLine(world, plan, animal) {
  const { rides, jobs } = dayOfAnimal(plan, animal.id);
  if (!rides.length && !jobs.length) return boxOf(world, animal);
  const bits = rides.map((r) => `${r.lot.label}${furlongs(r.distanceF) ? ` ${furlongs(r.distanceF)}` : ""}`);
  jobs.forEach((j) => bits.push(jobKind(j.kind).label));
  return bits.join(" · ");
}

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
    gallopId: null,
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

/* ----------------------------- sending the day ----------------------------- */

/**
 * Publishing the day.
 *
 * One message per person, carrying everything they have — a rider down for
 * three lots who is also mucking out gets one text listing four things, not
 * four texts. It goes now, or it waits for the hour the yard sends at.
 */
function SendList({ plan, yard, onClose }) {
  const { world, now, actions } = useWorld();
  const [when, setWhen] = useState("now");
  const [at, setAt] = useState(world.settings.ridesSendAt || "05:30");
  const messages = dayMessages(plan, world, yard);
  const rides = messages.reduce((n, m) => n + m.rideCount, 0);
  const jobs = messages.reduce((n, m) => n + m.jobCount, 0);

  const send = () => {
    if (when === "at" && at !== world.settings.ridesSendAt) actions.setSettings({ ridesSendAt: at });
    actions.sendMessage({
      subject: `${yard?.name || "Yard"}: ${new Date(now).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}`,
      body: messages
        .map((m) => `${m.to.name} (${m.rideCount} rides, ${m.jobCount} jobs)\n${m.body.split("\n").slice(2, -2).join("\n")}`)
        .join("\n\n"),
      audience: "Everyone with something on",
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
      title="Publish the day"
      wide
      onClose={onClose}
      footer={
        <>
          <span className="small mute" style={{ marginRight: "auto" }}>
            {messages.length} people · {rides} rides · {jobs} jobs · one message each
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
              <button type="button" className={`grp-pick ${when === "now" ? "on" : ""}`} onClick={() => setWhen("now")}>
                Send now
              </button>
              <button type="button" className={`grp-pick ${when === "at" ? "on" : ""}`} onClick={() => setWhen("at")}>
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
            Each person gets one message with everything they are down for — lots, gallops, distances and jobs.
            Anyone with nothing on is not messaged.
          </div>

          <div className="grid" style={{ gap: 10, maxHeight: 360, overflowY: "auto" }}>
            {messages.map((m) => (
              <div className="msg-preview" key={m.to.id}>
                <div className="row" style={{ gap: 8 }}>
                  <b>{m.to.name}</b>
                  {m.rideCount > 0 && (
                    <Pill tone="flat">
                      {m.rideCount} ride{m.rideCount === 1 ? "" : "s"}
                    </Pill>
                  )}
                  {m.jobCount > 0 && (
                    <Pill tone="good">
                      {m.jobCount} job{m.jobCount === 1 ? "" : "s"}
                    </Pill>
                  )}
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
function DayTextPreview({ plan, yard, staffId }) {
  const { world } = useWorld();
  const all = dayMessages(plan, world, yard);
  const asked = staffId ? (world.staff || []).find((p) => p.id === staffId) : null;
  const msg = staffId ? all.find((m) => m.to.id === staffId) : all[0];
  // whoever the manager asked about, even when that person has nothing on
  const who = asked || msg?.to;

  if (!who) return <div className="small mute">Nobody has anything down yet, so nothing would be sent.</div>;

  return (
    <div className="sms">
      <div className="sms-hd">
        <Icon name="bell" size={13} />
        <b>{who.name}</b>
        <span className="tiny mute" style={{ marginLeft: "auto" }}>
          {who.phone}
        </span>
      </div>
      <div className="sms-body">
        {!msg ? (
          <div className="sms-bubble empty">
            {who.name.split(" ")[0]} has nothing down today, so nothing would be sent to them.
          </div>
        ) : (
          <div className="sms-bubble">
            <div className="sms-subject">{msg.subject}</div>
            {msg.body.split("\n").map((line, i) => (
              <div key={i} className={line.trim() ? "" : "sms-gap"}>
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
