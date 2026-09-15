/* Shared shapes: cards, tiles, tabs, modal, alert row. Nothing clever, but one
   place to change the look of every screen. */

import { useEffect } from "react";
import Icon from "./Icons";

/* --------------------------------- format --------------------------------- */

export const hhmm = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const dmy = (ms) => new Date(ms).toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });

export function ago(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 90) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return dmy(ms);
}

export const SEVERITY = {
  critical: { label: "Critical", icon: "alert" },
  serious: { label: "Attention", icon: "alert" },
  warning: { label: "Watch", icon: "bell" },
  good: { label: "Good", icon: "check" },
  info: { label: "Info", icon: "note" },
};

/* -------------------------------- primitives ------------------------------- */

export function Card({ title, sub, right, children, className = "", style, pad = true }) {
  return (
    <section className={`card ${pad ? "" : "pad0"} ${className}`} style={style}>
      {(title || right) && (
        <header className="card-hd">
          <div>
            {title && <h3>{title}</h3>}
            {sub && <div className="small mute" style={{ marginTop: 2 }}>{sub}</div>}
          </div>
          {right && <div className="r">{right}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Tile({ kind = "", label, value, unit, note, children }) {
  return (
    <div className={`tile ${kind}`}>
      <div className="lab">{label}</div>
      <div className="val nums">
        {value}
        {unit ? <span className="u">{unit}</span> : null}
      </div>
      {note && <div className="note">{note}</div>}
      {children}
    </div>
  );
}

export function Tabs({ items, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          className={`tab ${value === it.id ? "on" : ""}`}
          onClick={() => onChange(it.id)}
        >
          {it.icon && <Icon name={it.icon} size={15} />}
          {it.label}
          {it.count != null && <span className="nums" style={{ opacity: 0.75 }}>({it.count})</span>}
        </button>
      ))}
    </div>
  );
}

export function Pill({ tone = "", children, icon, title }) {
  return (
    <span className={`pill ${tone}`} title={title}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

export function Dot({ tone = "flat" }) {
  return <span className={`dot ${tone}`} />;
}

export function Switch({ on, onChange, label }) {
  return (
    <button className={`switch ${on ? "on" : ""}`} onClick={() => onChange(!on)} type="button" aria-pressed={on}>
      <span className="track" />
      {label && <span className="small">{label}</span>}
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Empty({ icon = "note", children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={26} />
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-hd">
          <h3>{title}</h3>
          <button className="btn ghost sm" style={{ marginLeft: "auto" }} onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="modal-bd">{children}</div>
        {footer && <div className="modal-ft">{footer}</div>}
      </div>
    </div>
  );
}

/* A horse's colour, as a swatch — quicker to scan a list by than a name. */
const COAT = {
  Bay: "#7b4b25",
  "Dark Bay": "#4d2f1c",
  Brown: "#5d4130",
  Chestnut: "#a85b28",
  Grey: "#9aa7b4",
  Black: "#2b2b2b",
};
export function Coat({ animal, size = 30 }) {
  const c = COAT[animal?.colour] || "#7b4b25";
  const initials = (animal?.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      title={animal?.colour}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(160deg, ${c}, ${c}bb)`,
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontSize: size * 0.36,
        fontWeight: 700,
        flex: "none",
        letterSpacing: "-0.02em",
      }}
    >
      {initials}
    </span>
  );
}

/* ---------------------------------- alerts --------------------------------- */

export function AlertRow({ alert, now, onAction, onAck, onDismiss, compact }) {
  const meta = SEVERITY[alert.severity] || SEVERITY.info;
  const tone = alert.severity === "info" ? "good" : alert.severity;
  return (
    <div className={`alert-row ${tone}`}>
      <span className={`ico ${tone}`}>
        <Icon name={meta.icon} size={17} />
      </span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="ttl">{alert.title}</span>
          <Pill tone={tone}>{meta.label}</Pill>
          <span className="when">{ago(alert.at || alert.ts, now)}</span>
        </div>
        <div className="why">{alert.detail}</div>
        {!compact && alert.recommendation && (
          <div className="rec">
            <b>Do this:</b> {alert.recommendation}
          </div>
        )}
        {!compact && (
          <div className="acts">
            {(alert.actions || []).map((a) => (
              <button key={a.id} className="btn sm" onClick={() => onAction?.(a.id, alert)}>
                {a.label}
              </button>
            ))}
            {onAck && (
              <button className="btn sm" onClick={() => onAck(alert)}>
                <Icon name="check" size={13} /> Acknowledge
              </button>
            )}
            {onDismiss && (
              <button className="btn sm ghost" onClick={() => onDismiss(alert)}>
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
