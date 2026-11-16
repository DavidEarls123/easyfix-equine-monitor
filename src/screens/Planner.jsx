/* ==========================================================================
   The job planner.

   Who is doing what to which horse today. The boxes are being mucked out and
   fed, the farrier works down one barn, the vet sees three before lunch, two
   go swimming. It is one plan because it is one set of people and one set of
   horses, and because every bit of it has to end up in the message a member of
   staff reads at five in the morning.

   The work splits in two, and the screen is built around the split:

     • rounds — mucking out and feeding. A groom is given a run of boxes and
       keeps it. Assigned to the box, a barn at a time, and left alone.
     • jobs   — the farrier, the vet, exercise, the lorry. Assigned a horse at
       a time, for one day.

   The constraint this screen is built against is not prettiness, it is doing
   three hundred assignments without the manager losing their place. So there
   are two ways to assign a horse, because a manager with a mouse and a manager
   with a touchscreen want different things:
     • drag a horse from the pool onto the person doing the job, or
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
  dayMessages,
  dayOfAnimal,
  jobKind,
  planFor,
  planSummary,
} from "../lib/jobs";
import { currentYard, animalsOfYard, stallOfAnimal, stallsOfYard } from "../lib/world";
import {
  ROUND_KINDS,
  describeRound,
  isRoundKind,
  roundFor,
  roundKind,
  roundOfStall,
  roundProgress,
  roundsOf,
  stallDue,
  suggestRun,
  unassigned,
} from "../lib/rounds";

export default function Planner() {
  const { world, now, actions } = useWorld();
  const yard = currentYard(world);
  const plan = planFor(world, now, yard);
  const horses = useMemo(() => animalsOfYard(world), [world]);
  const [kind, setKind] = useState("muckout"); // which work the people grid is for
  const [held, setHeld] = useState(null); // the horse picked up, waiting to be put down
  const [q, setQ] = useState("");
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(null); // whose message the manager is reading

  const summary = planSummary(plan, world.staff, horses);
  const onRound = isRoundKind(kind);

  // every horse in the yard, because a horse that swam at eight can still be
  // shod at eleven — what it is already down for shows under its name
  const pool = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return horses
      .filter(
        (a) =>
          needle.length < 2 ||
          [a.name, a.owner, a.trainer].filter(Boolean).some((f) => String(f).toLowerCase().includes(needle))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [horses, q]);

  // the same gesture as putting a horse down anywhere: the job is made for
  // that person if it does not exist yet
  const putOnJob = (staffId, animalId) => {
    if (!animalId) return;
    actions.assignJob(now, kind, staffId, animalId, jobKind(kind).at);
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
            {summary.jobs} job{summary.jobs === 1 ? "" : "s"} · {summary.horses} horse
            {summary.horses === 1 ? "" : "s"} · {summary.people} {summary.people === 1 ? "person" : "people"}
          </div>
        </div>
        <div className="hd-actions">
          <button className="btn" onClick={() => go("staff")}>
            <Icon name="id" size={15} /> Staff
          </button>
          <button className="btn" onClick={() => go("board")}>
            <Icon name="screen" size={15} /> Yard board
          </button>
          <button className="btn pri" onClick={() => setSending(true)}>
            <Icon name="bell" size={15} /> Publish
          </button>
        </div>
      </div>

      {/* this row is always here, filled or not, so picking a horse up never
          shifts what is underneath the manager's cursor */}
      {/* picking a horse up means nothing when the work is a run of boxes */}
      <div className={`held-bar ${held ? "on" : ""}`} style={onRound ? { display: "none" } : undefined}>
        {held ? (
          <>
            <Coat animal={held} size={26} />
            <b>{held.name}</b>
            <span>picked up — now tap whoever is doing it</span>
            <button className="btn sm ghost" onClick={() => setHeld(null)}>
              Put back
            </button>
          </>
        ) : (
          <>
            <Icon name="head" size={18} />
            <span>Tap a horse to pick it up, or drag it straight onto the person doing the job.</span>
          </>
        )}
      </div>

      <div
        className="grid"
        style={{
          // handing out boxes needs the room; the pool of horses is for the
          // jobs that are assigned a horse at a time
          gridTemplateColumns: onRound ? "minmax(0,1fr)" : "minmax(0,1fr) minmax(300px,0.52fr)",
          alignItems: "start",
        }}
      >
        <JobsPanel plan={plan} kind={kind} onKind={setKind} held={held} onPlace={putOnJob} />

        {/* the horses, and what the plan says */}
        <div className="grid" style={onRound ? { display: "none" } : undefined}>
          <Card
            title="Every horse"
            sub={`${pool.length} in ${yard?.name || "this yard"} — a horse can be on more than one job`}
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
              {pool.length === 0 && <div className="small mute">No horse here matches that.</div>}
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

      {sending && <SendList plan={plan} yard={yard} onClose={() => setSending(false)} />}
    </>
  );
}

