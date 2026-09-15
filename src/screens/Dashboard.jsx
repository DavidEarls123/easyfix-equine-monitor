/* The home screen: the state of the whole yard, what is wrong, and what to do
   about it — in that order. */

import { useMemo, useState } from "react";
import Icon from "../components/Icons";
import { Card, Coat, Pill, Tile, ago } from "../components/ui";
import AttentionList from "../components/AttentionList";
import { WelfareBar, WelfareRing } from "../components/Welfare";
import { BarChart, C, LineChart, Sparkline } from "../components/charts";
import AddAnimal from "./AddAnimal";
import { useWorld } from "../lib/store";
import { go } from "../lib/router";
import { dayReadings, startOfDay, DAY_MS, cameraEvents } from "../lib/sim";

export default function Dashboard({ snap }) {
  const { world, now } = useWorld();
  const [adding, setAdding] = useState(false);
  const s = world.settings;
  const yard = world.yards[0];

  // Yard-wide hourly shape: the average of every occupied box, to this hour.
  const hourly = useMemo(() => {
    const hourNow = new Date(now).getHours();
    const acc = Array.from({ length: 24 }, () => ({ l: 0, t: 0, n: 0 }));
    snap.live.forEach((x) => {
      if (x.today.offline) return;
      x.today.hours.forEach((h) => {
        if (h.h > hourNow) return;
        acc[h.h].l += h.intakeL;
        acc[h.h].t += h.tempC;
        acc[h.h].n++;
      });
    });
    return acc.map((a, h) => ({
      label: `${String(h).padStart(2, "0")}`,
      l: a.n ? Math.round((a.l / a.n) * 100) / 100 : null,
      t: a.n ? Math.round((a.t / a.n) * 10) / 10 : null,
    }));
  }, [snap, now]);

  const camera = useMemo(() => {
    const out = [];
    snap.live.forEach((x) => {
      cameraEvents(x.stall, x.animal, startOfDay(now))
        .filter((e) => e.at <= now && e.severity !== "info")
        .forEach((e) => out.push({ ...e, animal: x.animal, stall: x.stall }));
    });
    return out.sort((a, b) => b.at - a.at).slice(0, 6);
  }, [snap, now]);

  const critical = snap.alerts.filter((a) => a.severity === "critical" || a.severity === "serious");

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>{yard?.name || "Yard"}</h1>
          <div className="sub">
            {snap.counts.occupied} horses in {snap.counts.configured} barns · live sensor and camera data, updating every few seconds
          </div>
        </div>
        <div className="hd-actions">
          <button className="btn" onClick={() => go("barns")}>
            <Icon name="barn" size={15} /> Barns
          </button>
          <button className="btn pri" onClick={() => setAdding(true)}>
            <Icon name="plus" size={15} /> Add horse
          </button>
        </div>
      </div>

      <div className="tiles" style={{ marginBottom: 16 }}>
        <Tile
          kind="alert"
          label="Needs attention"
          value={snap.counts.critical + snap.counts.serious}
          note={`${snap.counts.critical} critical · ${snap.counts.serious} to look at · ${snap.counts.warning} to watch`}
        />
        <Tile
          kind="welfare"
          label="Welfare index"
          value={snap.welfare.average ?? "—"}
          note={
            snap.welfare.average != null
              ? `yard average across ${snap.welfare.scored.length} monitored horses`
              : "no monitored horses yet"
          }
        />
        <Tile
          kind="water"
          label="Water intake"
          value={snap.intakePct}
          unit="%"
          note={`of pace for the day · ${snap.intakeL} L average so far`}
        />
        <Tile kind="temp" label="Stall temperature" value={snap.tempC} unit="°C" note={`comfort band ${s.tempMin}–${s.tempMax}°C`} />
        <Tile kind="air" label="Air quality" value={snap.air} unit="%" note={`target above ${s.airMin}% · humidity ${snap.humidity}%`} />
        <Tile
          label="Monitored boxes"
          value={`${snap.counts.occupied}/${snap.counts.stalls}`}
          note={`${snap.counts.offline} sensor${snap.counts.offline === 1 ? "" : "s"} offline`}
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)", alignItems: "start" }}>
        <div className="grid">
          <Card
            title="Needs attention"
            sub="One card per horse — every finding on that animal, worst first"
            right={
              <button className="btn sm" onClick={() => go("alerts")}>
                Show all ({snap.alerts.length})
              </button>
            }
          >
            <AttentionList
              alerts={critical.length ? critical : snap.alerts}
              snap={snap}
              now={now}
              limit={4}
              empty="Everything is inside its limits."
            />
          </Card>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Card title="Water intake today" sub="Yard average per box, by hour">
              <BarChart values={hourly.map((h) => ({ label: h.label, v: h.l }))} color={C.water} unit=" L" title="Average intake per box" />
            </Card>
            <Card title="Stall temperature today" sub="Yard average, comfort band shaded">
              <LineChart
                values={hourly.map((h) => ({ label: h.label, v: h.t }))}
                color={C.temp}
                unit="°C"
                band={[s.tempMin, s.tempMax]}
                title="Average stall temperature"
              />
            </Card>
          </div>

          <Card
            title="Water intake outliers"
            sub="Lowest against their own six-day average — the first sign something is wrong"
          >
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Horse</th>
                    <th>Stall</th>
                    <th>Today</th>
                    <th>6-day avg</th>
                    <th>Change</th>
                    <th>Pace</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.outliers.map((o) => (
                    <Outlier key={o.stall.id} o={o} now={now} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="grid">
          <Card title="Lowest welfare index" sub="The horses carrying the most, whether or not they have tripped a threshold">
            {snap.welfare.lowest.length === 0 && <div className="small mute">No monitored horses yet.</div>}
            {snap.welfare.lowest.map((x) => (
              <button
                key={x.stall.id}
                className="alert-row"
                style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "#fff" }}
                onClick={() => go(`animal/${x.animal.id}`)}
              >
                <Coat animal={x.animal} size={30} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <b>{x.animal.name}</b>
                    <span className="tiny mute">{x.stall.name}</span>
                  </div>
                  <div className="why">{x.welfare.weakest ? `${x.welfare.weakest.label.toLowerCase()} — ${x.welfare.weakest.why}` : ""}</div>
                </div>
                <WelfareBar welfare={x.welfare} width={54} />
              </button>
            ))}
          </Card>

          <Card title="Barn health" sub="Tap a barn for its boxes">
            {snap.rolls.map((r) => (
              <button
                key={r.barn.id}
                className="alert-row"
                style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "#fff" }}
                onClick={() => go(`barn/${r.barn.id}`)}
              >
                <span className={`ico ${r.worst ? (r.worst.severity === "info" ? "good" : r.worst.severity) : "good"}`}>
                  <Icon name="barn" size={16} />
                </span>
                <div className="grow">
                  <div className="row" style={{ gap: 8 }}>
                    <b>{r.barn.name}</b>
                    {!r.barn.configured ? (
                      <Pill tone="flat">Not set up</Pill>
                    ) : (
                      <Pill tone={r.alerts.length ? "warning" : "good"}>
                        {r.alerts.length ? `${r.alerts.length} open` : "All clear"}
                      </Pill>
                    )}
                  </div>
                  {r.barn.configured ? (
                    <div className="why nums">
                      {r.occupied}/{r.stalls.length} boxes · {r.tempC}°C · air {r.air}% · water {r.pctOfGoal}%
                    </div>
                  ) : (
                    <div className="why">No layout yet — place the boxes to start monitoring</div>
                  )}
                </div>
                <Icon name="right" size={16} style={{ color: "#86a0b8" }} />
              </button>
            ))}
          </Card>

          <Card
            title="Camera insights"
            sub="What the AI camera has flagged today"
            right={
              <button className="btn sm" onClick={() => go("video")}>
                <Icon name="video" size={14} /> Live
              </button>
            }
          >
            {camera.length === 0 && <div className="small mute">Nothing unusual seen today.</div>}
            {camera.map((e) => (
              <button
                key={e.stall.id + e.at}
                className="alert-row"
                style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "#fff" }}
                onClick={() => go(`video/${e.stall.id}`)}
              >
                <span className={`ico ${e.severity}`}>
                  <Icon name="camera" size={16} />
                </span>
                <div className="grow">
                  <div className="row" style={{ gap: 8 }}>
                    <b>{e.animal.name}</b>
                    <span className="tiny mute">{e.stall.name}</span>
                    <span className="when">{ago(e.at, now)}</span>
                  </div>
                  <div className="why">
                    {e.title} — {e.detail} ({e.conf}% confidence)
                  </div>
                </div>
              </button>
            ))}
          </Card>
        </div>
      </div>

      {adding && <AddAnimal onClose={() => setAdding(false)} />}
    </>
  );
}

