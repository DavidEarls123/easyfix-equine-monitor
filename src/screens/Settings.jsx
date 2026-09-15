/* Thresholds, camera behaviour, who gets told — and the demo controls that let
   the same build stand in for an eight-box yard or a three-hundred-box one. */

import { useState } from "react";
import Icon from "../components/Icons";
import { Card, Field, Modal, Pill, Switch } from "../components/ui";
import { WelfareRing } from "../components/Welfare";
import { COMPONENTS, DEFAULT_WEIGHTS, normalise } from "../lib/score";
import { DEFAULT_PASSPORT, PROVIDERS, testProvider } from "../lib/passport";
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

        <Card
          title="Welfare index"
          sub="How the sensors and the camera are weighted into one score per horse"
        >
          <WeightEditor snap={snap} />
        </Card>

        <Card
          title="Passport database"
          sub="Where profile creation looks a horse up, instead of typing a passport in"
        >
          <PassportEditor />
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

/* ---------------------------- the welfare weights -------------------------- */

/**
 * Weights are relative, not absolute: whatever the sliders say is normalised
 * before it is used, so the yard can pull one input up without having to take
 * the same amount off another. The effective share is shown alongside.
 */
function WeightEditor({ snap }) {
  const { world, actions, say } = useWorld();
  const weights = { ...DEFAULT_WEIGHTS, ...(world.settings.weights || {}) };
  const share = normalise(weights);

  // the yard's own numbers, rescored live as the sliders move
  const sample = snap.welfare?.average;

  const set = (key, value) =>
    actions.setSettings({ weights: { ...weights, [key]: Math.max(0, Number(value) || 0) } });

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ gap: 14, alignItems: "center" }}>
        {sample != null && (
          <WelfareRing welfare={{ score: sample, band: bandFor(sample) }} size={66} />
        )}
        <div className="small mute" style={{ lineHeight: 1.65 }}>
          One 0–100 score per horse, from every input the box has. An input with no data is dropped and the rest are
          reweighted, so a failed flow meter lowers confidence rather than the score.
          {sample != null && <> The yard is averaging <b className="nums">{sample}</b> right now.</>}
        </div>
      </div>

      {COMPONENTS.map((c) => (
        <div key={c.key}>
          <div className="row" style={{ gap: 8, marginBottom: 2 }}>
            <Icon name={c.icon} size={14} style={{ color: "var(--ink-2)" }} />
            <b style={{ fontSize: 13 }}>{c.label}</b>
            <span className="nums tiny mute" style={{ marginLeft: "auto" }}>
              weight {weights[c.key]} · <b>{Math.round(share[c.key] * 100)}%</b> of the score
            </span>
          </div>
          <input
            type="range"
            className="rng"
            min="0"
            max="40"
            step="1"
            value={weights[c.key]}
            onChange={(e) => set(c.key, e.target.value)}
            aria-label={`${c.label} weight`}
          />
          <div className="hint">{c.hint}</div>
        </div>
      ))}

      <div className="row">
        <button
          className="btn"
          onClick={() => {
            actions.setSettings({ weights: { ...DEFAULT_WEIGHTS } });
            say("Weights reset");
          }}
        >
          <Icon name="refresh" size={15} /> Reset to defaults
        </button>
        <Pill tone="flat">Set a weight to 0 to take an input out entirely</Pill>
      </div>
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

/* --------------------------- the passport provider ------------------------- */

function PassportEditor() {
  const { world, actions, say } = useWorld();
  const cfg = { ...DEFAULT_PASSPORT, ...(world.settings.passport || {}) };
  const p = PROVIDERS[cfg.provider] || PROVIDERS.simulated;
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const set = (patch) => {
    actions.setSettings({ passport: { ...cfg, ...patch } });
    setResult(null);
  };

  const run = async () => {
    setTesting(true);
    setResult(null);
    const r = await testProvider(cfg);
    setResult(r);
    setTesting(false);
    say(r.ok ? "Lookup succeeded" : "Lookup failed");
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <Field label="Provider" hint={p.blurb}>
        <select className="inp" value={cfg.provider} onChange={(e) => set({ provider: e.target.value, baseUrl: PROVIDERS[e.target.value]?.defaultUrl ?? "" })}>
          {Object.values(PROVIDERS).map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
      </Field>

      {p.needsUrl && (
        <Field
          label="Base URL"
          hint="Point this at a service of your own that holds the credential and forwards the query."
        >
          <input
            className="inp"
            placeholder="https://passports.your-yard.com/api"
            value={cfg.baseUrl}
            onChange={(e) => set({ baseUrl: e.target.value })}
          />
        </Field>
      )}

      {p.needsKey && (
        <>
          <Field label="API key" hint="Only sent when the direct-from-browser switch below is on.">
            <input
              className="inp"
              type="password"
              placeholder="held by your proxy, normally"
              value={cfg.apiKey}
              onChange={(e) => set({ apiKey: e.target.value })}
            />
          </Field>
          <Switch
            on={cfg.directBrowser}
            label="Call the provider straight from the browser"
            onChange={(v) => set({ directBrowser: v })}
          />
          {cfg.directBrowser && (
            <div className="small" style={{ color: "#a9701a", lineHeight: 1.65 }}>
              A key in a browser bundle is a published key, and most of these hosts will refuse a cross-origin request
              anyway. Use it to try a provider out, not to run a yard on.
            </div>
          )}
        </>
      )}

      <Switch
        on={cfg.fallbackToSimulated}
        label="Fall back to the simulated index if a lookup fails"
        onChange={(v) => set({ fallbackToSimulated: v })}
      />

      <div className="row" style={{ gap: 10 }}>
        <button className="btn" onClick={run} disabled={testing}>
          <Icon name="refresh" size={15} /> {testing ? "Testing…" : "Test connection"}
        </button>
        {p.docs && (
          <a className="btn ghost sm" href={p.docs} target="_blank" rel="noreferrer noopener">
            Provider docs
          </a>
        )}
      </div>

      {result && (
        <div className="small" style={{ color: result.ok ? "#0a7d0a" : "#a92c2c", lineHeight: 1.65 }}>
          {result.message}
        </div>
      )}

      <div className="hint" style={{ lineHeight: 1.7 }}>
        Racing Post has no self-serve API — its data is licensed commercially, so point <b>Custom endpoint</b> at the feed
        they give you. The Racing API is the closest subscription you can sign up for on your own.
      </div>
    </div>
  );
}
