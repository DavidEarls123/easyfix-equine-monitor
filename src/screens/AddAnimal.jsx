/* ==========================================================================
   Creating a profile.

   The yard should not be typing a passport in by hand: search the studbook
   index, import the record, set the water goal and drop the horse into a box.
   Manual entry is the fallback for anything the index does not hold.
   ========================================================================== */

import { useMemo, useState } from "react";
import Icon from "../components/Icons";
import { Coat, Field, Modal, Pill } from "../components/ui";
import { REGISTRY_SOURCE, ageOf, searchRegistry } from "../lib/registry";
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

  const hits = useMemo(() => searchRegistry(q), [q]);
  const taken = new Set(world.animals.map((a) => a.name.toLowerCase()));

  const free = world.stalls
    .filter((s) => !s.animalId)
    .map((s) => ({ ...s, barn: world.barns.find((b) => b.id === s.barnId) }))
    .filter((s) => s.barn?.configured)
    .sort((a, b) => a.barn.name.localeCompare(b.barn.name) || a.index - b.index);

  const set = (k, v) => setRec((r) => ({ ...r, [k]: v }));

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
          <Field label="Search the passport index" hint={`Name, microchip, sire or dam · source: ${REGISTRY_SOURCE}`}>
            <input className="inp" autoFocus placeholder="e.g. Ndaawi, Walk In The Park, 985…" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          <div style={{ marginTop: 12, maxHeight: 330, overflowY: "auto" }}>
            {q.trim().length < 2 && <div className="small mute">Start typing to search {REGISTRY_SOURCE.split("(")[0].trim()}.</div>}
            {q.trim().length >= 2 && hits.length === 0 && (
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

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Name">
              <input className="inp" value={rec.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Foaled">
              <input className="inp" type="date" value={rec.foaled} onChange={(e) => set("foaled", e.target.value)} />
            </Field>
            <Field label="Sex">
              <select className="sel" value={rec.sex} onChange={(e) => set("sex", e.target.value)}>
                {["Gelding", "Mare", "Stallion", "Colt", "Filly"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Colour">
              <select className="sel" value={rec.colour} onChange={(e) => set("colour", e.target.value)}>
                {["Bay", "Dark Bay", "Brown", "Chestnut", "Grey", "Black"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Microchip">
              <input className="inp" value={rec.microchip} onChange={(e) => set("microchip", e.target.value)} />
            </Field>
            <Field label="Trainer / handler">
              <input className="inp" value={rec.trainer} onChange={(e) => set("trainer", e.target.value)} />
            </Field>
            <Field label="Daily water goal" hint="Used for the intake alerts">
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
