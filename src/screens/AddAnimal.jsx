/* ==========================================================================
   Creating a profile.

   The yard should not be typing a passport in by hand: search the studbook
   index, import the record, set the water goal and drop the horse into a box.
   Manual entry is the fallback for anything the index does not hold.
   ========================================================================== */

import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icons";
import { Coat, Field, Modal, Pill } from "../components/ui";
import Silks, { SILKS_LIST, silksForOwner } from "../components/Silks";
import { COLOURS, colourOf } from "../lib/colours";
import { ageOf } from "../lib/registry";
import { DEFAULT_PASSPORT, searchPassports, sourceLabel } from "../lib/passport";
import { animalFromRecord } from "../lib/world";
import { useWorld } from "../lib/store";
import { go } from "../lib/router";

const BLANK = {
  id: "manual",
  name: "",
  sex: "Gelding",
  colour: "Bay",
  foaled: "",
  breed: "Thoroughbred",
  sire: "",
  dam: "",
  damSire: "",
  owner: "",
  trainer: "",
  breeder: "",
  markings: "",
  microchip: "",
  ueln: "",
  height: "",
  source: "Entered by hand",
  groom: "",
  silks: null,
};

export default function AddAnimal({ onClose, presetStallId }) {
  const { world, actions, now } = useWorld();
  const [step, setStep] = useState(1);
  const [q, setQ] = useState("");
  const [rec, setRec] = useState(null);
  const [manual, setManual] = useState(false);
  const [goal, setGoal] = useState(world.settings.intakeGoal);
  const [stallId, setStallId] = useState(presetStallId || "");
  const [note, setNote] = useState("");

  const cfg = { ...DEFAULT_PASSPORT, ...(world.settings.passport || {}) };
  const source = sourceLabel(cfg);
  const [hits, setHits] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const seq = useRef(0);

  // a live provider is a network call, so the search is debounced and the
  // response is dropped if a newer keystroke has already gone out
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      setErr(null);
      setBusy(false);
      return;
    }
    const mine = ++seq.current;
    setBusy(true);
    const timer = setTimeout(async () => {
      try {
        const { records, warning } = await searchPassports(query, cfg);
        if (seq.current !== mine) return;
        setHits(records.map((r) => ({ ...r, silks: r.silks || silksForOwner(r.owner)?.id || null })));
        // a fallback is not an error, but the operator should know the names
        // in front of them did not come from the provider they configured
        setErr(warning ? `${warning} Showing the simulated index instead.` : null);
      } catch (e) {
        if (seq.current !== mine) return;
        setHits([]);
        setErr(e.message || "Lookup failed");
      } finally {
        if (seq.current === mine) setBusy(false);
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [q, world.settings.passport]);

  const taken = new Set(world.animals.map((a) => a.name.toLowerCase()));

  const free = world.stalls
    .filter((s) => !s.animalId)
    .map((s) => ({ ...s, barn: world.barns.find((b) => b.id === s.barnId) }))
    .filter((s) => s.barn?.configured)
    .sort((a, b) => a.barn.name.localeCompare(b.barn.name) || a.index - b.index);

  const set = (k, v) => setRec((r) => ({ ...r, [k]: v }));
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
    const animal = animalFromRecord(rec, { goalL: Number(goal) || 35 });
    if (note.trim()) animal.notes = [{ at: Date.now(), text: note.trim() }];
    actions.addAnimal(animal, stallId || null);
    onClose();
    go(`animal/${animal.id}`);
  };

  return (
    <Modal
      title={step === 1 ? "Add a horse" : `Set up ${rec?.name || "profile"}`}
      onClose={onClose}
      wide={step === 1}
      footer={
        step === 1 ? (
          <>
            <button
              className="btn"
              onClick={() => {
                setRec({ ...BLANK, name: q });
                setManual(true);
                setStep(2);
              }}
            >
              Enter by hand
            </button>
            <button className="btn pri" disabled={!rec} onClick={() => setStep(2)}>
              Continue
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="btn pri" disabled={!rec?.name.trim()} onClick={save}>
              <Icon name="check" size={15} /> Create profile
            </button>
          </>
        )
      }
    >
      {step === 1 ? (
        <>
          <Field label="Search the passport index" hint={`Name, microchip, sire or dam · source: ${source}`}>
            <input className="inp" autoFocus placeholder="e.g. Ndaawi, Walk In The Park, 985…" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          <div style={{ marginTop: 12, maxHeight: 330, overflowY: "auto" }}>
            {q.trim().length < 2 && <div className="small mute">Start typing to search {source.split("(")[0].trim()}.</div>}
            {busy && <div className="small mute">Searching {source.split("(")[0].trim()}…</div>}
            {err && (
              <div className="small" style={{ color: "#a92c2c", lineHeight: 1.6 }}>
                {err}
                <div className="hint" style={{ marginTop: 4 }}>
                  Settings → Passport database, or enter the horse by hand below.
                </div>
              </div>
            )}
            {!busy && !err && q.trim().length >= 2 && hits.length === 0 && (
              <div className="small mute">No match. You can still enter the horse by hand.</div>
            )}
            {hits.map((r) => {
              const already = taken.has(r.name.toLowerCase());
              return (
                <button
                  key={r.id}
                  className="alert-row"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    cursor: already ? "not-allowed" : "pointer",
                    opacity: already ? 0.5 : 1,
                    borderColor: rec?.id === r.id ? "var(--blue)" : undefined,
                  }}
                  disabled={already}
                  onClick={() => setRec(r)}
                >
                  <Coat animal={r} size={34} />
                  <div className="grow">
                    <div className="row" style={{ gap: 8 }}>
                      <b>{r.name}</b>
                      <Pill tone="flat">
                        {r.sex} · {ageOf(r.foaled, now)} yo
                      </Pill>
                      {already && <Pill tone="warning">Already on the yard</Pill>}
                    </div>
                    <div className="why">
                      {r.colour} {r.breed} · {r.sire} × {r.dam} ({r.damSire}) · chip {r.microchip}
                    </div>
                  </div>
                  {rec?.id === r.id && <Icon name="check" size={18} style={{ color: "var(--blue)" }} />}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          {!manual && (
            <div className="row" style={{ gap: 10 }}>
              <Coat animal={rec} size={44} />
              <div>
                <b style={{ fontSize: 16 }}>{rec.name}</b>
                <div className="small mute">
                  Imported from {rec.source} · passport {rec.id}
                </div>
              </div>
            </div>
          )}

          {/* the same set the profile edit asks for, so a horse added by hand
              reaches the box front with everything the screen needs */}
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label={onScreen("Name")}>
              <input className="inp" value={rec.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label={onScreen("Age")} hint="From the foaling date">
              <input className="inp" type="date" value={rec.foaled || ""} onChange={(e) => set("foaled", e.target.value)} />
            </Field>
            <Field label={onScreen("Sex")}>
              <select className="sel" value={rec.sex} onChange={(e) => set("sex", e.target.value)}>
                {["Gelding", "Mare", "Filly", "Colt", "Stallion", "Rig"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label={onScreen("Type")} hint={colourOf(rec.colour).hint}>
              <select className="sel" value={rec.colour || "Bay"} onChange={(e) => set("colour", e.target.value)}>
                {COLOURS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={onScreen("Sire")}>
              <input className="inp" value={rec.sire || ""} onChange={(e) => set("sire", e.target.value)} />
            </Field>
            <Field label={onScreen("Dam")}>
              <input className="inp" value={rec.dam || ""} onChange={(e) => set("dam", e.target.value)} />
            </Field>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label={onScreen("Owner")}>
              <input className="inp" value={rec.owner || ""} onChange={(e) => set("owner", e.target.value)} />
            </Field>
            <Field label={onScreen("Groom")} hint="Whoever will do this box">
              <input className="inp" list="add-groom-list" value={rec.groom || ""} onChange={(e) => set("groom", e.target.value)} />
              <datalist id="add-groom-list">
                {grooms.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Trainer / handler">
              <input className="inp" value={rec.trainer || ""} onChange={(e) => set("trainer", e.target.value)} />
            </Field>
          </div>

          <Field label={onScreen("Colours")} hint="The owner's registered racing colours.">
            <SilksPicker value={rec.silks} owner={rec.owner} onChange={(v) => set("silks", v)} />
          </Field>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label="Microchip">
              <input className="inp" value={rec.microchip || ""} onChange={(e) => set("microchip", e.target.value)} />
            </Field>
            <Field label="Daily water goal" hint="Until the app has learned this horse">
              <div className="row" style={{ gap: 8 }}>
                <input className="inp nums" type="number" min="10" max="80" value={goal} onChange={(e) => setGoal(e.target.value)} />
                <span className="small mute">litres</span>
              </div>
            </Field>
            <Field label="Stall" hint={free.length ? `${free.length} free boxes` : "No free boxes — lay out a barn first"}>
              <select className="sel" value={stallId} onChange={(e) => setStallId(e.target.value)}>
                <option value="">Leave unassigned</option>
                {free.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.barn.name} · {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Opening note" hint="Optional — anything the yard should know">
            <textarea className="ta" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Slow to settle in a new box, prefers a full haynet overnight." />
          </Field>

          <div className="alert-row good" style={{ marginBottom: 0 }}>
            <span className="ico good">
              <Icon name="id" size={16} />
            </span>
            <div>
              <div className="ttl">The camera will learn this horse</div>
              <div className="why">
                Once assigned, the AI camera builds an identity profile from the first few hours of footage. If the horse is moved to
                another box it is recognised there and the app raises an identity mismatch.
              </div>
            </div>
          </div>
        </div>
      )}
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
        <button type="button" className={`silks-opt ${!value ? "on" : ""}`} onClick={() => onChange(null)}>
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
