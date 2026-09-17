import { useMemo, useState } from "react";
import Icon from "./components/Icons";
import { RailMark, Wordmark } from "./components/Brand";
import { useWorld } from "./lib/store";
import { go, useRoute } from "./lib/router";
import { yardSnapshot } from "./lib/insights";
import Dashboard from "./screens/Dashboard";
import Barns from "./screens/Barns";
import BarnDetail from "./screens/BarnDetail";
import Animals from "./screens/Animals";
import AnimalProfile from "./screens/AnimalProfile";
import Video from "./screens/Video";
import Notifications from "./screens/Notifications";
import Settings from "./screens/Settings";
import Staff from "./screens/Staff";
import Rides from "./screens/Rides";
import Board from "./screens/Board";

const NAV = [
  { at: "dashboard", label: "Dashboard", icon: "dashboard" },
  { at: "barns", label: "Barns", icon: "barn", sub: true, parent: "yard" },
  { at: "animals", label: "Animals", icon: "head", sub: true, parent: "yard" },
  { at: "staff", label: "Staff", icon: "id", sub: true, parent: "people" },
  { at: "rides", label: "Ride planning", icon: "helmet", sub: true, parent: "people" },
  { at: "video", label: "Video", icon: "video" },
  { at: "alerts", label: "Notifications", icon: "bell" },
  { at: "settings", label: "Settings", icon: "settings" },
];

export default function App() {
  const { world, now, toast } = useWorld();
  const route = useRoute();
  const snap = useMemo(() => yardSnapshot(world, now), [world, now]);
  const unread = snap.alerts.filter((a) => a.severity !== "info" && world.alertState?.[a.id] !== "ack").length;

  const screen = () => {
    switch (route.at) {
      case "barns":
        return <Barns snap={snap} />;
      case "barn":
        return <BarnDetail id={route.id} tab={route.q.t} snap={snap} />;
      case "animals":
        return <Animals snap={snap} />;
      case "animal":
        return <AnimalProfile id={route.id} />;
      case "staff":
        return <Staff />;
      case "rides":
        return <Rides />;
      case "board":
        return <Board />;
      case "video":
        return <Video stallId={route.id} snap={snap} />;
      case "alerts":
        return <Notifications snap={snap} />;
      case "settings":
        return <Settings snap={snap} />;
      default:
        return <Dashboard snap={snap} />;
    }
  };

  const on = (item) =>
    route.at === item.at ||
    (item.at === "barns" && route.at === "barn") ||
    (item.at === "animals" && route.at === "animal") ||
    (item.at === "rides" && route.at === "board");

  return (
    <div className="shell">
      <nav className="rail">
        <div className="rail-logo">
          <Wordmark />
        </div>
        <div className="rail-nav">
          {NAV.map((item, i) => (
            <div key={item.at}>
              {item.parent && (i === 0 || NAV[i - 1].parent !== item.parent) && (
                <div className="rail-item" style={{ opacity: 0.75, cursor: "default" }}>
                  <Icon name={item.parent === "people" ? "id" : "yard"} size={18} />
                  <span className="lbl">{item.parent === "people" ? "People" : world.yards[0]?.name || "Yard"}</span>
                </div>
              )}
              <button className={`rail-item ${item.sub ? "sub" : ""} ${on(item) ? "on" : ""}`} onClick={() => go(item.at)}>
                {!item.sub && <Icon name={item.icon} size={19} />}
                <span className="lbl">{item.label}</span>
                {item.at === "alerts" && unread > 0 && <span className="cnt nums">{unread}</span>}
              </button>
            </div>
          ))}
        </div>
        <div className="rail-mark">
          <RailMark />
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <Search />
          <div className="spacer" />
          <span className="clock small mute">
            {new Date(now).toLocaleString([], { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
          <button className="icon-btn" onClick={() => go("alerts")} aria-label="Notifications" style={{ position: "relative" }}>
            <Icon name="bell" size={17} />
            {unread > 0 && (
              <span
                className="nums"
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  background: "#d03b3b",
                  color: "#fff",
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 5px",
                }}
              >
                {unread}
              </span>
            )}
          </button>
          <div className="who">
            <div className="avatar">SA</div>
            <div>
              <div className="nm">{world.settings.operator}</div>
              <div className="em">{world.settings.email}</div>
            </div>
          </div>
        </header>
        <main className="page">{screen()}</main>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* Quick find: horses first, then boxes — the two things a yard looks up. */
function Search() {
  const { world } = useWorld();
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const animals = world.animals
      .filter((a) => a.name.toLowerCase().includes(s) || String(a.microchip).includes(s))
      .slice(0, 6)
      .map((a) => ({ id: a.id, label: a.name, sub: a.colour + " " + a.sex, to: `animal/${a.id}` }));
    const stalls = world.stalls
      .filter((st) => st.name.toLowerCase().includes(s))
      .slice(0, 4)
      .map((st) => ({
        id: st.id,
        label: `${world.barns.find((b) => b.id === st.barnId)?.name} · ${st.name}`,
        sub: "Stall",
        to: `barn/${st.barnId}`,
      }));
    return [...animals, ...stalls];
  }, [q, world]);

  return (
    <div style={{ position: "relative", width: "min(360px, 46vw)" }}>
      <Icon name="search" size={16} style={{ position: "absolute", left: 11, top: 10, color: "#86a0b8" }} />
      <input
        className="inp"
        style={{ paddingLeft: 34 }}
        placeholder="Find a horse or a stall"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {hits.length > 0 && (
        <div
          className="card"
          style={{ position: "absolute", top: 44, left: 0, right: 0, zIndex: 40, padding: 6 }}
        >
          {hits.map((h) => (
            <button
              key={h.id}
              className="rail-item"
              style={{ color: "var(--ink)", fontWeight: 600 }}
              onClick={() => {
                setQ("");
                go(h.to);
              }}
            >
              <span className="lbl">{h.label}</span>
              <span className="tiny mute" style={{ marginLeft: "auto" }}>
                {h.sub}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
