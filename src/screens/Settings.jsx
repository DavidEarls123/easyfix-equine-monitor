/* Thresholds, camera behaviour, who gets told — and the demo controls that let
   the same build stand in for an eight-box yard or a three-hundred-box one. */

import { useState } from "react";
import Icon from "../components/Icons";
import { Card, Field, Modal, Switch } from "../components/ui";
import { useWorld } from "../lib/store";
import { bigYard } from "../lib/world";

export default function Settings({ snap }) {
  const { world, actions, say } = useWorld();
  const s = world.settings;
  const [confirm, setConfirm] = useState(null);

  const num = (key, label, hint, min, max, step = 1) => (
    <Field label={label} hint={hint}>
      <input
        className="inp nums"
        type="number"
        min={min}
        max={max}
        step={step}
        value={s[key]}
        onChange={(e) => actions.setSettings({ [key]: Number(e.target.value) })}
      />
    </Field>
  );

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(world, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "easyfix-equine-yard.json";
    a.click();
    URL.revokeObjectURL(a.href);
    say("Yard exported");
  };

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Settings</h1>
          <div className="sub">Thresholds drive every alert and recommendation in the app</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
        <Card title="Yard">
          <div className="grid" style={{ gap: 12 }}>
            <Field label="Yard name">
              <input className="inp" value={world.yards[0]?.name || ""} onChange={(e) => actions.renameYard(world.yards[0].id, e.target.value)} />
            </Field>
            <Field label="Operator">
              <input className="inp" value={s.operator} onChange={(e) => actions.setSettings({ operator: e.target.value })} />
            </Field>
            <Field label="Contact email">
              <input className="inp" value={s.email} onChange={(e) => actions.setSettings({ email: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="Water" sub="Intake alerts are measured against each horse's own goal">
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {num("intakeGoal", "Default daily goal (L)", "Used for new profiles", 10, 80)}
            {num("intakeLowPct", "Low intake at (%)", "Of the pace for the day", 30, 100)}
            {num("noDrinkHours", "No drinking event after (h)", "Raises an attention alert", 2, 12)}
          </div>
        </Card>

        <Card title="Stall climate">
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {num("tempMin", "Comfort floor (°C)", null, -10, 20)}
            {num("tempMax", "Comfort ceiling (°C)", null, 10, 40)}
            {num("airMin", "Air quality target (%)", "Below this is flagged", 40, 100)}
            {num("nh3Max", "Ammonia limit (ppm)", null, 2, 30)}
            {num("humidityMax", "Humidity ceiling (%)", null, 50, 100)}
          </div>
        </Card>

        <Card title="AI camera">
          <div className="grid" style={{ gap: 12 }}>
            <Switch on={s.camera.identify} label="Identify horses and flag mismatches" onChange={(v) => actions.setSettings({ camera: { ...s.camera, identify: v } })} />
            <Switch on={s.camera.behaviour} label="Behaviour alerts (colic, lameness, box walking)" onChange={(v) => actions.setSettings({ camera: { ...s.camera, behaviour: v } })} />
            <Field label="Minimum confidence to act (%)">
              <input
                className="inp nums"
                type="number"
                min="60"
                max="99"
                value={s.camera.minConfidence}
                onChange={(e) => actions.setSettings({ camera: { ...s.camera, minConfidence: Number(e.target.value) } })}
              />
            </Field>
            <Field label="Footage retention (days)">
              <input
                className="inp nums"
                type="number"
                min="1"
                max="90"
                value={s.camera.retentionDays}
                onChange={(e) => actions.setSettings({ camera: { ...s.camera, retentionDays: Number(e.target.value) } })}
              />
            </Field>
          </div>
        </Card>

        <Card title="Who gets told">
          <div className="grid" style={{ gap: 12 }}>
            <Switch on={s.notify.push} label="Push to the yard phones" onChange={(v) => actions.setSettings({ notify: { ...s.notify, push: v } })} />
            <Switch on={s.notify.email} label="Email the daily summary" onChange={(v) => actions.setSettings({ notify: { ...s.notify, email: v } })} />
            <Switch on={s.notify.sms} label="SMS for critical only" onChange={(v) => actions.setSettings({ notify: { ...s.notify, sms: v } })} />
            <div className="row" style={{ gap: 10 }}>
              <Field label="Quiet from">
                <input
                  className="inp nums"
                  type="number"
                  min="0"
                  max="23"
                  value={s.notify.quietFrom}
                  onChange={(e) => actions.setSettings({ notify: { ...s.notify, quietFrom: Number(e.target.value) } })}
                />
              </Field>
              <Field label="Quiet until">
                <input
                  className="inp nums"
                  type="number"
                  min="0"
                  max="23"
                  value={s.notify.quietTo}
                  onChange={(e) => actions.setSettings({ notify: { ...s.notify, quietTo: Number(e.target.value) } })}
                />
              </Field>
            </div>
            <div className="hint">Critical alerts always go through, quiet hours or not.</div>
          </div>
        </Card>

        <Card title="Demo data" sub="This build simulates its sensors — nothing here is real hardware">
          <div className="small mute" style={{ lineHeight: 1.7, marginBottom: 12 }}>
            {snap.counts.stalls} boxes across {snap.counts.barns} barns, {snap.counts.animals} profiles. Readings are generated from each
            box's seed, so the history is the same on every reload.
          </div>
          <div className="row">
            <button className="btn" onClick={exportJson}>
              <Icon name="download" size={15} /> Export yard
            </button>
            <button className="btn" onClick={() => setConfirm("big")}>
              <Icon name="barn" size={15} /> Add a 300-box yard
            </button>
            <button className="btn danger" onClick={() => setConfirm("reset")}>
              <Icon name="refresh" size={15} /> Reset the demo
            </button>
          </div>
        </Card>
      </div>

      {confirm && (
        <Modal
          title={confirm === "big" ? "Add ten barns of thirty boxes" : "Reset the demo yard"}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn pri"
                onClick={() => {
                  if (confirm === "big") {
                    actions.replace(bigYard(world, 10, 30));
                    say("300 boxes added");
                  } else actions.reset();
                  setConfirm(null);
                }}
              >
                {confirm === "big" ? "Add them" : "Reset"}
              </button>
            </>
          }
        >
          <p className="small" style={{ marginTop: 0, lineHeight: 1.7 }}>
            {confirm === "big"
              ? "Adds ten more barns with thirty monitored boxes each, filled from the passport index — the scale a large customer runs at. Tables page, and the camera wall loads in batches."
              : "Puts the yard back to the eight named horses in Barn 1, the two filled barns behind it, and the six that still need laying out. Anything you have changed is lost."}
          </p>
        </Modal>
      )}
    </>
  );
}
