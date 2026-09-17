/* ==========================================================================
   One horse: the passport, the day's readings, what the camera saw, and the
   notes the yard has kept. This is where a suspicion gets confirmed.
   ========================================================================== */

import { useMemo, useState } from "react";
import Icon from "../components/Icons";
import { Card, Coat, Empty, Field, Modal, Pill, Tabs, Tile, ago, dmy, hhmm } from "../components/ui";
import AlertList from "../components/AlertList";
import { BarChart, C, Gauge, LineChart } from "../components/charts";
import { NoteModal } from "./Animals";
import { useWorld } from "../lib/store";
import { go } from "../lib/router";
import { ageOf } from "../lib/registry";
import { stallAlerts, stallState } from "../lib/insights";
import { welfareIndex, welfareTrend } from "../lib/score";
import { activityDeviation, intakeDeviation, learnedBaseline } from "../lib/baseline";
import { WelfareBreakdown, WelfareRing, WelfareTrend } from "../components/Welfare";
import FrontOfStall from "../components/FrontOfStall";
import Silks, { SILKS_LIST, silksForOwner } from "../components/Silks";
import { COLOURS, colourOf } from "../lib/colours";
import { CARE, careToday } from "../lib/care";
import { BEHAVIOUR, DAY_MS, behaviourDay, cameraEvents, dayReadings, startOfDay } from "../lib/sim";

const TONE = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b", flat: "#9fb6cb" };

