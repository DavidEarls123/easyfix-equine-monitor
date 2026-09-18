/* ==========================================================================
   One barn: the stall-by-stall table the yard reads in the morning, the stock
   it is running on, and the layout that says where everything is.
   ========================================================================== */

import { useMemo, useState } from "react";
import Icon from "../components/Icons";
import { Card, Coat, Empty, Field, Modal, Pill, Tabs, Tile } from "../components/ui";
import AttentionList from "../components/AttentionList";
import LayoutEditor from "../components/LayoutEditor";
import { C, Sparkline } from "../components/charts";
import AddAnimal from "./AddAnimal";
import { useWorld } from "../lib/store";
import { airStatus, tempStatus, waterStatus } from "../lib/status";
import FrontOfBarn from "../components/FrontOfBarn";
import Silks from "../components/Silks";
import ScrollName from "../components/ScrollName";
import { go } from "../lib/router";
import { barnAlerts } from "../lib/insights";
import { CELL } from "../lib/world";
import { DAY_MS, dayReadings, startOfDay } from "../lib/sim";

const TABS = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "door", label: "Barn screen", icon: "screen" },
  { id: "stock", label: "Stock", icon: "stock" },
];

export default function BarnDetail({ id, tab = "overview", snap }) {
  const { world, now, actions } = useWorld();
  const roll = snap.rolls.find((r) => r.barn.id === id) || snap.rolls[0];
  const [assigning, setAssigning] = useState(null);
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState(null); // a barn or a stall being renamed
  const [settings, setSettings] = useState(false);

  if (!roll) return <Empty icon="barn">No barns yet. Add one from the yard screen.</Empty>;
  const barn = roll.barn;
  const alerts = [...barnAlerts(world, roll, now), ...roll.alerts].sort(
    (a, b) => ({ critical: 0, serious: 1, warning: 2, info: 3, good: 4 }[a.severity] - { critical: 0, serious: 1, warning: 2, info: 3, good: 4 }[b.severity])
  );

  // layout is not a tab any more — it is opened from Barn settings
  const at = tab === "layout" || TABS.some((t) => t.id === tab) ? tab : "overview";

  return (
    <>
      <div className="page-hd">
        <div className="row" style={{ gap: 10 }}>
          <h1>{barn.name}</h1>
          <select
            className="sel"
            style={{ width: "auto" }}
            value={barn.id}
            onChange={(e) => go(`barn/${e.target.value}?t=${at}`)}
            aria-label="Switch barn"
          >
            {world.barns.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="hd-actions">
          <button className="btn" onClick={() => setSettings(true)}>
            <Icon name="settings" size={15} /> Barn settings
          </button>
          <button className="btn" onClick={() => go(`video?barn=${barn.id}`)}>
            <Icon name="video" size={15} /> Cameras
          </button>
          <button className="btn" onClick={() => go("barns")}>
            <Icon name="left" size={15} /> All barns
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Tabs items={TABS} value={at} onChange={(t) => go(`barn/${barn.id}?t=${t}`)} />
      </div>

      {!barn.configured && at !== "layout" ? (
        <Card>
          <Empty icon="barn">
            {barn.name} has no layout yet.
            <div style={{ marginTop: 10 }}>
              <button className="btn pri" onClick={() => go(`barn/${barn.id}?t=layout`)}>
                Set up the layout
              </button>
            </div>
          </Empty>
        </Card>
      ) : at === "overview" ? (
        <Overview roll={roll} alerts={alerts} now={now} snap={snap} onAssign={setAssigning} onRename={setRenaming} />
      ) : at === "door" ? (
        <Card
          title={`${barn.name} — screen on the barn door`}
          sub="What the wall panel at the entrance shows. Press a box for its own stall screen."
        >
          <FrontOfBarn roll={roll} now={now} />
        </Card>
      ) : at === "stock" ? (
        <Stock roll={roll} alerts={alerts.filter((a) => a.kind === "stock")} now={now} snap={snap} onSet={(p) => actions.setStock(barn.id, p)} />
      ) : (
        <Layout roll={roll} editing={editing} setEditing={setEditing} onAssign={setAssigning} />
      )}

      {settings && (
        <BarnSettings
          barn={barn}
          onClose={() => setSettings(false)}
          onEditLayout={() => {
            setSettings(false);
            go(`barn/${barn.id}?t=layout`);
            setEditing(true);
          }}
        />
      )}

      {renaming && (
        <RenameModal
          target={renaming}
          onClose={() => setRenaming(null)}
          onSave={(name) => {
            if (renaming.kind === "barn") actions.renameBarn(renaming.id, name);
            else actions.renameStall(renaming.id, name);
            setRenaming(null);
          }}
        />
      )}

      {assigning && <Assign stall={assigning} onClose={() => setAssigning(null)} />}
    </>
  );
}

/* -------------------------------- overview -------------------------------- */

function Overview({ roll, alerts, now, snap, onAssign, onRename }) {
  const { world } = useWorld();
  const s = world.settings;
  const [page, setPage] = useState(0);
  const PER = 30;
  const rows = roll.states.slice().sort((a, b) => a.stall.index - b.stall.index);
  const pages = Math.ceil(rows.length / PER);
  const shown = pages > 1 ? rows.slice(page * PER, page * PER + PER) : rows;

  const past = roll.states.filter((x) => x.animal);
  const avg = (f) => (past.length ? Math.round((past.reduce((a, x) => a + f(x), 0) / past.length) * 10) / 10 : 0);

  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0,3fr) minmax(210px,1fr)", alignItems: "start" }}>
      <div className="grid">
        <Card pad={false} style={{ padding: "6px 14px 14px" }}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="name-cell">Stall</th>
                  <th className="name-cell">Horse</th>
                  <th className="col-silks">Colours</th>
                  <th>Intake</th>
                  <th>Pace</th>
                  <th>Temp</th>
                  <th>Air</th>
                  <th>Camera</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((x) => (
                  <Row key={x.stall.id} x={x} s={s} now={now} onAssign={onAssign} onRename={onRename} />
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
              <button className="btn sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <Icon name="left" size={14} />
              </button>
              <span className="small mute nums">
                {page + 1} / {pages}
              </span>
              <button className="btn sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                <Icon name="right" size={14} />
              </button>
            </div>
          )}
        </Card>

        <Card title="Warnings" sub={`${alerts.length} open in ${roll.barn.name}`}>
          <AttentionList alerts={alerts} snap={snap} now={now} limit={6} empty="No active warnings." />
        </Card>
      </div>

      <div className="grid">
        <Card title="Water intake" pad>
          <div className="grid" style={{ gap: 10 }}>
            <Tile kind="water" label="Last 6 days" value={avg((x) => x.past.intakeL)} unit=" L" note="daily average per box" />
            <Tile kind="water" label="So far today" value={avg((x) => x.today.intakeL)} unit=" L" note="average per box" />
            <Tile kind="water" label="Today's goal" value={roll.pctOfGoal} unit="%" note="of the pace for the day" />
          </div>
        </Card>
        <Card title="Temperature">
          <div className="grid" style={{ gap: 10 }}>
            <Tile kind="temp" label="Last 6 days" value={avg((x) => x.past.tempC)} unit="°C" note="24-hour average" />
            <Tile kind="temp" label="Now" value={roll.tempC} unit="°C" note={`band ${s.tempMin}–${s.tempMax}°C`} />
          </div>
        </Card>
        <Card title="Air quality">
          <div className="grid" style={{ gap: 10 }}>
            <Tile kind="air" label="Now" value={roll.air} unit="%" note={`target above ${s.airMin}%`} />
            <Tile kind="air" label="Humidity now" value={roll.humidity} unit="%" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ x, s, now, onAssign, onRename }) {
  const { stall, animal, today: t, behaviour } = x;
  const week = useMemo(() => {
    if (!animal) return [];
    const start = startOfDay(now);
    return Array.from({ length: 6 }, (_, i) => dayReadings(stall, animal, start - (5 - i) * DAY_MS).intakeL);
  }, [stall, animal, now]);

  if (!animal)
    return (
      <tr>
        <td className="name-cell">
          <StallName stall={stall} onRename={onRename} />
        </td>
        <td className="mute name-cell" colSpan={6}>
          Empty box
        </td>
        <td>
          <button className="btn sm" onClick={() => onAssign(stall)}>
            <Icon name="plus" size={13} /> Assign
          </button>
        </td>
      </tr>
    );

  const pace = t.offline ? null : t.pctOfGoal;
  const water = waterStatus(t, s);
  const temp = tempStatus(t.tempNow, s);
  const air = airStatus(t.airNow, s, t.nh3Now);
  const paceTone = water.tone;
  const arrow = pace == null ? "—" : pace < s.intakeLowPct ? "↓" : pace > 130 ? "↑" : "↔";
  const tempTone = temp.tone;
  const airTone = air.tone;

  return (
    <tr>
      <td className="name-cell">
        <StallName stall={stall} onRename={onRename} />
      </td>
      <td className="name-cell">
        <div className="row" style={{ gap: 9 }}>
          <Coat animal={animal} size={26} />
          <button className="lnk nm-slot" onClick={() => go(`animal/${animal.id}`)}>
            <ScrollName>{animal.name}</ScrollName>
          </button>
        </div>
      </td>
      <td className="col-silks">
        <span className="silks-cell">
          <Silks animal={animal} size={38} />
        </span>
      </td>
      <td className="nums">
        {t.offline ? (
          <Pill tone="critical" icon="alert">No data</Pill>
        ) : (
          <Pill tone={water.tone} title={water.hint}>{t.intakeL} L</Pill>
        )}
        {!t.offline && week.length > 1 && (
          <div style={{ display: "grid", placeItems: "center", marginTop: 2 }}>
            <Sparkline values={week} color={C.water} w={72} h={18} />
          </div>
        )}
      </td>
      <td>
        <Pill tone={paceTone}>
          {arrow} {pace == null ? "—" : `${pace}%`}
        </Pill>
      </td>
      <td>
        <Pill tone={tempTone}>{t.tempNow == null ? "—" : `${t.tempNow}°C`}</Pill>
      </td>
      <td>
        <Pill tone={airTone}>{t.airNow}%</Pill>
      </td>
      <td>
        <button className="btn sm ghost" onClick={() => go(`video/${stall.id}`)} title="Open camera">
          <Icon name="camera" size={14} /> {behaviour ? behaviourLabel(behaviour.state) : "—"}
        </button>
      </td>
    </tr>
  );
}