/* ------------------------------ the other work ---------------------------- */

/* The one bar the whole screen is steered from: the two standing rounds, then
   the day's jobs. A round is done by the yard staff; a job says who does it. */
const KIND_TABS = [
  ...ROUND_KINDS.map((k) => ({ ...k, group: "yard", round: true })),
  ...JOB_KINDS.map((k) => ({ ...k, round: false })),
];
const kindTab = (id) => KIND_TABS.find((k) => k.id === id) || KIND_TABS[0];

/**
 * Pick what is being done, and you get the people who do it. A horse goes onto
 * a person in one gesture — there is no job to create first, because a job is
 * just a person with horses against their name.
 */
function JobsPanel({ plan, kind, onKind, held, onPlace }) {
  const { world, now, actions } = useWorld();
  const jobs = plan.jobs || [];
  const spec = kindTab(kind);
  const people = spec.group === "all" ? world.staff || [] : staffIn(world.staff, spec.group);

  return (
    /* one grid child, so the kind bar and the people sit in the left column
       together and the pool stays put beside them */
    <div className="grid" style={{ gap: 0 }}>
      {/* what is being done: the one bar the screen is steered from */}
      <div className="kind-bar">
        {KIND_TABS.map((k) => {
          // mucking out and feeding count boxes on a round; the rest count
          // horses put down for the day
          const n = isRoundKind(k.id)
            ? roundsOf(world, k.id).reduce((a, r) => a + (r.stallIds || []).length, 0)
            : jobs.filter((j) => j.kind === k.id).reduce((a, j) => a + (j.animalIds || []).length, 0);
          return (
            <button
              key={k.id}
              className={`kind-tab ${k.id === kind ? "on" : ""}`}
              style={{ "--kind": k.colour }}
              onClick={() => onKind(k.id)}
            >
              <Icon name={k.icon} size={15} />
              <span>{k.label}</span>
              {n > 0 && <span className="kind-n nums">{n}</span>}
            </button>
          );
        })}
      </div>

      {isRoundKind(kind) ? (
        <RoundsPanel kind={kind} people={people} />
      ) : (
        <Card
          title={spec.label}
          sub={
            people.length
              ? `${jobs.filter((j) => j.kind === kind && (j.animalIds || []).length).length} of ${people.length} ${groupOf(spec.group).label.toLowerCase()} have horses down`
              : `Nobody is in the ${groupOf(spec.group).label.toLowerCase()} group yet`
          }
          right={
            <button className="btn sm act" disabled={!jobs.length} onClick={() => actions.markPlanSaved(now)}>
              <Icon name="check" size={14} /> Save the day
            </button>
          }
        >
          {!people.length ? (
            <Empty icon="id">
              {spec.label} is done by the {groupOf(spec.group).label.toLowerCase()} group, and nobody is in it.
              <div style={{ marginTop: 10 }}>
                <button className="btn pri" onClick={() => go("staff")}>
                  Add somebody
                </button>
              </div>
            </Empty>
          ) : (
            <div className="rider-grid">
              {people.map((p) => (
                <JobPerson
                  key={p.id}
                  person={p}
                  kind={kind}
                  job={jobs.find((j) => j.kind === kind && j.staffId === p.id)}
                  jobs={jobs}
                  held={held}
                  onPlace={onPlace}
                />
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/* ------------------------------ standing rounds ---------------------------- */

/**
 * Mucking out and feeding are not assigned one horse at a time.
 *
 * A groom is given a run of boxes and keeps it — the work belongs to the box,
 * not to whatever is standing in it this week. So these two kinds get a
 * different panel: a person, the boxes they keep, and how far through them
 * they are, live off the taps on the stall screens.
 */
function RoundsPanel({ kind, people }) {
  const { world, now, actions } = useWorld();
  const mine = useMemo(() => stallsOfYard(world).filter((st) => st.animalId !== undefined), [world]);
  const spec = roundKind(kind);
  const yardId = currentYard(world)?.id;
  const rounds = roundsOf(world, kind, yardId).filter((r) => people.some((p) => p.id === r.staffId));
  const [picking, setPicking] = useState(null);

  const free = unassigned(world, kind, mine.filter((st) => st.animalId));
  const totals = rounds.reduce(
    (acc, r) => {
      const pr = roundProgress(world, r, now);
      acc.boxes += pr.boxes;
      acc.done += pr.done;
      acc.behind += pr.behind;
      return acc;
    },
    { boxes: 0, done: 0, behind: 0 }
  );
  const other = kind === "muckout" ? "feed" : "muckout";

  return (
    <div className="grid" style={{ gap: 0 }}>
      <Card
        title={`${spec.label} rounds`}
        sub={
          totals.boxes
            ? `${totals.done} of ${totals.boxes} boxes done so far today${totals.behind ? ` · ${totals.behind} behind` : ""}`
            : "Nobody has been given any boxes yet"
        }
        right={
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn sm"
              title={`Give the ${roundKind(other).label.toLowerCase()} rounds the same boxes`}
              onClick={() => actions.copyRounds(kind, other)}
            >
              <Icon name="grid" size={14} /> Copy to {roundKind(other).label.toLowerCase()}
            </button>
          </div>
        }
      >
        {free.length > 0 && (
          <div className="hint" style={{ marginBottom: 10 }}>
            <b>{free.length}</b> occupied box{free.length === 1 ? " has" : "es have"} nobody down to{" "}
            {spec.label.toLowerCase()} — give them to somebody below.
          </div>
        )}

        <div className="round-grid">
          {people.map((p) => {
            const round = roundFor(world, kind, p.id, yardId);
            const pr = round ? roundProgress(world, round, now) : null;
            return (
              <div key={p.id} className={`round-card ${round?.stallIds?.length ? "filled" : ""}`}>
                <div className="rc-hd">
                  <ScrollName className="rc-nm">{p.name}</ScrollName>
                  {pr?.boxes ? (
                    <Pill tone={pr.tone}>
                      {pr.done}/{pr.boxes}
                    </Pill>
                  ) : null}
                </div>

                {round?.stallIds?.length ? (
                  <>
                    <ScrollName className="tiny mute">{describeRound(world, round)}</ScrollName>
                    <div className="round-bar" title={`${pr.pct}% of the boxes are up to date`}>
                      <span className={pr.tone} style={{ width: `${pr.pct}%` }} />
                    </div>
                    <div className="tiny mute">
                      {pr.behind ? `${pr.behind} box${pr.behind === 1 ? "" : "es"} behind` : "All up to date"}
                      {pr.empty ? ` · ${pr.empty} empty` : ""}
                    </div>
                  </>
                ) : (
                  <div className="rc-slot">No boxes yet</div>
                )}

                <div className="row" style={{ gap: 6 }}>
                  <input
                    className="inp sm nums"
                    style={{ width: 88 }}
                    type="time"
                    title="What time they start"
                    value={round?.at || ""}
                    onChange={(e) => actions.setRound(kind, p.id, { at: e.target.value })}
                  />
                  <button className="btn sm grow" onClick={() => setPicking(p)}>
                    <Icon name="barn" size={13} /> {round?.stallIds?.length ? "Change boxes" : "Give boxes"}
                  </button>
                  {round?.stallIds?.length ? (
                    <button className="icon-btn sm" title="Clear this round" onClick={() => actions.clearRound(kind, p.id)}>
                      <Icon name="trash" size={13} />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {picking && <BoxPicker kind={kind} person={picking} stalls={mine} onClose={() => setPicking(null)} />}
    </div>
  );
}

/**
 * Choosing the boxes, a barn at a time.
 *
 * Nobody is given eight boxes scattered over three barns, so the picker is
 * grouped by barn with a whole-barn tick, and it opens by offering the run it
 * would have suggested anyway — the biggest block nobody has yet.
 */
function BoxPicker({ kind, person, stalls, onClose }) {
  const { world, now, actions } = useWorld();
  const round = roundFor(world, kind, person.id, currentYard(world)?.id);
  const spec = roundKind(kind);
  const [picked, setPicked] = useState(() => new Set(round?.stallIds || []));

  const byBarn = useMemo(() => {
    const m = new Map();
    stalls.forEach((st) => m.set(st.barnId, [...(m.get(st.barnId) || []), st]));
    return [...m.entries()].map(([barnId, list]) => ({
      barn: world.barns.find((b) => b.id === barnId),
      stalls: list.sort((a, b) => a.index - b.index),
    }));
  }, [stalls, world.barns]);

  const suggestion = useMemo(
    () => suggestRun(world, kind, stalls.filter((st) => st.animalId), 10),
    [world, kind, stalls]
  );

  const toggle = (id) =>
    setPicked((p) => {
      const next = new Set(p);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const occupied = [...picked].filter((id) => stalls.find((st) => st.id === id)?.animalId).length;

  return (
    <Modal
      title={`${person.name} — ${spec.label.toLowerCase()}`}
      wide
      onClose={onClose}
      footer={
        <>
          <span className="small mute" style={{ marginRight: "auto" }}>
            {picked.size} box{picked.size === 1 ? "" : "es"} · {occupied} with a horse in
          </span>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn pri"
            onClick={() => {
              actions.setRound(kind, person.id, { stallIds: [...picked], at: round?.at || spec.at });
              onClose();
            }}
          >
            <Icon name="check" size={15} /> Save the round
          </button>
        </>
      }
    >
      <div className="grid" style={{ gap: 12 }}>
        {suggestion.length > 0 && !round?.stallIds?.length && (
          <div className="hint row" style={{ gap: 10, flexWrap: "wrap" }}>
            <span>
              The biggest run nobody has is <b>{suggestion.length} boxes</b> in{" "}
              <b>{world.barns.find((b) => b.id === suggestion[0].barnId)?.name}</b>.
            </span>
            <button className="btn sm pri" onClick={() => setPicked(new Set(suggestion.map((st) => st.id)))}>
              Take those
            </button>
          </div>
        )}

        {byBarn.map(({ barn, stalls: list }) => {
          const all = list.every((st) => picked.has(st.id));
          return (
            <div key={barn?.id} className="pick-barn">
              <div className="pick-hd">
                <b>{barn?.name}</b>
                <span className="tiny mute">{list.filter((st) => st.animalId).length} with a horse in</span>
                <button
                  className="btn sm"
                  onClick={() =>
                    setPicked((p) => {
                      const next = new Set(p);
                      list.forEach((st) => (all ? next.delete(st.id) : next.add(st.id)));
                      return next;
                    })
                  }
                >
                  {all ? "None" : "All of it"}
                </button>
              </div>
              <div className="pick-boxes">
                {list.map((st) => {
                  const taken = roundOfStall(world, kind, st.id);
                  const mineAlready = taken && taken.staffId === person.id;
                  const animal = st.animalId ? world.animals.find((a) => a.id === st.animalId) : null;
                  const due = stallDue(world, st, kind, now);
                  const who = taken && !mineAlready ? world.staff.find((p) => p.id === taken.staffId) : null;
                  return (
                    <button
                      key={st.id}
                      className={`pick-box ${picked.has(st.id) ? "on" : ""} ${animal ? "" : "empty"} ${who ? "taken" : ""}`}
                      title={
                        who
                          ? `${st.name} — ${who.name} has this one`
                          : animal
                          ? `${st.name} — ${animal.name}${due?.behind ? ` · ${due.behind} behind` : ""}`
                          : `${st.name} — empty`
                      }
                      onClick={() => toggle(st.id)}
                    >
                      <b>{st.index}</b>
                      <span className="pick-nm">{animal ? animal.name : "Empty"}</span>
                      {due?.behind ? <i className="pick-late" /> : null}
                      {who && <span className="pick-who">{who.name.split(" ")[0]}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="hint">
          Boxes already on somebody else's round are marked with their name — taking one moves it.
        </div>
      </div>
    </Modal>
  );
}

/** One person, and the horses they have for this job. */
function JobPerson({ person, kind, job, jobs, held, onPlace }) {
  const { world, now, actions } = useWorld();
  const horses = ((job && job.animalIds) || []).map((id) => world.animals.find((a) => a.id === id)).filter(Boolean);
  // how much this person has on across every job today, as the rider cards show
  const all = jobs.reduce((n, j) => n + (j.staffId === person.id ? (j.animalIds || []).length : 0), 0);

  return (
    <div
      className={`rider-card ${horses.length ? "filled" : ""} ${held ? "target" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onPlace(person.id, e.dataTransfer.getData("text/animal"));
      }}
      onClick={() => held && onPlace(person.id, held.id)}
    >
      <div className="rc-hd">
        <ScrollName className="rc-nm">{person.name}</ScrollName>
        <span className="rc-lots nums" title={`${all} horses today across every job`}>
          {all}
        </span>
      </div>

      {horses.length ? (
        <>
          <div className="jc-horses tight">
            {horses.map((a) => (
              <span key={a.id} className="jc-horse">
                <Silks animal={a} size={18} />
                <ScrollName>{a.name}</ScrollName>
                <button
                  className="icon-btn sm"
                  title={`Take ${a.name} off`}
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.unassignJob(now, job.id, a.id);
                  }}
                >
                  <Icon name="close" size={11} />
                </button>
              </span>
            ))}
          </div>
          <div className="row" style={{ gap: 6 }} onClick={(e) => e.stopPropagation()}>
            <input
              className="inp sm nums"
              style={{ width: 92 }}
              type="time"
              value={job.at || ""}
              title="What time"
              onChange={(e) => actions.updateJob(now, job.id, { at: e.target.value })}
            />
            {kind === "other" && (
              <input
                className="inp sm"
                placeholder="What is it?"
                value={job.label || ""}
                onChange={(e) => actions.updateJob(now, job.id, { label: e.target.value })}
              />
            )}
            <input
              className="inp sm"
              placeholder="Anything to say"
              value={job.note || ""}
              onChange={(e) => actions.updateJob(now, job.id, { note: e.target.value })}
            />
          </div>
        </>
      ) : (
        <div className="rc-slot">{held ? `Tap to put ${held.name} down` : "Drop a horse here"}</div>
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
  const { jobs } = dayOfAnimal(plan, animal.id);
  if (!jobs.length) return boxOf(world, animal);
  return jobs
    .map((j) => `${j.at ? `${j.at} ` : ""}${j.kind === "other" && j.label ? j.label : jobKind(j.kind).label}`)
    .join(" · ");
}

/* ----------------------------- sending the day ----------------------------- */

/**
 * Publishing the day.
 *
 * One message per person, carrying everything they have — a groom with a round
 * of boxes who is also holding two for the farrier gets one text listing three
 * things, not three texts. It goes now, or it waits for the hour the yard
 * sends at.
 */
function SendList({ plan, yard, onClose }) {
  const { world, now, actions } = useWorld();
  const [when, setWhen] = useState("now");
  const [at, setAt] = useState(world.settings.planSendAt || "05:30");
  const messages = dayMessages(plan, world, yard);
  const rounds = messages.reduce((n, m) => n + m.roundCount, 0);
  const jobs = messages.reduce((n, m) => n + m.jobCount, 0);

  const send = () => {
    if (when === "at" && at !== world.settings.planSendAt) actions.setSettings({ planSendAt: at });
    actions.sendMessage({
      subject: `${yard?.name || "Yard"}: ${new Date(now).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}`,
      body: messages
        .map((m) => `${m.to.name} (${m.roundCount} rounds, ${m.jobCount} jobs)\n${m.body.split("\n").slice(2, -2).join("\n")}`)
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
            {messages.length} people · {rounds} rounds · {jobs} jobs · one message each
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
            Each person gets one message with everything they are down for — their round of boxes and every job.
            Anyone with nothing on is not messaged.
          </div>

          <div className="grid" style={{ gap: 10, maxHeight: 360, overflowY: "auto" }}>
            {messages.map((m) => (
              <div className="msg-preview" key={m.to.id}>
                <div className="row" style={{ gap: 8 }}>
                  <b>{m.to.name}</b>
                  {m.roundCount > 0 && (
                    <Pill tone="flat">
                      {m.roundCount} round{m.roundCount === 1 ? "" : "s"}
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
