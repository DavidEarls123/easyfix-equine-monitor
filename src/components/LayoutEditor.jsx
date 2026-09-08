/* ==========================================================================
   Barn layout editor.

   A barn is a grid: paint boxes, aisles and service rooms until the grid looks
   like the building. Stalls are numbered down the grid in reading order, and
   any box that already has a horse in it is called out before it is removed.
   ========================================================================== */

import { useEffect, useMemo, useState } from "react";
import Icon from "./Icons";
import { Field, Pill } from "./ui";
import { CELL, makeLayout } from "../lib/world";

const KINDS = ["stall", "aisle", "door", "tack", "wash", "feed", "empty"];
const MAXC = 24;
const MAXR = 8;

const keyOf = (r, c) => `${r}:${c}`;

export default function LayoutEditor({ barn, stalls, animals, onSave, onCancel }) {
  const [cols, setCols] = useState(Math.max(4, barn.cols || 6));
  const [rows, setRows] = useState(Math.max(3, barn.rows || 3));
  const [paint, setPaint] = useState("stall");
  const [cells, setCells] = useState(() => {
    const m = new Map();
    (barn.cells || []).forEach((c) => m.set(keyOf(c.r, c.c), c.kind));
    return m;
  });
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    const up = () => setDrag(false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const kindAt = (r, c) => cells.get(keyOf(r, c)) || "empty";
  const put = (r, c) =>
    setCells((m) => {
      const next = new Map(m);
      next.set(keyOf(r, c), paint);
      return next;
    });

  const list = useMemo(() => {
    const out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ r, c, kind: kindAt(r, c) });
    return out;
  }, [rows, cols, cells]);

  const stallCells = list.filter((c) => c.kind === "stall");
  const numbers = new Map(stallCells.map((c, i) => [keyOf(c.r, c.c), i + 1]));

  // which occupied boxes would be lost by this layout
  const occupiedNow = stalls.filter((s) => s.animalId);
  const losing = occupiedNow.filter((s) => !(s.r < rows && s.c < cols && kindAt(s.r, s.c) === "stall"));

  const template = (kind) => {
    const count = kind === "single" ? cols - 1 : (cols - 1) * 2;
    const made = makeLayout(count);
    const m = new Map();
    made.cells.forEach((c) => m.set(keyOf(c.r, c.c), kind === "single" && c.r === 2 ? "empty" : c.kind));
    setCols(made.cols);
    setRows(made.rows);
    setCells(m);
  };

  return (
    <div>
      <div className="row" style={{ gap: 16, alignItems: "flex-end", marginBottom: 14 }}>
        <Field label="Columns">
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm" onClick={() => setCols((v) => Math.max(2, v - 1))}>
              −
            </button>
            <b className="nums" style={{ width: 22, textAlign: "center" }}>{cols}</b>
            <button className="btn sm" onClick={() => setCols((v) => Math.min(MAXC, v + 1))}>
              +
            </button>
          </div>
        </Field>
        <Field label="Rows">
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm" onClick={() => setRows((v) => Math.max(1, v - 1))}>
              −
            </button>
            <b className="nums" style={{ width: 22, textAlign: "center" }}>{rows}</b>
            <button className="btn sm" onClick={() => setRows((v) => Math.min(MAXR, v + 1))}>
              +
            </button>
          </div>
        </Field>
        <div className="grow" />
        <button className="btn sm" onClick={() => template("single")}>
          Single row
        </button>
        <button className="btn sm" onClick={() => template("double")}>
          Double row
        </button>
        <button className="btn sm" onClick={() => setCells(new Map())}>
          Clear
        </button>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <span className="small mute">Paint with:</span>
        {KINDS.map((k) => (
          <button key={k} className={`tab ${paint === k ? "on" : ""}`} style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => setPaint(k)}>
            {CELL[k].label}
          </button>
        ))}
      </div>

      <div
        className="layout-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, userSelect: "none", maxWidth: cols * 128 }}
        onMouseLeave={() => setDrag(false)}
      >
        {list.map(({ r, c, kind }) => {
          const num = numbers.get(keyOf(r, c));
          const stall = stalls.find((s) => s.r === r && s.c === c);
          const horse = stall?.animalId ? animals.find((a) => a.id === stall.animalId) : null;
          return (
            <div
              key={keyOf(r, c)}
              className={`cell ${kind} ${horse && kind === "stall" ? "occupied" : ""}`}
              onMouseDown={() => {
                setDrag(true);
                put(r, c);
              }}
              onMouseEnter={() => drag && put(r, c)}
              title={`${CELL[kind].label} — row ${r + 1}, column ${c + 1}`}
            >
              {kind === "stall" ? (
                <>
                  <span className="n">{num}</span>
                  {horse && <span className="who">{horse.name}</span>}
                </>
              ) : (
                <span className="tiny">{kind === "empty" ? "" : CELL[kind].label}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 14, gap: 10 }}>
        <Pill icon="barn">{stallCells.length} stalls</Pill>
        <span className="small mute">Click or drag to paint. Stalls number left to right, front row first.</span>
      </div>

      {losing.length > 0 && (
        <div className="alert-row warning" style={{ marginTop: 12 }}>
          <span className="ico warning">
            <Icon name="alert" size={16} />
          </span>
          <div>
            <div className="ttl">{losing.length} occupied box{losing.length > 1 ? "es" : ""} would be removed</div>
            <div className="why">
              {losing
                .map((s) => animals.find((a) => a.id === s.animalId)?.name || s.name)
                .join(", ")}{" "}
              would be left unassigned. Their profiles and history are kept.
            </div>
          </div>
        </div>
      )}

      <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn pri"
          disabled={!stallCells.length}
          onClick={() => onSave({ cols, rows, cells: list.filter((c) => c.kind !== "empty") })}
        >
          <Icon name="check" size={15} /> Save layout
        </button>
      </div>
    </div>
  );
}