const LABEL = {
  resting: "Lying",
  dozing: "Dozing",
  standing: "Standing",
  eating: "Eating",
  drinking: "Drinking",
  walking: "Moving",
  turnout: "Out",
  restless: "Restless",
  flank: "Flank watch",
  cast: "Down",
  lame: "Uneven",
};
const behaviourLabel = (s) => LABEL[s] || "Standing";

const SWATCH = { stall: "#dbecff", aisle: "#e6ecf3", door: "#dde4ec", tack: "#eceadd", wash: "#dcf0f7", feed: "#f0e7d2" };

/* ---------------------------------- stock --------------------------------- */

function Stock({ roll, alerts, now, snap, onSet }) {
  const { say } = useWorld();
  const b = roll.barn;
  const dailyWater = Math.round(roll.occupied * (roll.intakeL || 30));
  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(260px,1fr)", alignItems: "start" }}>
      <div className="grid">
        <Card title="Consumables" sub="What the barn is running on right now">
          <div className="tiles">
            <Tile kind="water" label="Header tank" value={b.waterTankPct} unit="%" note={`about ${Math.max(1, Math.round((b.waterTankPct / 100) * 18))} h of supply`} />
            <Tile label="Feed" value={b.feedDays} unit=" days" note={`${roll.occupied} horses on ration`} />
            <Tile label="Bedding" value={b.beddingDays} unit=" days" note="at the current muck-out rate" />
            <Tile kind="water" label="Water drawn" value={dailyWater} unit=" L" note="across the barn today" />
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
            <Field label="Header tank %">
              <input className="inp nums" type="number" min="0" max="100" value={b.waterTankPct} onChange={(e) => onSet({ waterTankPct: Number(e.target.value) })} />
            </Field>
            <Field label="Feed days left">
              <input className="inp nums" type="number" min="0" max="60" value={b.feedDays} onChange={(e) => onSet({ feedDays: Number(e.target.value) })} />
            </Field>
            <Field label="Bedding days left">
              <input className="inp nums" type="number" min="0" max="60" value={b.beddingDays} onChange={(e) => onSet({ beddingDays: Number(e.target.value) })} />
            </Field>
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" onClick={() => say("Feed order drafted")}>
              <Icon name="stock" size={15} /> Draft feed order
            </button>
            <button className="btn" onClick={() => onSet({ waterTankPct: 100 })}>
              <Icon name="water" size={15} /> Mark tank refilled
            </button>
          </div>
        </Card>

        <Card title="Stock warnings">
          <AttentionList alerts={alerts} snap={snap} now={now} limit={20} empty="Stock levels are fine." />
        </Card>
      </div>

      <Card title="Why this matters">
        <p className="small mute" style={{ lineHeight: 1.7, marginTop: 0 }}>
          A header tank that empties overnight looks exactly like eight horses going off their water at once. The barn's stock is held
          beside the sensor data so the two can be read together — when several boxes drop at the same time, the yard is pointed at the
          supply before it is pointed at the horses.
        </p>
      </Card>
    </div>
  );
}

