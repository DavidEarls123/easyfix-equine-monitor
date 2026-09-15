/* ==========================================================================
   One horse: the passport, the day's readings, what the camera saw, and the
   notes the yard has kept. This is where a suspicion gets confirmed.
   ========================================================================== */

import { useMemo, useState } from "react";
import Icon from "../components/Icons";
import { Card, Coat, Empty, Field, Modal, Pill, Tabs, Tile, ago, hhmm } from "../components/ui";
import AlertList from "../components/AlertList";
import { BarChart, C, Gauge, LineChart } from "../components/charts";
import { NoteModal } from "./Animals";
import { useWorld } from "../lib/store";
import { go } from "../lib/router";
import { ageOf } from "../lib/registry";
import { stallAlerts, stallState } from "../lib/insights";
import { welfareIndex, welfareTrend } from "../lib/score";
import { WelfareBreakdown, WelfareRing, WelfareTrend } from "../components/Welfare";
import { BEHAVIOUR, DAY_MS, behaviourDay, cameraEvents, dayReadings, startOfDay } from "../lib/sim";

const TONE = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b", flat: "#9fb6cb" };

export default function AnimalProfile({ id }) {
  const { world, now, actions } = useWorld();
  const [range, setRange] = useState("today");
  const [noting, setNoting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [editing, setEditing] = useState(false);

  const animal = world.animals.find((a) => a.id === id);
  const stall = world.stalls.find((s) => s.animalId === id) || null;
  if (!animal) return <Empty icon="horse">That profile no longer exists.</Empty>;

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
            <button className="btn" onClick={() => go(`video/${stall.id}`)}>
              <Icon name="video" size={15} /> Watch camera
            </button>
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

function EditModal({ animal, onClose, onRemove }) {
  const { actions } = useWorld();
  const [draft, setDraft] = useState(animal);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  return (
    <Modal
      title={`Edit ${animal.name}`}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn danger"
            onClick={() => {
              onRemove();
              onClose();
              go("animals");
            }}
          >
            <Icon name="trash" size={15} /> Remove profile
          </button>
          <button
            className="btn pri"
            onClick={() => {
              actions.updateAnimal(animal.id, { name: draft.name, goalL: Number(draft.goalL) || 35, owner: draft.owner, trainer: draft.trainer });
              onClose();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Name">
          <input className="inp" value={draft.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Daily water goal (L)">
          <input className="inp nums" type="number" min="10" max="80" value={draft.goalL} onChange={(e) => set("goalL", e.target.value)} />
        </Field>
        <Field label="Owner">
          <input className="inp" value={draft.owner || ""} onChange={(e) => set("owner", e.target.value)} />
        </Field>
        <Field label="Trainer">
          <input className="inp" value={draft.trainer || ""} onChange={(e) => set("trainer", e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
