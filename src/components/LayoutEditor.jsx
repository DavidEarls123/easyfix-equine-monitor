/* ==========================================================================
   Barn layout editor.

   A barn is a grid: paint boxes, aisles and service rooms until the grid looks
   like the building.

   Three things it has to get right that a paint grid does not get for free.

   A box is not its position. Moving a box along the wall is a thing yards do —
   a partition comes out, a corner is rebuilt — and when they do, the horse in
   it, its name, its camera and its history are all still that box's. So a
   stall cell carries the id of the box it is, and dragging it moves the box
   rather than deleting one and creating another somewhere else.

   A box is never destroyed as a side effect. Changing the shape of the shed,
   dragging across the grid, shrinking it — none of those may take a box away.
   The one thing that removes a box is painting over that box on purpose, and
   if there is a horse in it, that asks first. Everything else either carries
   the box into the new layout or refuses to run.

   And not every shed is a rectangle. An L, a U or a T is drawn by leaving
   corners empty, and the screens trim to the shape that was actually drawn.
   The shapes are built to hold the boxes the barn already has rather than to a
   fixed size, so picking one never costs you a box.
   ========================================================================== */

import { useEffect, useMemo, useState } from "react";
import Icon from "./Icons";
import { Field, Modal, Pill } from "./ui";
import { CELL, makeLayout } from "../lib/world";

const KINDS = ["stall", "aisle", "door", "tack", "wash", "feed", "empty"];
const MAXC = 24;
const MAXR = 8;

const keyOf = (r, c) => `${r}:${c}`;
const EMPTY = { kind: "empty", sid: null };
const reading = (a, b) => a.r - b.r || a.c - b.c;

/* ------------------------------- the shapes -------------------------------- */

/**
 * An L, a U or a T, sized to hold at least `want` boxes.
 *
 * All three are the same thing: a run of boxes along the back wall, an aisle,
 * and then a leg of boxes two to a row — down one side for an L, down both for
 * a U, down the middle for a T. So the arithmetic is shared: `want` boxes is a
 * back wall of `want - 2 × legRows` with `legRows` rows of leg under it.
 */
function armShape(kind, want) {
  const set = (m, r, c, k) => m.set(keyOf(r, c), { kind: k, sid: null });
  let legRows = Math.min(MAXR - 2, Math.max(1, Math.round(want / 5)));
  let w = want - legRows * 2;
  while (w < 3 && legRows > 1) {
    legRows -= 1;
    w = want - legRows * 2;
  }
  w = Math.max(3, Math.min(MAXC, w));
  const rows = Math.min(MAXR, legRows + 2);
  const cols = kind === "L" ? Math.max(w, 3) : Math.max(w, 5);

  const m = new Map();
  for (let c = 0; c < w; c++) set(m, 0, c, "stall"); // the back wall
  for (let c = 0; c < cols; c++) set(m, 1, c, "aisle");

  const mid = Math.floor(cols / 2);
  for (let r = 2; r < rows; r++) {
    if (kind === "L") {
      set(m, r, 0, "stall");
      set(m, r, 1, "aisle");
      set(m, r, 2, "stall");
    } else if (kind === "U") {
      set(m, r, 0, "stall");
      set(m, r, 1, "aisle");
      set(m, r, cols - 2, "aisle");
      set(m, r, cols - 1, "stall");
    } else {
      set(m, r, mid - 1, "stall");
      set(m, r, mid, "aisle");
      set(m, r, mid + 1, "stall");
    }
  }
  set(m, kind === "L" ? 1 : rows - 1, kind === "L" ? 0 : mid, "door");

  // whatever the arithmetic left short, make up out of the aisle — the shape
  // may never come back with fewer boxes than it was asked for
  topUp(m, cols, rows, want);
  return { m, cols, rows };
}

