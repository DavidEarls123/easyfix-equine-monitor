/* Yard → Animals: every profile on the yard, and how each one is doing today. */

import { useMemo, useState } from "react";
import Icon from "../components/Icons";
import { Card, Coat, Empty, Field, Modal, Pill, Tabs } from "../components/ui";
import AddAnimal from "./AddAnimal";
import { useWorld } from "../lib/store";
import { airStatus, tempStatus, waterStatus } from "../lib/status";
import Silks from "../components/Silks";
import { go } from "../lib/router";
import { ageOf } from "../lib/registry";

const TABS = [
  { id: "occupied", label: "Occupied", icon: "barn" },
  { id: "all", label: "All profiles", icon: "head" },
  { id: "free", label: "Without a box", icon: "nobox" },
];

export default function Animals({ snap }) {
  const { world, now } = useWorld();
  const [tab, setTab] = useState("occupied");
  const [barn, setBarn] = useState("all");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [noting, setNoting] = useState(null);
  const s = world.settings;

  const rows = useMemo(() => {
    const live = snap.rolls.flatMap((r) => (barn === "all" || r.barn.id === barn ? r.states.filter((x) => x.animal) : []));
    const assigned = new Set(live.map((x) => x.animal.id));
    let list =
      tab === "occupied"
        ? live
        : tab === "free"
        ? world.animals.filter((a) => !world.stalls.some((st) => st.animalId === a.id)).map((a) => ({ animal: a, stall: null }))
        : world.animals.map((a) => live.find((x) => x.animal.id === a.id) || { animal: a, stall: null });
    if (tab === "all" && barn !== "all") list = list.filter((x) => x.stall && x.stall.barnId === barn);
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((x) => x.animal.name.toLowerCase().includes(needle));
    return list.sort((a, b) => a.animal.name.localeCompare(b.animal.name));
  }, [snap, world, tab, barn, q]);

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Animals</h1>
          <div className="sub">
            {world.animals.length} profiles · {snap.counts.occupied} in a box
          </div>
        </div>
        <div className="hd-actions">
          <input className="inp" style={{ width: 200 }} placeholder="Filter by name" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="sel" style={{ width: "auto" }} value={barn} onChange={(e) => setBarn(e.target.value)}>
            <option value="all">All barns</option>
            {world.barns
              .filter((b) => b.configured)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
          <button className="btn pri" onClick={() => setAdding(true)}>
            <Icon name="plus" size={15} /> Add horse
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Tabs items={TABS} value={tab} onChange={setTab} />
      </div>

      <Card pad={false} style={{ padding: "6px 14px 14px" }}>
        {rows.length === 0 ? (
          <Empty icon="head">No horses here yet.</Empty>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Sex</th>
                  <th>Stall</th>
                  <th className="col-silks">Colours</th>
                  <th>Water</th>
                  <th>Temp</th>
                  <th>Air</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ animal, stall, today: t }) => {
                  const barnName = stall ? world.barns.find((b) => b.id === stall.barnId)?.name : null;
                  return (
                    <tr key={animal.id}>
                      <td>
                        <div className="row" style={{ gap: 9 }}>
                          <Coat animal={animal} size={28} />
                          <button className="lnk" onClick={() => go(`animal/${animal.id}`)}>
                            {animal.name}
                          </button>
                        </div>
                      </td>
                      <td className="nums">{ageOf(animal.foaled, now) ?? "—"}</td>
                      <td>{animal.sex}</td>
                      <td className="small">
                        {stall ? (
                          <button className="lnk" onClick={() => go(`barn/${stall.barnId}`)}>
                            {barnName} · {stall.name}
                          </button>
                        ) : (
                          <Pill tone="flat">Unassigned</Pill>
                        )}
                      </td>
                      <td className="col-silks">
                        <span className="silks-cell">
                          <Silks animal={animal} size={28} />
                        </span>
                      </td>
                      <td className="nums">
                        {t ? (
                          <Pill tone={waterStatus(t, s).tone} title={waterStatus(t, s).hint}>
                            {t.offline ? "No data" : `${t.intakeL} L`}
                          </Pill>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="nums">
                        {t?.tempNow == null ? (
                          "—"
                        ) : (
                          <Pill tone={tempStatus(t.tempNow, s).tone} title={tempStatus(t.tempNow, s).hint}>
                            {t.tempNow}°C
                          </Pill>
                        )}
                      </td>
                      <td className="nums">
                        {t ? (
                          <Pill tone={airStatus(t.airNow, s, t.nh3Now).tone} title={airStatus(t.airNow, s, t.nh3Now).hint}>
                            {t.airNow}%
                          </Pill>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6, justifyContent: "center" }}>
                          <button className="icon-btn" title="Add a note" onClick={() => setNoting(animal)}>
                            <Icon name="note" size={16} />
                          </button>
                          <button
                            className="icon-btn"
                            title="Camera"
                            disabled={!stall}
                            onClick={() => stall && go(`video/${stall.id}`)}
                          >
                            <Icon name="video" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {adding && <AddAnimal onClose={() => setAdding(false)} />}
      {noting && <NoteModal animal={noting} onClose={() => setNoting(null)} />}
    </>
  );
}

export function NoteModal({ animal, onClose }) {
  const { actions } = useWorld();
  const [text, setText] = useState("");
  return (
    <Modal
      title={`Note on ${animal.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn pri"
            disabled={!text.trim()}
            onClick={() => {
              actions.addNote(animal.id, text.trim());
              onClose();
            }}
          >
            Save note
          </button>
        </>
      }
    >
      <Field label="Note" hint="Kept on the horse's record with a timestamp">
        <textarea className="ta" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Vet out Tuesday, off fore. Trotted up sound." />
      </Field>
    </Modal>
  );
}
