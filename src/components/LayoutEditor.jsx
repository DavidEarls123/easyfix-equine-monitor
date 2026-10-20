/* ==========================================================================
   Barn layout editor.

   A barn is a grid: paint boxes, aisles and service rooms until the grid looks
   like the building.

   Two things it has to get right that a paint grid does not get for free.

   A box is not its position. Moving a box along the wall is a thing yards do —
   a partition comes out, a corner is rebuilt — and when they do, the horse in
   it, its name, its camera and its history are all still that box's. So a
   stall cell carries the id of the box it is, and dragging it moves the box
   rather than deleting one and creating another somewhere else.

   And not every shed is a rectangle. An L, a U or a T is drawn by leaving
   corners empty, and the screens trim to the shape that was actually drawn.
   ========================================================================== */

import { useEffect, useMemo, useState } from "react";
import Icon from "./Icons";
import { Field, Pill } from "./ui";
import { CELL, makeLayout } from "../lib/world";

const KINDS = ["stall", "aisle", "door", "tack", "wash", "feed", "empty"];
const MAXC = 24;
const MAXR = 8;

const keyOf = (r, c) => `${r}:${c}`;
const EMPTY = { kind: "empty", sid: null };

export default function LayoutEditor({ barn, stalls, animals, onSave, onCancel }) {
  const [cols, setCols] = useState(Math.max(4, barn.cols || 6));
  const [rows, setRows] = useState(Math.max(3, barn.rows || 3));
  const [paint, setPaint] = useState("stall");
  const [mode, setMode] = useState("paint"); // paint, or move boxes about
  // every cell carries the box it is, so a box keeps its identity when it moves
  const [cells, setCells] = useState(() => {
    const m = new Map();
    (barn.cells || []).forEach((c) => {
      const stall = stalls.find((s) => s.r === c.r && s.c === c.c);
      m.set(keyOf(c.r, c.c), { kind: c.kind, sid: c.sid || (c.kind === "stall" ? stall?.id || null : null) });
    });
    return m;
  });
  const [drag, setDrag] = useState(false);
  const [lift, setLift] = useState(null); // the box being carried, on a touchscreen

  useEffect(() => {
    const up = () => setDrag(false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const at = (r, c) => cells.get(keyOf(r, c)) || EMPTY;
  const put = (r, c) =>
    setCells((m) => {
      const next = new Map(m);
      // painting over a box gives the box up; painting a new one starts blank
      next.set(keyOf(r, c), { kind: paint, sid: paint === "stall" ? next.get(keyOf(r, c))?.sid ?? null : null });
      return next;
    });

  /** Move a box to another cell, swapping with whatever is already there. */
  const move = (from, to) => {
    if (!from || from === to) return;
    setCells((m) => {
      const next = new Map(m);
      const a = next.get(from) || EMPTY;
      const b = next.get(to) || EMPTY;
      next.set(to, a);
      next.set(from, b.kind === "empty" ? EMPTY : b);
      return next;
    });
    setLift(null);
  };

  const list = useMemo(() => {
    const out = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) out.push({ r, c, ...at(r, c) });
    return out;
  }, [rows, cols, cells]);

  const stallCells = list.filter((c) => c.kind === "stall");
  const numbers = new Map(stallCells.map((c, i) => [keyOf(c.r, c.c), i + 1]));

  // a box is only lost if its id is nowhere on the grid any more — moving one
  // is not losing it
  const live = new Set(stallCells.map((c) => c.sid).filter(Boolean));
  const losing = stalls.filter((s) => s.animalId && !live.has(s.id));

  /* --------------------------- shapes to start from ---------------------- */

  const shape = (kind) => {
    const m = new Map();
    const set = (r, c, k) => m.set(keyOf(r, c), { kind: k, sid: null });
    let w = cols;
    let h = rows;

    if (kind === "single" || kind === "double") {
      const made = makeLayout(kind === "single" ? cols - 1 : (cols - 1) * 2);
      made.cells.forEach((c) => set(c.r, c.c, kind === "single" && c.r === 2 ? "empty" : c.kind));
      w = made.cols;
      h = made.rows;
    } else if (kind === "L") {
      w = 10;
      h = 5;
      for (let c = 0; c < w; c++) set(0, c, "stall");
      for (let c = 0; c < w; c++) set(1, c, c === 0 ? "door" : "aisle");
      for (let r = 2; r < h; r++) {
        set(r, 0, "stall");
        set(r, 1, "aisle");
        set(r, 2, "stall");
      }
    } else if (kind === "U") {
      w = 9;
      h = 5;
      for (let c = 0; c < w; c++) set(0, c, "stall");
      for (let c = 0; c < w; c++) set(1, c, "aisle");
      for (let r = 2; r < h; r++) {
        set(r, 0, "stall");
        set(r, 1, "aisle");
        set(r, w - 2, "aisle");
        set(r, w - 1, "stall");
      }
      set(h - 1, Math.floor(w / 2), "door");
    } else if (kind === "T") {
      w = 9;
      h = 5;
      for (let c = 0; c < w; c++) set(0, c, "stall");
      for (let c = 0; c < w; c++) set(1, c, "aisle");
      const mid = Math.floor(w / 2);
      for (let r = 2; r < h; r++) {
        set(r, mid - 1, "stall");
        set(r, mid, "aisle");
        set(r, mid + 1, "stall");
      }
      set(h - 1, mid, "door");
    }
    setCols(w);
    setRows(h);
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
        <Field label="Start from a shape">
          <div className="row" style={{ gap: 6 }}>
            {[
              ["single", "Single row"],
              ["double", "Double row"],
              ["L", "L"],
              ["U", "U"],
              ["T", "T"],
            ].map(([k, label]) => (
              <button key={k} className="btn sm" onClick={() => shape(k)}>
                {label}
              </button>
            ))}
            <button className="btn sm" onClick={() => setCells(new Map())}>
              Clear
            </button>
          </div>
        </Field>
      </div>

      {/* painting the building, or moving a box that is already in it */}
      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button className={`tab ${mode === "move" ? "on" : ""}`} style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => setMode(mode === "move" ? "paint" : "move")}>
          <Icon name="grid" size={13} /> Move boxes
        </button>
        <span className="small mute">{mode === "move" ? "Drag a box where it should be." : "Paint with:"}</span>
        {mode === "paint" &&
          KINDS.map((k) => (
            <button
              key={k}
              className={`tab ${paint === k ? "on" : ""}`}
              style={{ padding: "5px 12px", fontSize: 12 }}
              onClick={() => setPaint(k)}
            >
              {CELL[k].label}
            </button>
          ))}
      </div>

      <div
        className={`layout-grid ${mode === "move" ? "moving" : ""}`}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, userSelect: "none", maxWidth: cols * 128 }}
        onMouseLeave={() => setDrag(false)}
      >
        {list.map(({ r, c, kind, sid }) => {
          const key = keyOf(r, c);
          const num = numbers.get(key);
          const stall = sid ? stalls.find((s) => s.id === sid) : null;
          const horse = stall?.animalId ? animals.find((a) => a.id === stall.animalId) : null;
          const movable = mode === "move" && kind === "stall";
          return (
            <div
              key={key}
              className={`cell ${kind} ${horse && kind === "stall" ? "occupied" : ""} ${movable ? "movable" : ""} ${lift === key ? "lifted" : ""}`}
              draggable={movable}
              onDragStart={(e) => movable && e.dataTransfer.setData("text/cell", key)}
              onDragOver={(e) => mode === "move" && e.preventDefault()}
              onDrop={(e) => {
                if (mode !== "move") return;
                e.preventDefault();
                move(e.dataTransfer.getData("text/cell"), key);
              }}
              onMouseDown={() => {
                if (mode === "move") return;
                setDrag(true);
                put(r, c);
              }}
              onMouseEnter={() => mode === "paint" && drag && put(r, c)}
              onClick={() => {
                if (mode !== "move") return;
                if (lift) move(lift, key);
                else if (kind === "stall") setLift(key);
              }}
              title={
                mode === "move"
                  ? kind === "stall"
                    ? `${stall?.name || `Box ${num}`}${horse ? ` — ${horse.name}` : ""}. Drag it where it should be.`
                    : "Drop a box here"
                  : `${CELL[kind].label} — row ${r + 1}, column ${c + 1}`
              }
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
        <span className="small mute">
          {mode === "move"
            ? "A box takes its horse, its name, its camera and its history with it."
            : "Click or drag to paint. Leave corners empty for an L, a U or a T — the screens follow the shape."}
        </span>
      </div>

      {losing.length > 0 && (
        <div className="alert-row warning" style={{ marginTop: 12 }}>
          <span className="ico warning">
            <Icon name="alert" size={16} />
          </span>
          <div>
            <div className="ttl">{losing.length} occupied box{losing.length > 1 ? "es" : ""} would be removed</div>
            <div className="why">
              {losing.map((s) => animals.find((a) => a.id === s.animalId)?.name || s.name).join(", ")} would be left
              unassigned. Their profiles and history are kept.
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
          onClick={() =>
            onSave({
              cols,
              rows,
              cells: list
                .filter((c) => c.kind !== "empty")
                .map(({ r, c, kind, sid }) => (sid ? { r, c, kind, sid } : { r, c, kind })),
            })
          }
        >
          <Icon name="check" size={15} /> Save layout
        </button>
      </div>
    </div>
  );
}