export default function AnimalProfile({ id }) {
  const { world, now, actions } = useWorld();
  const [range, setRange] = useState("today");
  const [noting, setNoting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [screen, setScreen] = useState(false);
  const [editing, setEditing] = useState(false);

  const animal = world.animals.find((a) => a.id === id);
  const stall = world.stalls.find((s) => s.animalId === id) || null;
  if (!animal) return <Empty icon="head">That profile no longer exists.</Empty>;

  const barn = stall ? world.barns.find((b) => b.id === stall.barnId) : null;
  const st = stall ? stallState(world, stall, now) : null;
  const alerts = st ? stallAlerts(world, st, now) : [];
  const s = world.settings;

  const hours = st ? st.today.hours.slice(0, new Date(now).getHours() + 1) : [];
  const week = useMemo(() => {
    if (!stall) return [];
    const start = startOfDay(now);
    return Array.from({ length: 7 }, (_, i) => {
      const d = dayReadings(stall, animal, start - (6 - i) * DAY_MS);
      return { label: new Date(d.dayStart).toLocaleDateString([], { weekday: "short" }), ...d };
    });
  }, [stall, animal, now]);

  const events = st ? cameraEvents(stall, animal, startOfDay(now)).filter((e) => e.at <= now).reverse() : [];

  // the index, and the six days behind it — replaying a week of a whole yard
  // is expensive, but one horse on its own profile is cheap
  const welfare = useMemo(() => (st ? welfareIndex(world, stall, animal, now, st) : null), [world, stall, animal, now, st]);
  const baseline = useMemo(
    () => (st && world.settings.baseline?.personalise !== false ? learnedBaseline(world, stall, animal, now) : null),
    [world, stall, animal, now, st]
  );
  const dev = useMemo(() => (baseline ? intakeDeviation(st.today, baseline, st.today.tempNow) : null), [baseline, st]);
  const move = useMemo(() => (baseline ? activityDeviation(stall, animal, baseline, now) : null), [baseline, stall, animal, now]);
  const trend = useMemo(
    () => (st && welfare ? welfareTrend(world, stall, animal, now, welfare.score) : null),
    [world, stall, animal, now, st, welfare]
  );

  return (
    <>
      <div className="page-hd">
        <div className="row" style={{ gap: 12 }}>
          <Coat animal={animal} size={46} />
          <div>
            <h1>{animal.name}</h1>
            <div className="sub row" style={{ gap: 8 }}>
              <Pill tone="flat">{ageOf(animal.foaled, now)} yo</Pill>
              <Pill tone="flat">{animal.sex}</Pill>
              <Pill tone="flat">{animal.colour}</Pill>
              {stall ? (
                <button className="lnk small" onClick={() => go(`barn/${stall.barnId}`)}>
                  {barn?.name} · {stall.name}
                </button>
              ) : (
                <Pill tone="warning">No box assigned</Pill>
              )}
            </div>
          </div>
        </div>
        <div className="hd-actions">
          {stall && (
            <>
              <button className="btn" onClick={() => setScreen(true)}>
                <Icon name="screen" size={15} /> Stall screen
              </button>
              <button className="btn" onClick={() => go(`video/${stall.id}`)}>
                <Icon name="video" size={15} /> Watch camera
              </button>
            </>
          )}
          <button className="btn" onClick={() => setNoting(true)}>
            <Icon name="note" size={15} /> Add note
          </button>
          <button className="btn" onClick={() => setMoving(true)}>
            <Icon name="barn" size={15} /> {stall ? "Move box" : "Assign box"}
          </button>
          <button className="btn" onClick={() => setEditing(true)}>
            <Icon name="edit" size={15} /> Edit
          </button>
        </div>
      </div>

      {stall && (
        <Card
          title="Feeding and mucking out"
          sub="Recorded from the screen on the front of the box"
          style={{ marginBottom: 16 }}
          right={
            <button className="btn sm" onClick={() => setScreen(true)}>
              <Icon name="screen" size={14} /> Open the stall screen
            </button>
          }
        >
          <CareCard animal={animal} now={now} />
        </Card>
      )}

      {stall && baseline && (
        <Card
          title={`What is normal for ${animal.name}`}
          sub="Learned from this horse alone — water and movement are individual, the box is not"
          style={{ marginBottom: 16 }}
        >
          <Baseline baseline={baseline} dev={dev} move={move} today={st.today} />
        </Card>
      )}

      {stall && welfare && (
        <Card
          title="Welfare index"
          sub="Every sensor and camera input on this horse, weighted into one score"
          style={{ marginBottom: 16 }}
        >
          <div className="welfare-head">
            <div className="welfare-head-score">
              <WelfareRing welfare={welfare} size={112} />
              {trend && <div style={{ marginTop: 12 }}><WelfareTrend trend={trend} width={140} /></div>}
            </div>
            <div className="grow" style={{ minWidth: 0 }}>
              <WelfareBreakdown welfare={welfare} />
            </div>
          </div>
        </Card>
      )}

      {alerts.length > 0 && (
        <Card title="Open on this horse" style={{ marginBottom: 16 }}>
          <AlertList alerts={alerts} now={now} />
        </Card>
      )}

      {!stall ? (
        <Card>
          <Empty icon="barn">
            {animal.name} is not in a monitored box, so there is no sensor or camera data.
            <div style={{ marginTop: 10 }}>
              <button className="btn pri" onClick={() => setMoving(true)}>
                Assign a box
              </button>
            </div>
          </Empty>
        </Card>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(280px,1fr)", alignItems: "start" }}>
          <div className="grid">
            <Card
              title="Water intake"
              sub={`Goal ${animal.goalL} L a day · ${st.today.intakeL} L so far · six-day average ${st.past.intakeL} L`}
              right={
                <Tabs
                  items={[
                    { id: "today", label: "Today" },
                    { id: "week", label: "7 days" },
                  ]}
                  value={range}
                  onChange={setRange}
                />
              }
            >
              <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) auto", gap: 16, alignItems: "center" }}>
                {range === "today" ? (
                  <BarChart
                    values={hours.map((h) => ({ label: String(h.h).padStart(2, "0"), v: h.intakeL }))}
                    color={C.water}
                    unit=" L"
                    title="Intake by hour"
                  />
                ) : (
                  <LineChart
                    values={week.map((d) => ({ label: d.label, v: d.intakeL }))}
                    color={C.water}
                    unit=" L"
                    limit={{ v: animal.goalL, label: "goal" }}
                    title="Intake by day"
                  />
                )}
                <Gauge
                  pct={st.today.offline ? 0 : st.today.dayPct}
                  label="of goal"
                  sub={st.today.offline ? "meter offline" : `pace ${st.today.pctOfGoal}%`}
                  color={C.water}
                />
              </div>
            </Card>

            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Card title="Stall temperature" sub={`Comfort band ${s.tempMin}–${s.tempMax}°C`}>
                <LineChart
                  values={(range === "today" ? hours.map((h) => ({ label: String(h.h).padStart(2, "0"), v: h.tempC })) : week.map((d) => ({ label: d.label, v: d.tempC })))}
                  color={C.temp}
                  unit="°C"
                  band={[s.tempMin, s.tempMax]}
                  title="Stall temperature"
                />
              </Card>
              <Card title="Air quality" sub={`Target above ${s.airMin}% · ammonia under ${s.nh3Max} ppm`}>
                <LineChart
                  values={(range === "today" ? hours.map((h) => ({ label: String(h.h).padStart(2, "0"), v: h.air })) : week.map((d) => ({ label: d.label, v: d.air })))}
                  color={C.air}
                  unit="%"
                  limit={{ v: s.airMin, label: "target" }}
                  title="Air quality score"
                />
              </Card>
            </div>

            <Card title="What the camera saw today" sub="Behaviour called by the AI camera, minute by minute">
              <Timeline stall={stall} animal={animal} now={now} />
              <div style={{ marginTop: 14 }}>
                {events.length === 0 && <div className="small mute">Nothing worth flagging yet today.</div>}
                {events.slice(0, 8).map((e) => (
                  <div key={e.at} className="row" style={{ gap: 10, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
                    <span className={`dot ${e.severity === "info" ? "flat" : e.severity}`} />
                    <b className="small nums">{hhmm(e.at)}</b>
                    <span className="small">{e.title}</span>
                    <span className="small mute">{e.detail}</span>
                    <span className="tiny mute" style={{ marginLeft: "auto" }}>
                      {e.mins} min · {e.conf}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid">
            <div className="tiles" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Tile kind="water" label="Today" value={st.today.offline ? "—" : st.today.intakeL} unit=" L" note={`goal ${animal.goalL} L`} />
              <Tile kind="temp" label="Stall now" value={st.today.tempNow ?? "—"} unit="°C" />
              <Tile kind="air" label="Air now" value={st.today.airNow} unit="%" note={`${st.today.nh3Now} ppm NH₃`} />
              <Tile label="Humidity" value={st.today.humidityNow} unit="%" />
            </div>

            <Card title="Camera identity">
              <div className="row" style={{ gap: 10 }}>
                <span className={`ico ${st.identity?.mismatch ? "warning" : "good"}`} style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: st.identity?.mismatch ? "#fef6e3" : "#eaf7ea" }}>
                  <Icon name="id" size={17} />
                </span>
                <div>
                  <b>{st.identity?.mismatch ? "Mismatch" : "Confirmed"}</b>
                  <div className="small mute">
                    {st.identity?.mismatch
                      ? `Camera recognises ${world.animals.find((a) => a.id === animal.seenAs)?.name || "another horse"} in this box`
                      : `${animal.name} recognised in ${stall.name}`}{" "}
                    at {st.identity?.conf}% · {ago(st.identity?.at, now)}
                  </div>
                </div>
              </div>
              <div className="small mute" style={{ marginTop: 10, lineHeight: 1.6 }}>
                The camera matches on markings, coat pattern and gait. Move the horse to another box and it is recognised there, so the
                intake history follows the horse rather than the box.
              </div>
            </Card>

            <Card title="Passport" sub={animal.source}>
              <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "7px 14px", fontSize: 13 }}>
                {[
                  ["Passport", animal.passportId],
                  ["Foaled", animal.foaled],
                  ["Breed", animal.breed],
                  ["Sire", animal.sire],
                  ["Dam", animal.dam],
                  ["Dam's sire", animal.damSire],
                  ["Markings", animal.markings],
                  ["Height", animal.height],
                  ["Microchip", animal.microchip],
                  ["UELN", animal.ueln],
                  ["Owner", animal.owner],
                  ["Trainer", animal.trainer],
                  ["Breeder", animal.breeder],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} style={{ display: "contents" }}>
                      <dt className="mute" style={{ whiteSpace: "nowrap" }}>
                        {k}
                      </dt>
                      <dd className="nums" style={{ margin: 0 }}>
                        {v}
                      </dd>
                    </div>
                  ))}
              </dl>
            </Card>

            <Card
              title="Notes"
              right={
                <button className="btn sm" onClick={() => setNoting(true)}>
                  <Icon name="plus" size={13} /> Add
                </button>
              }
            >
              {(animal.notes || []).length === 0 && <div className="small mute">No notes yet.</div>}
              {(animal.notes || []).map((n) => (
                <div key={n.at} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <div className="tiny mute">{new Date(n.at).toLocaleString()}</div>
                  <div className="small">{n.text}</div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}

      {screen && stall && (
        <Modal
          title={`${stall.name} — screen on the box front`}
          wide
          onClose={() => setScreen(false)}
          footer={
            <>
              <span className="small mute" style={{ marginRight: "auto", lineHeight: 1.5 }}>
                Live panel. Pressing a button here records the round exactly as it would on the box.
              </span>
              <button className="btn" onClick={() => setScreen(false)}>
                Close
              </button>
            </>
          }
        >
          <FrontOfStall stall={stall} animal={animal} state={st} now={now} onClose={() => setScreen(false)} />
        </Modal>
      )}

      {noting && <NoteModal animal={animal} onClose={() => setNoting(false)} />}
      {moving && <MoveModal animal={animal} stall={stall} onClose={() => setMoving(false)} />}
      {editing && <EditModal animal={animal} onClose={() => setEditing(false)} onRemove={() => actions.removeAnimal(animal.id)} />}
    </>
  );
}

/* The day as a strip: one band per behaviour, hover for the detail. */
function Timeline({ stall, animal, now }) {
  const segs = behaviourDay(stall, animal, startOfDay(now));
  const mins = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const tone = (state) => TONE[BEHAVIOUR[state]?.tone || "flat"];
  return (
    <div>
      <svg viewBox="0 0 1440 46" style={{ width: "100%", height: 46 }} role="img" aria-label="Behaviour through the day">
        {segs.map((g) => (
          <rect key={g.from} x={g.from} y={8} width={Math.max(1, g.to - g.from)} height={22} fill={tone(g.state)} opacity={g.from > mins ? 0.16 : 0.92}>
            <title>{`${String(Math.floor(g.from / 60)).padStart(2, "0")}:${String(g.from % 60).padStart(2, "0")} — ${BEHAVIOUR[g.state]?.label || g.state}`}</title>
          </rect>
        ))}
        <rect x={mins - 1} y={4} width="2.5" height="30" fill="#0b2138" />
        {[0, 6, 12, 18, 24].map((h) => (
          <text key={h} x={Math.min(1420, h * 60)} y={44} fontSize="20" fill="#86a0b8" textAnchor={h === 0 ? "start" : h === 24 ? "end" : "middle"}>
            {String(h).padStart(2, "0")}:00
          </text>
        ))}
      </svg>
      <div className="legend" style={{ marginTop: 6 }}>
        {["good", "flat", "warning", "serious", "critical"].map((t) => (
          <span key={t}>
            <span className="sw" style={{ background: TONE[t] }} />
            {t === "good" ? "Eating / drinking" : t === "flat" ? "Resting, standing" : t === "warning" ? "Restless" : t === "serious" ? "Flank watching, uneven gait" : "Down and rolling"}
          </span>
        ))}
      </div>
    </div>
  );
}

function MoveModal({ animal, stall, onClose }) {
  const { world, actions } = useWorld();
  const [pick, setPick] = useState("");
  const free = world.stalls
    .filter((s) => !s.animalId || s.id === stall?.id)
    .map((s) => ({ ...s, barn: world.barns.find((b) => b.id === s.barnId) }))
    .filter((s) => s.barn?.configured);
  return (
    <Modal
      title={`Move ${animal.name}`}
      onClose={onClose}
      footer={
        <>
          {stall && (
            <button
              className="btn danger"
              onClick={() => {
                actions.assign(stall.id, null);
                onClose();
              }}
            >
              Take out of the box
            </button>
          )}
          <button
            className="btn pri"
            disabled={!pick}
            onClick={() => {
              actions.assign(pick, animal.id);
              onClose();
            }}
          >
            Move
          </button>
        </>
      }
    >
      <Field label="New box" hint="History follows the horse, not the box">
        <select className="sel" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Choose a box…</option>
          {free.map((s) => (
            <option key={s.id} value={s.id}>
              {s.barn.name} · {s.name}
              {s.id === stall?.id ? " (current)" : ""}
            </option>
          ))}
        </select>
      </Field>
    </Modal>
  );
}

/**
 * The profile the stall screen reads from.
 *
 * Everything marked "on the stall screen" appears on the panel on the front of
 * the box, so the form says so rather than leaving the yard to find out by
 * looking. Until a passport source fills these in they are typed here.
 */
function EditModal({ animal, onClose, onRemove }) {
  const { world, actions } = useWorld();
  const [draft, setDraft] = useState({ ...animal });
  const [confirm, setConfirm] = useState(false);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const grooms = (world.staff || []).filter((p) => (p.groups || []).includes("yard"));

  const onScreen = (label) => (
    <>
      {label}
      <span className="screen-tag" title="Shown on the screen on the front of the box">
        <Icon name="screen" size={10} /> screen
      </span>
    </>
  );

  const save = () => {
    actions.updateAnimal(animal.id, {
      name: draft.name.trim() || animal.name,
      foaled: draft.foaled,
      sex: draft.sex,
      colour: draft.colour,
      owner: draft.owner,
      sire: draft.sire,
      dam: draft.dam,
      groom: draft.groom,
      silks: draft.silks || null,
      trainer: draft.trainer,
      goalL: Number(draft.goalL) || 35,
    });
    onClose();
  };

  return (
    <Modal
      title={`Edit ${animal.name}`}
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn danger" style={{ marginRight: "auto" }} onClick={() => setConfirm(true)}>
            <Icon name="trash" size={15} /> Remove profile
          </button>
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
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label={onScreen("Name")}>
            <input className="inp" value={draft.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label={onScreen("Age")} hint="From the foaling date, as a passport reads it">
            <input className="inp" type="date" value={draft.foaled || ""} onChange={(e) => set("foaled", e.target.value)} />
          </Field>
          <Field label={onScreen("Sex")}>
            <select className="sel" value={draft.sex || ""} onChange={(e) => set("sex", e.target.value)}>
              {["Gelding", "Mare", "Filly", "Colt", "Stallion", "Rig"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label={onScreen("Type")} hint={colourOf(draft.colour).hint}>
            <select className="sel" value={draft.colour || "Bay"} onChange={(e) => set("colour", e.target.value)}>
              {COLOURS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={onScreen("Sire")}>
            <input className="inp" value={draft.sire || ""} onChange={(e) => set("sire", e.target.value)} />
          </Field>
          <Field label={onScreen("Dam")}>
            <input className="inp" value={draft.dam || ""} onChange={(e) => set("dam", e.target.value)} />
          </Field>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label={onScreen("Owner")}>
            <input className="inp" value={draft.owner || ""} onChange={(e) => set("owner", e.target.value)} />
          </Field>
          <Field label={onScreen("Groom")} hint="Whoever does this box">
            <input
              className="inp"
              list="groom-list"
              value={draft.groom || ""}
              onChange={(e) => set("groom", e.target.value)}
            />
            <datalist id="groom-list">
              {grooms.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Trainer">
            <input className="inp" value={draft.trainer || ""} onChange={(e) => set("trainer", e.target.value)} />
          </Field>
        </div>

        <Field
          label={onScreen("Colours")}
          hint="The owner's registered racing colours. These are the supplied sets."
        >
          <SilksPicker value={draft.silks} owner={draft.owner} onChange={(v) => set("silks", v)} />
        </Field>

        <Field label="Daily water goal (L)" hint="Only used until the app has learned this horse">
          <input
            className="inp nums"
            style={{ maxWidth: 140 }}
            type="number"
            min="10"
            max="80"
            value={draft.goalL}
            onChange={(e) => set("goalL", e.target.value)}
          />
        </Field>

        {confirm && (
          <div className="rec" style={{ background: "#fef4f4", borderColor: "#f2cccc" }}>
            <div className="rec-hd" style={{ color: "#a92c2c" }}>Remove {animal.name}</div>
            <p>The profile and its history go. The box stays and becomes empty.</p>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn sm" onClick={() => setConfirm(false)}>
                Keep it
              </button>
              <button
                className="btn sm danger"
                onClick={() => {
                  onRemove();
                  onClose();
                  go("animals");
                }}
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Pick a set of registered colours, or none. */
function SilksPicker({ value, owner, onChange }) {
  const [q, setQ] = useState("");
  const suggested = silksForOwner(owner);
  const needle = q.trim().toLowerCase();
  const list = SILKS_LIST.filter((s) => !needle || s.label.toLowerCase().includes(needle));

  return (
    <div>
      {suggested && suggested.id !== value && (
        <button className="btn sm" style={{ marginBottom: 8 }} onClick={() => onChange(suggested.id)}>
          Use {suggested.label}'s registered colours
        </button>
      )}
      <input
        className="inp"
        placeholder="Search colours by owner"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      <div className="silks-grid">
        <button className={`silks-opt ${!value ? "on" : ""}`} onClick={() => onChange(null)} type="button">
          <span className="silks-none" style={{ width: 33, height: 44 }} />
          <span>None</span>
        </button>
        {list.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`silks-opt ${value === s.id ? "on" : ""}`}
            onClick={() => onChange(s.id)}
            title={s.label}
          >
            <Silks id={s.id} size={44} />
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------- the horse's own baseline ------------------------ */

function Baseline({ baseline, dev, move, today }) {
  if (baseline.learning)
    return (
      <div className="learning">
        <Icon name="clock" size={18} />
        <div>
          <b>Still learning this horse.</b>
          <div className="small mute" style={{ marginTop: 3, lineHeight: 1.6 }}>
            {baseline.days} clean {baseline.days === 1 ? "day" : "days"} on record
            {baseline.skipped ? `, ${baseline.skipped} skipped for a dead meter` : ""} — {baseline.needs} more before
            intake is judged against this animal rather than the yard goal. The yard thresholds are carrying it until
            then.
          </div>
        </div>
      </div>
    );

  const { intake } = baseline;
  // where today sits inside the horse's own band
  const span = Math.max(1, intake.hi - intake.lo);
  const at = dev && !dev.tooEarly ? Math.max(0, Math.min(100, ((dev.projected - intake.lo) / span) * 100)) : null;
  const tone = !dev || dev.tooEarly ? "flat" : dev.low ? "critical" : dev.high ? "warning" : "good";

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <Pill tone="good">Learned from {baseline.days} days</Pill>
        {baseline.skipped > 0 && <Pill tone="flat">{baseline.skipped} days skipped — meter offline</Pill>}
        {dev?.adjusted && <Pill tone="flat">Adjusted for box temperature</Pill>}
      </div>

      <div>
        <div className="row" style={{ gap: 8, marginBottom: 6 }}>
          <b style={{ fontSize: 13 }}>Daily water</b>
          <span className="small mute nums">
            usually {intake.median} L · normal range {intake.lo}–{intake.hi} L
          </span>
          {dev && !dev.tooEarly && (
            <span style={{ marginLeft: "auto" }}>
              <Pill tone={tone}>
                {dev.pct}% of normal
                {dev.verdict !== "normal" ? ` · ${dev.verdict}` : ""}
              </Pill>
            </span>
          )}
        </div>

        {/* the band this horse normally sits in, and where today is heading */}
        <div className="band">
          <span className="band-normal" />
          {at != null && <span className="band-now" style={{ left: `${at}%` }} />}
        </div>
        <div className="row small mute nums" style={{ justifyContent: "space-between", marginTop: 4 }}>
          <span>{intake.lo} L</span>
          <span>
            {dev && !dev.tooEarly
              ? `${today.intakeL} L so far · tracking ${dev.projected} L`
              : `${today.intakeL} L so far · too early in the day to project`}
          </span>
          <span>{intake.hi} L</span>
        </div>
      </div>

      <div>
        <div className="row" style={{ gap: 8, marginBottom: 6 }}>
          <b style={{ fontSize: 13 }}>Daily movement</b>
          <span className="small mute nums">usually {baseline.activity.activeMedian} active minutes</span>
          {move && !move.tooEarly && (
            <span style={{ marginLeft: "auto" }}>
              <Pill tone={move.low ? "warning" : move.high ? "warning" : "good"}>
                {move.projected} min projected · {move.verdict}
              </Pill>
            </span>
          )}
        </div>
        <div className="hint">
          Lying down usually {Math.round(baseline.activity.lyingMedian / 60)} h a day. A horse that goes quiet is often
          sore before it is lame.
        </div>
      </div>
    </div>
  );
}

/* --------------------------- the day's rounds ------------------------------ */

function CareCard({ animal, now }) {
  const { world, actions } = useWorld();
  const care = careToday(world, animal, now);
  const [note, setNote] = useState(animal.stallNote || "");
  const [history, setHistory] = useState(false);
  const send = () => note.trim() && actions.setStallNote(animal.id, note.trim(), world.settings.operator);

  const row = (kind) => {
    const c = care[kind];
    const meta = CARE[kind];
    const tone = c.complete ? "good" : c.behind >= 2 ? "serious" : c.behind ? "warning" : "flat";
    return (
      <div className="care-row" key={kind}>
        <span className={`ico ${tone}`} style={{ width: 34, height: 34, borderRadius: 10 }}>
          <Icon name={meta.icon} size={17} />
        </span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <b>{meta.label}</b>
            <Pill tone={tone}>
              {c.done} of {c.target} today
            </Pill>
            {c.behind > 0 && <Pill tone="warning">{c.behind} behind</Pill>}
          </div>
          <div className="why">
            {c.entries.length
              ? c.entries.map((e) => `${hhmm(e.at)} ${e.by}`).join(" · ")
              : "Nothing recorded yet today"}
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <label className="tiny mute">Per day</label>
          <input
            className="inp nums"
            style={{ width: 62 }}
            type="number"
            min="0"
            max="8"
            value={care.target[meta.field]}
            onChange={(e) => actions.setCare(animal.id, { [meta.field]: Number(e.target.value) })}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      {row("feed")}
      {row("clean")}
      <Field label="Note on the stall screen" hint="Shown on the box front until it is replaced or cleared.">
        <div className="row" style={{ gap: 8 }}>
          <input
            className="inp"
            value={note}
            placeholder="e.g. Racing Thursday — cheekpieces"
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button className="btn act" disabled={!note.trim() || note.trim() === animal.stallNote} onClick={send}>
            <Icon name="screen" size={14} /> Send to the box
          </button>
          {animal.stallNote && (
            <button className="btn ghost" onClick={() => { actions.setStallNote(animal.id, "", world.settings.operator); setNote(""); }}>
              Clear
            </button>
          )}
        </div>
      </Field>

      {(animal.noteLog || []).length > 0 && (
        <div>
          <button className="btn sm ghost" onClick={() => setHistory((h) => !h)}>
            <Icon name="clock" size={13} /> {history ? "Hide" : "Show"} note history ({animal.noteLog.length})
          </button>
          {history && (
            <div className="note-log">
              {animal.noteLog.map((n, i) => (
                <div className="note-log-row" key={`${n.at}-${i}`}>
                  <span className="tiny mute nums">{dmy(n.at)} {hhmm(n.at)}</span>
                  <span className="grow">{n.text}</span>
                  <span className="tiny mute">{n.by}</span>
                  {i === 0 && animal.stallNote === n.text && <Pill tone="good">On the box now</Pill>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