function Outlier({ o, now }) {
  const week = useMemo(() => {
    const start = startOfDay(now);
    return Array.from({ length: 6 }, (_, i) => dayReadings(o.stall, o.animal, start - (5 - i) * DAY_MS).intakeL);
  }, [o, now]);
  const tone = o.pct < 50 ? "critical" : o.pct < 70 ? "warning" : "good";
  return (
    <tr>
      <td>
        <div className="row" style={{ gap: 9 }}>
          <Coat animal={o.animal} size={26} />
          <button className="lnk" onClick={() => go(`animal/${o.animal.id}`)}>
            {o.animal.name}
          </button>
        </div>
      </td>
      <td className="small mute">{o.stall.name}</td>
      <td className="nums">{o.intakeL} L</td>
      <td className="nums mute">{o.avgL} L</td>
      <td className="nums" style={{ color: o.delta < 0 ? "#a92c2c" : "#0a7d0a", fontWeight: 700 }}>
        {o.delta > 0 ? "+" : ""}
        {o.delta} L
      </td>
      <td>
        <Pill tone={tone}>{o.pct}%</Pill>
      </td>
      <td>
        <div style={{ display: "grid", placeItems: "center" }}>
          <Sparkline values={week} color={C.water} />
        </div>
      </td>
    </tr>
  );
}
