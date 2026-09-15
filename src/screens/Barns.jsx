/* Yard → Barns: every building at a glance, configured or not. */

import { useState } from "react";
import Icon from "../components/Icons";
import { Card, Field, Modal, Pill } from "../components/ui";
import { WelfareRing } from "../components/Welfare";
import { airStatus, tempStatus, waterStatus, worstTone } from "../lib/status";
import { useWorld } from "../lib/store";
import { go } from "../lib/router";

export default function Barns({ snap }) {
  const { world, actions } = useWorld();
  const s = world.settings;
  const [naming, setNaming] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [name, setName] = useState(`Barn ${world.barns.length + 1}`);
  const yard = world.yards[0];

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>{yard?.name || "Yard"}</h1>
          <div className="sub">
            {snap.counts.configured} of {world.barns.length} barns laid out · {snap.counts.occupied} of {snap.counts.stalls} boxes occupied
          </div>
        </div>
        <div className="hd-actions">
          <button
            className="btn pri"
            onClick={() => {
              setName(`Barn ${world.barns.length + 1}`);
              setNaming(true);
            }}
          >
            <Icon name="plus" size={15} /> Add barn
          </button>
        </div>
      </div>

      <div className="barn-cards">
        {snap.rolls.map((r) => {
          const b = r.barn;
          const alerts = r.alerts.filter((a) => a.severity !== "info").length;
          // the barn's own welfare average, from the horses standing in it
          const mine = (snap.welfare?.scored || []).filter((x) => x.stall.barnId === b.id);
          const welfare = mine.length
            ? { score: Math.round(mine.reduce((a, x) => a + x.welfare.score, 0) / mine.length) }
            : null;
          const water = waterStatus(r.occupied ? { pctOfGoal: r.pctOfGoal, goal: s.intakeGoal, offline: false } : null, s);
          const temp = tempStatus(r.occupied ? r.tempC : null, s);
          const air = airStatus(r.occupied ? r.air : null, s);
          // averages hide individual horses, so the tile also takes the colour of
          // the worst thing open in the barn — a green bar over seven alerts lies
          const alertTone = alerts && r.worst ? (r.worst.severity === "info" ? "good" : r.worst.severity) : "good";
          const tone = r.occupied ? worstTone(water.tone, temp.tone, air.tone, alertTone) : "flat";

          return (
            <div key={b.id} className={`barn-card ${b.configured ? "" : "empty-state"} ${tone}`}>
              <header className="bc-hd">
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <h3>{b.name}</h3>
                    <button
                      className="icon-btn sm"
                      title="Rename this barn"
                      onClick={() => setRenaming({ id: b.id, name: b.name })}
                    >
                      <Icon name="edit" size={14} />
                    </button>
                  </div>
                  <div className="bc-sub">
                    {b.configured ? (
                      <>
                        {r.occupied} of {r.stalls.length} boxes occupied
                        {b.cols ? ` · ${b.cols}×${b.rows} grid` : ""}
                      </>
                    ) : (
                      "No layout yet"
                    )}
                  </div>
                </div>
                {b.configured && welfare ? (
                  <WelfareRing welfare={{ ...welfare, band: bandFor(welfare.score) }} size={58} showLabel={false} />
                ) : null}
              </header>

              {b.configured ? (
                <>
                  <div className="bc-occ" title={`${r.occupied} of ${r.stalls.length} boxes occupied`}>
                    <span style={{ width: `${r.stalls.length ? (r.occupied / r.stalls.length) * 100 : 0}%` }} />
                  </div>

                  {r.occupied > 0 ? (
                    <div className="bc-stats">
                      <Stat icon="water" label="Water" value={`${r.pctOfGoal}%`} st={water} />
                      <Stat icon="temp" label="Temperature" value={`${r.tempC}°C`} st={temp} />
                      <Stat icon="air" label="Air" value={`${r.air}%`} st={air} />
                    </div>
                  ) : (
                    <div className="bc-empty small mute">Laid out, but no horses assigned yet.</div>
                  )}

                  <div className="bc-ft">
                    <Pill tone={alerts ? r.worst?.severity || "warning" : "good"}>
                      {alerts ? `${alerts} open` : "All clear"}
                    </Pill>
                    <div className="row" style={{ gap: 6, marginLeft: "auto" }}>
                      <button className="btn sm" onClick={() => go(`barn/${b.id}`)}>
                        <Icon name="grid" size={14} /> Open
                      </button>
                      <button className="icon-btn" title="Barn alerts" onClick={() => go(`alerts?barn=${b.id}`)}>
                        <Icon name="bell" size={16} />
                      </button>
                      <button className="icon-btn" title="Cameras" onClick={() => go(`video?barn=${b.id}`)}>
                        <Icon name="video" size={16} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bc-setup">
                  <div className="small mute" style={{ lineHeight: 1.6, marginBottom: 12 }}>
                    Nothing in this building is monitored until the boxes are placed.
                  </div>
                  <button className="btn pri sm" onClick={() => go(`barn/${b.id}?t=layout`)}>
                    <Icon name="edit" size={14} /> Set up layout
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Card title="How a barn is set up" style={{ marginTop: 18 }}>
        <ol className="small mute" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Open a barn and paint its grid so the plan matches the building — boxes, aisle, tack and feed rooms.</li>
          <li>Each box becomes a monitored stall: flow meter, temperature and air quality probe, and one AI camera.</li>
          <li>Assign a horse to each box. The camera learns it, and follows it if it is moved.</li>
        </ol>
      </Card>

      {renaming && (
        <Modal
          title="Rename barn"
          onClose={() => setRenaming(null)}
          footer={
            <>
              <button className="btn" onClick={() => setRenaming(null)}>
                Cancel
              </button>
              <button
                className="btn pri"
                onClick={() => {
                  if (renaming.name.trim()) actions.renameBarn(renaming.id, renaming.name.trim());
                  setRenaming(null);
                }}
              >
                Save
              </button>
            </>
          }
        >
          <Field label="Barn name" hint="Yards rarely call them Barn 1 — use the name on the building.">
            <input
              className="inp"
              autoFocus
              value={renaming.name}
              onChange={(e) => setRenaming((r) => ({ ...r, name: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && renaming.name.trim()) {
                  actions.renameBarn(renaming.id, renaming.name.trim());
                  setRenaming(null);
                }
              }}
            />
          </Field>
        </Modal>
      )}

      {naming && (
        <Modal
          title="Add a barn"
          onClose={() => setNaming(false)}
          footer={
            <>
              <button className="btn" onClick={() => setNaming(false)}>
                Cancel
              </button>
              <button
                className="btn pri"
                onClick={() => {
                  const id = actions.addBarn(name.trim() || `Barn ${world.barns.length + 1}`);
                  setNaming(false);
                  go(`barn/${id}?t=layout`);
                }}
              >
                Create and lay out
              </button>
            </>
          }
        >
          <Field label="Barn name">
            <input className="inp" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </Modal>
      )}
    </>
  );
}

/* One reading, with the word that goes with it — the number on its own does
   not tell a yard whether to do anything. */
function Stat({ icon, label, value, st }) {
  return (
    <div className={`bc-stat ${st.tone}`} title={st.hint}>
      <div className="bc-stat-hd">
        <Icon name={icon} size={13} />
        <span>{label}</span>
      </div>
      <div className="bc-stat-v nums">{value}</div>
      <div className="bc-stat-l">{st.label}</div>
    </div>
  );
}

const bandFor = (score) =>
  score >= 85
    ? { tone: "good", label: "Settled" }
    : score >= 70
    ? { tone: "warning", label: "Watch" }
    : score >= 55
    ? { tone: "serious", label: "Needs attention" }
    : { tone: "critical", label: "Urgent" };