/* --------------------------------- layout --------------------------------- */

function Layout({ roll, editing, setEditing, onAssign }) {
  const { world, actions } = useWorld();
  const barn = roll.barn;
  const stalls = roll.stalls;

  if (editing || !barn.configured)
    return (
      <Card title={`${barn.name} layout`} sub="Paint the grid so it matches the building">
        <LayoutEditor
          barn={barn}
          stalls={stalls}
          animals={world.animals}
          onCancel={() => (barn.configured ? setEditing(false) : go("barns"))}
          onSave={(layout) => {
            actions.saveLayout(barn.id, layout);
            setEditing(false);
          }}
        />
      </Card>
    );

  const grid = [];
  for (let r = 0; r < barn.rows; r++)
    for (let c = 0; c < barn.cols; c++) {
      const cell = barn.cells.find((x) => x.r === r && x.c === c) || { r, c, kind: "empty" };
      grid.push(cell);
    }

  return (
    <Card
      title={`${barn.name} layout`}
      sub={`${stalls.length} boxes · ${roll.occupied} occupied · click a box to assign a horse`}
      right={
        <button className="btn" onClick={() => setEditing(true)}>
          <Icon name="edit" size={15} /> Edit the grid
        </button>
      }
    >
      <div className="layout-grid" style={{ gridTemplateColumns: `repeat(${barn.cols}, minmax(0,1fr))`, maxWidth: barn.cols * 128 }}>
        {grid.map((cell) => {
          const stall = stalls.find((s) => s.r === cell.r && s.c === cell.c);
          const animal = stall?.animalId ? world.animals.find((a) => a.id === stall.animalId) : null;
          const state = stall ? roll.states.find((x) => x.stall.id === stall.id) : null;
          const worst = state ? [...state.events].reverse().find((e) => e.severity === "critical" || e.severity === "serious") : null;
          if (cell.kind !== "stall")
            return (
              <div key={`${cell.r}:${cell.c}`} className={`cell ${cell.kind}`}>
                <span className="tiny">{cell.kind === "empty" ? "" : CELL[cell.kind].label}</span>
              </div>
            );
          return (
            <button
              key={`${cell.r}:${cell.c}`}
              className={`cell stall ${animal ? "occupied" : ""}`}
              onClick={() => (animal ? go(`animal/${animal.id}`) : onAssign(stall))}
              title={animal ? `${animal.name} — open profile` : "Empty box — assign a horse"}
            >
              <span className="n">{stall?.name}</span>
              {animal ? <span className="who">{animal.name}</span> : <span className="tiny mute">Empty</span>}
              {worst && <span className={`flag dot ${worst.severity}`} />}
            </button>
          );
        })}
      </div>

      <div className="legend" style={{ marginTop: 14 }}>
        {["stall", "aisle", "door", "tack", "wash", "feed"].map((k) => (
          <span key={k}>
            <span className="sw" style={{ background: SWATCH[k] }} /> {CELL[k].label}
          </span>
        ))}
        <span>
          <span className="dot critical" style={{ verticalAlign: 0 }} /> box with an open alert
        </span>
      </div>
    </Card>
  );
}

