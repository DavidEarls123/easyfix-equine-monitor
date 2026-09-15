/* The welfare index on screen: the headline ring, the breakdown that makes it
   arguable, and the seven-day trend that says which way it is going. */

import Icon from "./Icons";
import { Pill } from "./ui";
import { C, Sparkline } from "./charts";

const TONE = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b", flat: "#86a0b8" };

/** The score as a ring — readable at 40px in a table and at 120px on a profile. */
export function WelfareRing({ welfare, size = 74, showLabel = true }) {
  if (!welfare) return null;
  const { score, band } = welfare;
  const partial = (welfare.confidence ?? 100) < 100;
  const stroke = Math.max(5, size * 0.11);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const colour = TONE[band.tone] || TONE.flat;
  return (
    <div style={{ display: "grid", placeItems: "center", gap: 4 }}>
      <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
          {/* a broken track means an input had no data and was reweighted out */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#e6eef8"
            strokeWidth={stroke}
            strokeDasharray={partial ? "3 4" : undefined}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={colour}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * circ} ${circ}`}
          />
        </svg>
        <div
          className="nums"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            fontSize: size * 0.32,
            fontWeight: 800,
            color: colour,
            letterSpacing: "-0.03em",
          }}
        >
          {score}
        </div>
      </div>
      {showLabel && (
        <Pill tone={band.tone}>
          {band.label}
          {partial ? ` · ${welfare.confidence}% data` : ""}
        </Pill>
      )}
    </div>
  );
}

/** The same number as a bar, for rows where a ring is too heavy. */
export function WelfareBar({ welfare, width = 68 }) {
  if (!welfare) return <span className="tiny mute">—</span>;
  const colour = TONE[welfare.band.tone] || TONE.flat;
  return (
    <div className="row" style={{ gap: 8 }}>
      <span className="nums" style={{ fontWeight: 800, color: colour, minWidth: 24 }}>
        {welfare.score}
      </span>
      <span style={{ width, height: 6, background: "#e6eef8", borderRadius: 4, overflow: "hidden" }}>
        <span style={{ display: "block", width: `${welfare.score}%`, height: "100%", background: colour }} />
      </span>
    </div>
  );
}

/** What the headline is made of — worst component first. */
export function WelfareBreakdown({ welfare, compact = false }) {
  if (!welfare) return null;
  return (
    <div className="welfare-parts">
      {welfare.parts.map((p) => {
        const tone = p.score >= 85 ? "good" : p.score >= 70 ? "warning" : p.score >= 55 ? "serious" : "critical";
        return (
          <div key={p.key} className="welfare-part">
            <span className={`ico ${tone}`} style={{ width: 26, height: 26 }}>
              <Icon name={p.icon} size={13} />
            </span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 8 }}>
                <b style={{ fontSize: 13 }}>{p.label}</b>
                <span className="tiny mute nums">{p.share}% of the score</span>
                <span className="nums" style={{ marginLeft: "auto", fontWeight: 800, color: TONE[tone] }}>
                  {p.score}
                </span>
              </div>
              <div className="meter">
                <span style={{ width: `${p.score}%`, background: TONE[tone] }} />
              </div>
              {!compact && <div className="why" style={{ marginTop: 3 }}>{p.why}</div>}
            </div>
          </div>
        );
      })}
      {welfare.missing.length > 0 && (
        <div className="hint" style={{ marginTop: 8 }}>
          No data for {welfare.missing.map((m) => m.label.toLowerCase()).join(" or ")} — the remaining inputs were
          reweighted to carry the score, so it reflects {welfare.confidence}% of the configured weighting.
        </div>
      )}
    </div>
  );
}

/** Today against the six days behind it. */
export function WelfareTrend({ trend, width = 120 }) {
  if (!trend) return null;
  return (
    <div className="row" style={{ gap: 10 }}>
      <Sparkline values={trend.history.map((h) => h.score)} color={C.water} w={width} />
      <div>
        <Pill tone={trend.tone}>
          {trend.delta > 0 ? "+" : ""}
          {trend.delta} · {trend.label}
        </Pill>
        <div className="tiny mute nums" style={{ marginTop: 3 }}>
          6-day baseline {trend.baseline}
        </div>
      </div>
    </div>
  );
}