/** Turn spare cells into boxes, in reading order, until there are enough. */
function topUp(m, cols, rows, want) {
  const count = () => [...m.values()].filter((v) => v.kind === "stall").length;
  if (count() >= want) return;
  const spare = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const k = m.get(keyOf(r, c))?.kind || "empty";
      if (k === "empty") spare.push([r, c, 0]);
      else if (k === "aisle") spare.push([r, c, 1]);
    }
  // empty ground before aisle, because an aisle is there for a reason
  spare.sort((a, b) => a[2] - b[2]);
  for (const [r, c] of spare) {
    if (count() >= want) break;
    m.set(keyOf(r, c), { kind: "stall", sid: null });
  }
}

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
  const [ask, setAsk] = useState(null); // a box with a horse in it, about to go
  const [blocked, setBlocked] = useState(0); // boxes a drag refused to paint over

  useEffect(() => {
    const up = () => setDrag(false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const at = (r, c) => cells.get(keyOf(r, c)) || EMPTY;
  const stallOf = (sid) => (sid ? stalls.find((s) => s.id === sid) : null);
  const horseIn = (sid) => {
    const st = stallOf(sid);
    return st?.animalId ? animals.find((a) => a.id === st.animalId) : null;
  };

  const write = (r, c, kind) =>
    setCells((m) => {
      const next = new Map(m);
      // painting a box over a box keeps the box; anything else gives it up
      next.set(keyOf(r, c), { kind, sid: kind === "stall" ? next.get(keyOf(r, c))?.sid ?? null : null });
      return next;
    });

  /** Is this cell a box with a horse standing in it? */
  const guarded = (r, c) => {
    const cell = at(r, c);
    return paint !== "stall" && cell.kind === "stall" && horseIn(cell.sid) ? cell : null;
  };

  /**
   * Paint one cell, protecting any box that has a horse in it.
   *
   * Pressing and dragging never empties an occupied box — it steps over it and
   * says so afterwards. Asking is left to the click, which is the only gesture
   * that means this box in particular: a mouse-down is just as likely to be
   * the start of a drag across the grid.
   */
  const put = (r, c, count) => {
    if (guarded(r, c)) {
      if (count) setBlocked((n) => n + 1);
      return;
    }
    write(r, c, paint);
  };

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
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ r, c, ...at(r, c) });
    return out;
  }, [rows, cols, cells]);

  const stallCells = list.filter((c) => c.kind === "stall");
  const numbers = new Map(stallCells.map((c, i) => [keyOf(c.r, c.c), i + 1]));

  // a box is only lost if its id is nowhere on the grid any more — moving one
  // is not losing it
  const live = new Set(stallCells.map((c) => c.sid).filter(Boolean));
  const losing = stalls.filter((s) => s.animalId && !live.has(s.id));

  // the grid may not be shrunk past a box that is standing in it
  const used = [...cells.entries()]
    .filter(([, v]) => v.kind !== "empty")
    .map(([k]) => k.split(":").map(Number));
  const minRows = Math.max(1, ...used.map(([r]) => r + 1));
  const minCols = Math.max(2, ...used.map(([, c]) => c + 1));

  /* --------------------------- shapes to start from ---------------------- */

  /**
   * Lay the barn out afresh, carrying every box it already has into the new
   * shape. The shape is sized to hold them, so nothing is ever displaced.
   */
  const shape = (kind) => {
    // the boxes this barn has, in the order they are walked
    const keep = list
      .filter((c) => c.kind === "stall" && c.sid)
      .sort(reading)
      .map((c) => c.sid);
    // never fewer boxes than the barn already has, whether or not they are
    // boxes that exist yet — a shape is a rearrangement, not a demolition
    const want = Math.max(stallCells.length, 8);

    let built;
    if (kind === "single" || kind === "double") {
      const made = makeLayout(kind === "single" ? Math.max(want, 4) : Math.max(want, 8));
      const m = new Map();
      made.cells.forEach((c) => m.set(keyOf(c.r, c.c), { kind: c.kind, sid: null }));
      topUp(m, made.cols, made.rows, want);
      built = { m, cols: made.cols, rows: made.rows };
    } else {
      built = armShape(kind, want);
    }

    // hand every box a place in the new shape, in the same order
    const places = [];
    for (let r = 0; r < built.rows; r++)
      for (let c = 0; c < built.cols; c++) if (built.m.get(keyOf(r, c))?.kind === "stall") places.push([r, c]);
    keep.forEach((sid, i) => {
      const spot = places[i];
      if (spot) built.m.set(keyOf(spot[0], spot[1]), { kind: "stall", sid });
    });

    setCols(built.cols);
    setRows(built.rows);
    setCells(built.m);
    setBlocked(0);
  };

  /** Start again. Boxes with a horse in them are not swept away silently. */
  const clearAll = () => {
    const held = stallCells.filter((c) => horseIn(c.sid));
    if (held.length) return setAsk({ clear: true, held });
    setCells(new Map());
  };

  return (
    <div>
      <div className="row" style={{ gap: 16, alignItems: "flex-end", marginBottom: 14 }}>
        <Field label="Columns">
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm" disabled={cols <= minCols} onClick={() => setCols((v) => Math.max(minCols, v - 1))}>
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
            <button className="btn sm" disabled={rows <= minRows} onClick={() => setRows((v) => Math.max(minRows, v - 1))}>
              −
            </button>
            <b className="nums" style={{ width: 22, textAlign: "center" }}>{rows}</b>
            <button className="btn sm" onClick={() => setRows((v) => Math.min(MAXR, v + 1))}>
              +
            </button>
          </div>
        </Field>
        <div className="grow" />
        <Field label="Start from a shape" hint="Every box you have is carried into it">
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
            <button className="btn sm" onClick={clearAll}>
              Clear
            </button>
          </div>
        </Field>
      </div>

      {/* painting the building, or moving a box that is already in it */}
      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button
          className={`tab ${mode === "move" ? "on" : ""}`}
          style={{ padding: "5px 12px", fontSize: 12 }}
          onClick={() => setMode(mode === "move" ? "paint" : "move")}
        >
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
          const stall = stallOf(sid);
          const horse = horseIn(sid);
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
                put(r, c, false); // the click below decides what to do about a horse
              }}
              onMouseEnter={() => mode === "paint" && drag && put(r, c, true)}
              onClick={() => {
                if (mode === "move") {
                  if (lift) move(lift, key);
                  else if (kind === "stall") setLift(key);
                  return;
                }
                // this box, deliberately — the only way a horse's box is removed
                if (guarded(r, c)) setAsk({ r, c, stall: stallOf(sid), horse: horseIn(sid) });
              }}
              title={
                mode === "move"
                  ? kind === "stall"
                    ? `${stall?.name || `Box ${num}`}${horse ? ` — ${horse.name}` : ""}. Drag it where it should be.`
                    : "Drop a box here"
                  : `${CELL[kind].label} — row ${r + 1}, column ${c + 1}${horse ? ` · ${horse.name}` : ""}`
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
            : "Click or drag to paint. A box with a horse in it is only removed by clicking it, and asks first."}
        </span>
      </div>

      {blocked > 0 && (
        <div className="alert-row warning" style={{ marginTop: 12 }}>
          <span className="ico warning">
            <Icon name="alert" size={16} />
          </span>
          <div>
            <div className="ttl">
              {blocked} box{blocked > 1 ? "es" : ""} with a horse in {blocked > 1 ? "were" : "was"} left alone
            </div>
            <div className="why">
              Dragging across the grid does not empty an occupied box. Click one on its own to remove it.
              <button className="btn sm ghost" style={{ marginLeft: 10 }} onClick={() => setBlocked(0)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

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

      {ask && (
        <Modal
          title={ask.clear ? "Clear the whole layout?" : `Remove ${ask.stall?.name || "this box"}?`}
          onClose={() => setAsk(null)}
          footer={
            <>
              <button className="btn" onClick={() => setAsk(null)}>
                Keep it
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  if (ask.clear) setCells(new Map());
                  else write(ask.r, ask.c, paint);
                  setAsk(null);
                }}
              >
                <Icon name="trash" size={15} /> {ask.clear ? "Clear it anyway" : "Remove the box"}
              </button>
            </>
          }
        >
          {ask.clear ? (
            <p className="small">
              <b>{ask.held.length}</b> box{ask.held.length > 1 ? "es have" : " has"} a horse in{" "}
              {ask.held.length > 1 ? "them" : "it"} —{" "}
              {ask.held.map((c) => horseIn(c.sid)?.name).filter(Boolean).join(", ")}. Clearing takes{" "}
              {ask.held.length > 1 ? "those boxes" : "that box"} away and leaves{" "}
              {ask.held.length > 1 ? "them" : "it"} unassigned. Their profiles and history are kept.
            </p>
          ) : (
            <p className="small">
              <b>{ask.horse?.name}</b> is in this box. Removing it leaves {ask.horse?.name} without one until somebody
              assigns another. Its profile and history are kept.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
