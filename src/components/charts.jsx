/* Charts. One measure per chart, one colour per measure (blue = water,
   orange = temperature, aqua = air), a hover read-out on everything with a
   plot, and a values table behind each one so nothing is colour-only. */

import { useRef, useState } from "react";

export const C = { water: "#2a78d6", temp: "#eb6834", air: "#1baf7a", ink: "#0b2138", muted: "#86a0b8" };

const W = 640; // internal coordinate space; the svg scales to its container
const PAD = { l: 38, r: 14, t: 12, b: 22 };

function useHover(ref, count) {
  const [i, setI] = useState(null);
  const on = (e) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const rel = ((e.clientX - box.left) / box.width) * W;
    const inner = W - PAD.l - PAD.r;
    const idx = Math.round(((rel - PAD.l) / inner) * (count - 1));
    setI(Math.max(0, Math.min(count - 1, idx)));
  };
  return [i, on, () => setI(null)];
}

function Table({ values, unit }) {
  return (
    <div style={{ maxHeight: 150, overflow: "auto", marginTop: 8 }}>
      <table className="tbl" style={{ minWidth: 0, borderSpacing: "0 3px", fontSize: 12 }}>
        <tbody>
          {values.map((v, i) => (
            <tr key={i}>
              <td style={{ padding: "5px 9px" }}>{v.label}</td>
              <td className="nums" style={{ padding: "5px 9px" }}>
                {v.v == null ? "—" : v.v}
                {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------- line ---------------------------------- */

export function LineChart({ values, color = C.water, unit = "", band, limit, height = 170, yPad = 1.5, title }) {
  const ref = useRef(null);
  const [hi, onMove, offMove] = useHover(ref, values.length);
  const [asTable, setTable] = useState(false);
  const vs = values.map((v) => v.v).filter((v) => v != null);
  if (!vs.length) return <div className="empty small">No readings yet</div>;

  const lo = Math.min(...vs, band ? band[0] : Infinity, limit ? limit.v : Infinity) - yPad;
  const hiV = Math.max(...vs, band ? band[1] : -Infinity, limit ? limit.v : -Infinity) + yPad;
  const H = height;
  const px = (i) => PAD.l + (i / Math.max(1, values.length - 1)) * (W - PAD.l - PAD.r);
  const py = (v) => PAD.t + (1 - (v - lo) / Math.max(0.001, hiV - lo)) * (H - PAD.t - PAD.b);

  const path = values
    .map((p, i) => (p.v == null ? null : `${i === 0 || values[i - 1].v == null ? "M" : "L"}${px(i).toFixed(1)} ${py(p.v).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");
  const area = `${path} L${px(values.length - 1).toFixed(1)} ${py(lo)} L${px(0).toFixed(1)} ${py(lo)} Z`;
  const ticks = [lo, (lo + hiV) / 2, hiV].map((v) => Math.round(v * 10) / 10);
  const last = values[values.length - 1];
  const point = hi != null ? values[hi] : null;

  return (
    <div className="chart-box">
      <div className="row" style={{ justifyContent: "flex-end", marginBottom: 2 }}>
        <button className="btn ghost sm" onClick={() => setTable(!asTable)}>
          {asTable ? "Chart" : "Values"}
        </button>
      </div>
      {asTable ? (
        <Table values={values} unit={unit} />
      ) : (
        <>
          <svg
            ref={ref}
            className="chart"
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`${title || "Reading"} over time, ${vs.length} points, latest ${last.v}${unit}`}
            onMouseMove={onMove}
            onMouseLeave={offMove}
          >
            {band && (
              <rect className="band" x={PAD.l} y={py(band[1])} width={W - PAD.l - PAD.r} height={Math.max(0, py(band[0]) - py(band[1]))} rx="4" />
            )}
            {ticks.map((t) => (
              <g key={t}>
                <line className="gridline" x1={PAD.l} x2={W - PAD.r} y1={py(t)} y2={py(t)} />
                <text className="tick" x={PAD.l - 7} y={py(t) + 3.5} textAnchor="end">
                  {t}
                </text>
              </g>
            ))}
            {limit && (
              <>
                <line className="lim" x1={PAD.l} x2={W - PAD.r} y1={py(limit.v)} y2={py(limit.v)} />
                <text className="tick" x={W - PAD.r} y={py(limit.v) - 5} textAnchor="end">
                  {limit.label}
                </text>
              </>
            )}
            <defs>
              <linearGradient id={`g-${color.slice(1)}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#g-${color.slice(1)})`} />
            <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {values.map((p, i) =>
              p.v == null || (i % Math.ceil(values.length / 12) !== 0 && i !== values.length - 1) ? null : (
                <circle key={i} cx={px(i)} cy={py(p.v)} r="3" fill="#fff" stroke={color} strokeWidth="2" />
              )
            )}
            {values.map((p, i) =>
              i % Math.ceil(values.length / 8) === 0 ? (
                <text key={`t${i}`} className="tick" x={px(i)} y={H - 5} textAnchor="middle">
                  {p.label}
                </text>
              ) : null
            )}
            {point && point.v != null && (
              <g>
                <line className="axis" x1={px(hi)} x2={px(hi)} y1={PAD.t} y2={H - PAD.b} />
                <circle cx={px(hi)} cy={py(point.v)} r="5" fill={color} stroke="#fff" strokeWidth="2" />
              </g>
            )}
            <text x={W - PAD.r} y={PAD.t + 8} textAnchor="end" fontSize="12.5" fontWeight="700" fill={color}>
              {last.v}
              {unit}
            </text>
          </svg>
          {point && point.v != null && (
            <div className="tip" style={{ left: `${(px(hi) / W) * 100}%`, top: `${(py(point.v) / H) * 100}%` }}>
              {point.label} · {point.v}
              {unit}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------------------------- bars ---------------------------------- */

export function BarChart({ values, color = C.water, unit = "", height = 170, title }) {
  const ref = useRef(null);
  const [hi, onMove, offMove] = useHover(ref, values.length);
  const [asTable, setTable] = useState(false);
  const max = Math.max(0.6, ...values.map((v) => v.v || 0));
  const H = height;
  const inner = W - PAD.l - PAD.r;
  const step = inner / values.length;
  const bw = Math.max(3, step - 4); // the 2px surface gap either side
  const py = (v) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);

  return (
    <div className="chart-box">
      <div className="row" style={{ justifyContent: "flex-end", marginBottom: 2 }}>
        <button className="btn ghost sm" onClick={() => setTable(!asTable)}>
          {asTable ? "Chart" : "Values"}
        </button>
      </div>
      {asTable ? (
        <Table values={values} unit={unit} />
      ) : (
        <>
          <svg
            ref={ref}
            className="chart"
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "auto", display: "block" }}
            role="img"
            aria-label={`${title || "Hourly"} bars, peak ${Math.round(max * 10) / 10}${unit}`}
            onMouseMove={onMove}
            onMouseLeave={offMove}
          >
            {[0, max / 2, max].map((t) => (
              <g key={t}>
                <line className="gridline" x1={PAD.l} x2={W - PAD.r} y1={py(t)} y2={py(t)} />
                <text className="tick" x={PAD.l - 7} y={py(t) + 3.5} textAnchor="end">
                  {Math.round(t * 10) / 10}
                </text>
              </g>
            ))}
            {values.map((p, i) => {
              const v = p.v || 0;
              const h = Math.max(v > 0 ? 3 : 0, (v / max) * (H - PAD.t - PAD.b));
              return (
                <rect
                  key={i}
                  x={PAD.l + i * step + (step - bw) / 2}
                  y={H - PAD.b - h}
                  width={bw}
                  height={h}
                  rx="4"
                  fill={color}
                  opacity={hi == null || hi === i ? 1 : 0.55}
                />
              );
            })}
            <line className="axis" x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
            {values.map((p, i) =>
              i % Math.ceil(values.length / 8) === 0 ? (
                <text key={`t${i}`} className="tick" x={PAD.l + i * step + step / 2} y={H - 5} textAnchor="middle">
                  {p.label}
                </text>
              ) : null
            )}
          </svg>
          {hi != null && values[hi] && (
            <div
              className="tip"
              style={{ left: `${((PAD.l + hi * step + step / 2) / W) * 100}%`, top: `${(py(values[hi].v || 0) / H) * 100}%` }}
            >
              {values[hi].label} · {Math.round((values[hi].v || 0) * 10) / 10}
              {unit}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* --------------------------------- gauge ---------------------------------- */

export function Gauge({ pct, label, sub, color = C.water, size = 132 }) {
  const v = Math.max(0, Math.min(150, pct || 0));
  const r = size / 2 - 11;
  const c = 2 * Math.PI * r;
  const shown = Math.min(100, v) / 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${v}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e9f0f8" strokeWidth="11" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${c * shown} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="49%" textAnchor="middle" fontSize={size * 0.24} fontWeight="800" fill={C.ink}>
          {Math.round(v)}%
        </text>
        <text x="50%" y="66%" textAnchor="middle" fontSize="11" fill={C.muted}>
          {label}
        </text>
      </svg>
      {sub && <div className="tiny mute">{sub}</div>}
    </div>
  );
}

/* -------------------------------- sparkline -------------------------------- */

export function Sparkline({ values, color = C.water, w = 92, h = 26 }) {
  const vs = values.filter((v) => v != null);
  if (vs.length < 2) return null;
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const d = values
    .map((v, i) => `${i ? "L" : "M"}${(i / (values.length - 1)) * w} ${h - 2 - ((v - lo) / Math.max(0.001, hi - lo)) * (h - 4)}`)
    .join(" ");
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
