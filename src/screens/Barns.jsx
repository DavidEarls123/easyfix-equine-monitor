/* Yard → Barns: every building at a glance, configured or not. */

import { useState } from "react";
import Icon from "../components/Icons";
import { Card, Field, Modal, Pill } from "../components/ui";
import { useWorld } from "../lib/store";
import { go } from "../lib/router";

export default function Barns({ snap }) {
  const { world, actions } = useWorld();
  const [naming, setNaming] = useState(false);
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
          const worst = r.worst;
          const alerts = r.alerts.length;
          return (
            <div key={b.id} className={`barn-card ${b.configured ? "" : "empty-state"}`}>
              <div className="row">
                <h3>{b.name}</h3>
                <div style={{ marginLeft: "auto" }}>
                  {b.configured ? (
                    <Pill tone={alerts ? (worst?.severity === "info" ? "flat" : worst?.severity || "warning") : "good"}>
                      {alerts ? `${alerts} open` : "All clear"}
                    </Pill>
                  ) : (
                    <Pill tone="flat">Not set up</Pill>
                  )}
                </div>
              </div>

              <div className="kv">
                <span>
                  <Icon name="barn" size={13} style={{ verticalAlign: -2 }} /> Stalls:{" "}
                  <b className="nums">{b.configured ? String(r.stalls.length).padStart(2, "0") : "—"}</b>
                </span>
                <span>
                  <Icon name="check" size={13} style={{ verticalAlign: -2 }} /> Occupied:{" "}
                  <b className="nums">{b.configured ? String(r.occupied).padStart(2, "0") : "—"}</b>
                </span>
              </div>

              {b.configured && r.occupied > 0 && (
                <div className="kv" style={{ marginTop: 8 }}>
                  <span>
                    Water <b className="nums">{r.pctOfGoal}%</b>
                  </span>
                  <span>
                    Temp <b className="nums">{r.tempC}°C</b>
                  </span>
                  <span>
                    Air <b className="nums">{r.air}%</b>
                  </span>
                </div>
              )}

              <div className="acts">
                {b.configured ? (
                  <>
                    <button className="icon-btn" title="Open barn" onClick={() => go(`barn/${b.id}`)}>
                      <Icon name="grid" size={17} />
                    </button>
                    <button className="icon-btn" title="Barn alerts" onClick={() => go(`alerts?barn=${b.id}`)}>
                      <Icon name="bell" size={17} />
                    </button>
                    <button className="icon-btn" title="Cameras" onClick={() => go(`video?barn=${b.id}`)}>
                      <Icon name="video" size={17} />
                    </button>
                    <span className="tiny mute" style={{ marginLeft: "auto" }}>
                      {b.cols}×{b.rows} grid
                    </span>
                  </>
                ) : (
                  <button className="btn pri sm" onClick={() => go(`barn/${b.id}?t=layout`)}>
                    <Icon name="edit" size={14} /> Set up layout
                  </button>
                )}
              </div>
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