/* -------------------------------- assigning -------------------------------- */

function Assign({ stall, onClose }) {
  const { world, actions } = useWorld();
  const [pick, setPick] = useState("");
  const [adding, setAdding] = useState(false);
  const free = world.animals.filter((a) => !world.stalls.some((s) => s.animalId === a.id));
  const current = stall.animalId ? world.animals.find((a) => a.id === stall.animalId) : null;

  if (adding) return <AddAnimal presetStallId={stall.id} onClose={onClose} />;

  return (
    <Modal
      title={`${stall.name}`}
      onClose={onClose}
      footer={
        <>
          {current && (
            <button
              className="btn danger"
              onClick={() => {
                actions.assign(stall.id, null);
                onClose();
              }}
            >
              Empty the box
            </button>
          )}
          <button className="btn" onClick={() => setAdding(true)}>
            <Icon name="plus" size={15} /> New profile
          </button>
          <button
            className="btn pri"
            disabled={!pick}
            onClick={() => {
              actions.assign(stall.id, pick);
              onClose();
            }}
          >
            Assign
          </button>
        </>
      }
    >
      {current && (
        <p className="small mute" style={{ marginTop: 0 }}>
          {current.name} is in this box at the moment.
        </p>
      )}
      <Field label="Horse" hint={free.length ? "Horses on the yard without a box" : "Every horse already has a box — create a new profile instead"}>
        <select className="sel" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Choose a horse…</option>
          {free.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.colour} {a.sex}
            </option>
          ))}
        </select>
      </Field>
    </Modal>
  );
}

