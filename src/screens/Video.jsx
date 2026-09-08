/* ==========================================================================
   Video: every camera on one wall, or one camera with the day behind it.

   Playback scrubs the same behaviour timeline the alerts are built from, so a
   flagged event and the footage of it can never disagree.
   ========================================================================== */

import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icons";
import { Card, Empty, Pill, Tabs, hhmm } from "../components/ui";
import AlertList from "../components/AlertList";
import CameraView from "../components/CameraView";
import { useWorld } from "../lib/store";
import { go } from "../lib/router";
import { stallAlerts, stallState } from "../lib/insights";
import { BEHAVIOUR, DAY_MS, behaviourAt, cameraEvents, startOfDay } from "../lib/sim";

export default function Video({ stallId, snap }) {
  const { world } = useWorld();
  const stall = stallId ? world.stalls.find((s) => s.id === stallId) : null;
  return stall ? <Single stall={stall} /> : <Wall snap={snap} />;
}

/* ------------------------------- camera wall ------------------------------- */

function Wall({ snap }) {
  const { world, now } = useWorld();
  const params = new URLSearchParams((window.location.hash.split("?")[1] || ""));
  const [barn, setBarn] = useState(params.get("barn") || "all");
  const [limit, setLimit] = useState(12);

  const tiles = useMemo(() => {
    const rolls = barn === "all" ? snap.rolls : snap.rolls.filter((r) => r.barn.id === barn);
    return rolls.flatMap((r) => r.states.map((x) => ({ ...x, barn: r.barn }))).filter((x) => x.stall);
  }, [snap, barn]);

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Live streaming</h1>
          <div className="sub">
            {tiles.length} cameras · AI identity and behaviour overlay on every feed
          </div>
        </div>
        <div className="hd-actions">
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
        </div>
      </div>

      {tiles.length === 0 ? (
        <Card>
          <Empty icon="video">No cameras yet — lay out a barn to add monitored boxes.</Empty>
        </Card>
      ) : (
        <>
          <div className="cam-grid">
            {tiles.slice(0, limit).map((x) => {
              const seg = x.animal ? behaviourAt(x.stall, x.animal, now) : null;
              return (
                <div key={x.stall.id} className={`cam ${x.stall.camera === false ? "offline" : ""}`} onClick={() => go(`video/${x.stall.id}`)}>
                  <CameraView stall={x.stall} animal={x.animal} at={now} fps={6} />
                  <div className="cam-badge">
                    <span className="rec-dot" /> {x.barn.name}
                  </div>
                  <div className="cap">
                    <b>{x.stall.name}</b>
                    <span>{x.animal ? x.animal.name : "Empty"}</span>
                    <span className="st">{seg ? BEHAVIOUR[seg.state]?.label : "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {limit < tiles.length && (
            <div className="row" style={{ justifyContent: "center", marginTop: 18 }}>
              <button className="btn" onClick={() => setLimit((l) => l + 12)}>
                Show more cameras ({tiles.length - limit} left)
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ------------------------------ single camera ------------------------------ */

const SPEEDS = [1, 8, 60];

function Single({ stall }) {
  const { world, now } = useWorld();
  const [mode, setMode] = useState("live");
  const [mins, setMins] = useState(() => new Date().getHours() * 60);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(8);
  const [overlay, setOverlay] = useState(true);
  const box = useRef(null);

  const animal = stall.animalId ? world.animals.find((a) => a.id === stall.animalId) : null;
  const barn = world.barns.find((b) => b.id === stall.barnId);
  const st = stallState(world, stall, now);
  const alerts = stallAlerts(world, st, now);
  const dayStart = startOfDay(now);
  const maxMins = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const events = animal ? cameraEvents(stall, animal, dayStart).filter((e) => e.at <= now) : [];

  const at = mode === "live" ? now : dayStart + mins * 60000;
  const seg = animal ? behaviourAt(stall, animal, at) : null;

  useEffect(() => {
    if (mode !== "playback" || !playing) return;
    const t = setInterval(() => {
      setMins((m) => {
        const next = m + speed / 4; // quarter-second ticks
        if (next >= maxMins) {
          setPlaying(false);
          return maxMins;
        }
        return next;
      });
    }, 250);
    return () => clearInterval(t);
  }, [mode, playing, speed, maxMins]);

  const snapshot = () => {
    const cv = box.current?.querySelector("canvas");
    if (!cv) return;
    const a = document.createElement("a");
    a.download = `${stall.name.replace(/\s+/g, "-").toLowerCase()}-${new Date(at).toISOString().slice(0, 16).replace(/[:T]/g, "")}.png`;
    a.href = cv.toDataURL("image/png");
    a.click();
  };

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>
            {stall.name} <span className="mute" style={{ fontWeight: 500, fontSize: 17 }}>· {barn?.name}</span>
          </h1>
          <div className="sub">
            {animal ? (
              <button className="lnk" onClick={() => go(`animal/${animal.id}`)}>
                {animal.name}
              </button>
            ) : (
              "No horse assigned"
            )}
          </div>
        </div>
        <div className="hd-actions">
          <button className="btn" onClick={() => go("video")}>
            <Icon name="left" size={15} /> All cameras
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,2.1fr) minmax(280px,1fr)", alignItems: "start" }}>
        <div className="grid">
          <Card pad={false} style={{ padding: 14 }}>
            <div className="row" style={{ marginBottom: 12 }}>
              <Tabs
                items={[
                  { id: "live", label: "Live", icon: "video" },
                  { id: "playback", label: "Playback", icon: "clock" },
                ]}
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  if (m === "playback") setMins(Math.max(0, maxMins - 60));
                }}
              />
              <div className="grow" />
              <button className={`btn sm ${overlay ? "pri" : ""}`} onClick={() => setOverlay(!overlay)}>
                <Icon name="id" size={14} /> AI overlay
              </button>
              <button className="btn sm" onClick={snapshot}>
                <Icon name="download" size={14} /> Snapshot
              </button>
            </div>

            <div ref={box} className="cam" style={{ cursor: "default" }}>
              <CameraView stall={stall} animal={animal} at={at} fps={mode === "live" ? 20 : 14} overlay={overlay} />
              <div className="cam-badge">
                {mode === "live" ? (
                  <>
                    <span className="rec-dot" /> LIVE
                  </>
                ) : (
                  <>
                    <Icon name="clock" size={12} /> PLAYBACK {speed}×
                  </>
                )}
              </div>
            </div>

            {mode === "playback" && (
              <div style={{ marginTop: 12 }}>
                <div className="row">
                  <button className="btn sm" onClick={() => setPlaying(!playing)}>
                    <Icon name={playing ? "pause" : "play"} size={14} /> {playing ? "Pause" : "Play"}
                  </button>
                  {SPEEDS.map((sp) => (
                    <button key={sp} className={`btn sm ${speed === sp ? "pri" : ""}`} onClick={() => setSpeed(sp)}>
                      {sp}×
                    </button>
                  ))}
                  <b className="nums" style={{ marginLeft: 10 }}>
                    {hhmm(at)}
                  </b>
                  <span className="grow" />
                  <button className="btn sm" onClick={() => setMins(Math.max(0, mins - 15))}>
                    <Icon name="left" size={13} /> 15 min
                  </button>
                  <button className="btn sm" onClick={() => setMins(Math.min(maxMins, mins + 15))}>
                    15 min <Icon name="right" size={13} />
                  </button>
                </div>

                <div className="timeline" style={{ marginTop: 10 }}>
                  {events.map((e) => {
                    const m = (e.at - dayStart) / 60000;
                    return (
                      <span
                        key={e.at}
                        className="mk"
                        title={`${hhmm(e.at)} — ${e.title}`}
                        style={{
                          left: `${(m / 1440) * 100}%`,
                          background: { critical: "#d03b3b", serious: "#ec835a", warning: "#fab219", info: "#9fb6cb" }[e.severity],
                        }}
                      />
                    );
                  })}
                  <span className="cursor" style={{ left: `${(mins / 1440) * 100}%` }} />
                </div>
                <input
                  className="scrub"
                  type="range"
                  min="0"
                  max={maxMins}
                  step="1"
                  value={mins}
                  onChange={(e) => setMins(Number(e.target.value))}
                  aria-label="Scrub through today"
                />
                <div className="row tiny mute" style={{ justifyContent: "space-between" }}>
                  <span>00:00</span>
                  <span>Retained for {world.settings.camera.retentionDays} days</span>
                  <span>{hhmm(now)}</span>
                </div>
              </div>
            )}
          </Card>

          <Card title="Clips flagged today" sub="Click to jump the playback there">
            {events.length === 0 && <div className="small mute">Nothing flagged today.</div>}
            {events
              .slice()
              .reverse()
              .map((e) => (
                <button
                  key={e.at}
                  className="alert-row"
                  style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "#fff" }}
                  onClick={() => {
                    setMode("playback");
                    setPlaying(false);
                    setMins(Math.max(0, (e.at - dayStart) / 60000 - 1));
                  }}
                >
                  <span className={`ico ${e.severity === "info" ? "good" : e.severity}`}>
                    <Icon name="play" size={15} />
                  </span>
                  <div className="grow">
                    <div className="row" style={{ gap: 8 }}>
                      <b>{e.title}</b>
                      <Pill tone={e.severity === "info" ? "flat" : e.severity}>{hhmm(e.at)}</Pill>
                    </div>
                    <div className="why">
                      {e.detail} · {e.mins} min · {e.conf}% confidence
                    </div>
                  </div>
                </button>
              ))}
          </Card>
        </div>

        <div className="grid">
          <Card title="Right now">
            <div className="row" style={{ gap: 10 }}>
              <span className="dot good" />
              <b>{seg ? BEHAVIOUR[seg.state]?.label : "Empty box"}</b>
            </div>
            {animal && (
              <div className="small mute" style={{ marginTop: 8, lineHeight: 1.7 }}>
                Identity: <b>{st.identity?.mismatch ? world.animals.find((a) => a.id === animal.seenAs)?.name || "unknown" : animal.name}</b> at{" "}
                {st.identity?.conf}% confidence
                <br />
                Water today: <b className="nums">{st.today.offline ? "no data" : `${st.today.intakeL} L`}</b>
                <br />
                Stall: <b className="nums">{st.today.tempNow}°C</b>, air <b className="nums">{st.today.airNow}%</b>
              </div>
            )}
            {seg?.note && <div className="rec" style={{ marginTop: 10 }}>{seg.note}</div>}
          </Card>

          <Card title="Open alerts">
            <AlertList alerts={alerts} now={now} compact empty="Nothing open on this box." />
          </Card>

          <Card title="Camera">
            <div className="small mute" style={{ lineHeight: 1.7 }}>
              Stream: <b>1080p, 20 fps</b>
              <br />
              Night mode: <b>infra-red after 20:00</b>
              <br />
              Retention: <b>{world.settings.camera.retentionDays} days</b>
              <br />
              Identity model: <b>{world.settings.camera.identify ? "on" : "off"}</b>, behaviour alerts:{" "}
              <b>{world.settings.camera.behaviour ? "on" : "off"}</b>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