/* A box is not always "Stall 4" — plenty of yards name them. */
function StallName({ stall, onRename }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      <ScrollName className="nm-slot strong">{stall.name}</ScrollName>
      {onRename && (
        <button
          className="icon-btn sm rename"
          title={`Rename ${stall.name}`}
          onClick={() => onRename({ kind: "stall", id: stall.id, name: stall.name })}
        >
          <Icon name="edit" size={13} />
        </button>
      )}
    </div>
  );
}

function RenameModal({ target, onClose, onSave }) {
  const [name, setName] = useState(target.name);
  const save = () => name.trim() && onSave(name.trim());
  return (
    <Modal
      title={target.kind === "barn" ? "Rename barn" : "Rename box"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn pri" disabled={!name.trim()} onClick={save}>
            Save
          </button>
        </>
      }
    >
      <Field
        label={target.kind === "barn" ? "Barn name" : "Box name"}
        hint={
          target.kind === "barn"
            ? "Use the name on the building rather than a number."
            : "Yards often name boxes after the horse's owner, a sponsor or the end of the barn."
        }
      >
        <input
          className="inp"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
      </Field>
    </Modal>
  );
}

/* ------------------------------ barn settings ------------------------------ */

/** Everything about the building in one place, rather than a pencil here and a
    button on another tab. */
function BarnSettings({ barn, onClose, onEditLayout }) {
  const { actions } = useWorld();
  const [name, setName] = useState(barn.name);
  const [confirm, setConfirm] = useState(false);

  const save = () => {
    if (name.trim() && name.trim() !== barn.name) actions.renameBarn(barn.id, name.trim());
    onClose();
  };

  return (
    <Modal
      title={`${barn.name} settings`}
      onClose={onClose}
      footer={
        <>
          <button className="btn danger" style={{ marginRight: "auto" }} onClick={() => setConfirm(true)}>
            <Icon name="trash" size={14} /> Delete barn
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
        <Field label="Barn name" hint="Use the name on the building rather than a number.">
          <input className="inp" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="Layout" hint={barn.configured ? `${barn.cols}×${barn.rows} grid` : "Not laid out yet"}>
          <button className="btn" onClick={onEditLayout}>
            <Icon name="grid" size={15} /> {barn.configured ? "Edit the barn layout" : "Set up the layout"}
          </button>
        </Field>

        {confirm && (
          <div className="rec" style={{ background: "#fef4f4", borderColor: "#f2cccc" }}>
            <div className="rec-hd" style={{ color: "#a92c2c" }}>Delete this barn</div>
            <p>
              Every box in {barn.name} stops being monitored and its horses lose their box. This cannot be undone.
            </p>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn sm" onClick={() => setConfirm(false)}>
                Keep it
              </button>
              <button
                className="btn sm danger"
                onClick={() => {
                  actions.removeBarn(barn.id);
                  onClose();
                  go("barns");
                }}
              >
                Delete {barn.name}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
