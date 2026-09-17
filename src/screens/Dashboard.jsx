/* The home screen: the state of the whole yard, what is wrong, and what to do
   about it — in that order. */

import { useMemo, useState } from "react";
import Icon from "../components/Icons";
import { Card, Coat, Pill, Tile, ago } from "../components/ui";
import AttentionList from "../components/AttentionList";
import { WelfareBar, WelfareRing } from "../components/Welfare";
import { airStatus, tempStatus, waterStatus, worstTone } from "../lib/status";
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

  const urgent = snap.counts.critical + snap.counts.serious;
  const unbuilt = snap.rolls.filter((r) => !r.barn.configured);

  // the tiles want the shape of the yard, not just its averages
  const spread = useMemo(() => {
    const out = { good: 0, watch: 0, bad: 0 };
    snap.welfare.scored.forEach((x) => {
      if (x.welfare.score >= 85) out.good++;
      else if (x.welfare.score >= 70) out.watch++;
      else out.bad++;
    });
    return out;
  }, [snap]);
  const learned = snap.welfare.scored.filter((x) => x.welfare.baseline?.ready).length;
  const belowOwn = snap.welfare.scored.filter((x) => x.welfare.deviation?.low).length;
  const camerasLive = snap.live.filter((x) => x.stall.camera !== false).length;

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

      {/* 1 — the headline. Four tiles, one shape: a number, then the three
             facts behind it, so they can be read across rather than decoded
             one at a time. */}
      <div className="kpis">
        <Kpi
          tone={snap.counts.critical ? "critical" : urgent ? "serious" : "good"}
          label="Needs attention now"
          value={urgent}
          caption={urgent === 0 ? "Nothing outside its limits" : "horses to see"}
          rows={[
            { k: "Critical", v: snap.counts.critical, tone: "critical" },
            { k: "To look at", v: snap.counts.serious, tone: "serious" },
            { k: "To watch", v: snap.counts.warning, tone: "warning" },
          ]}
          action={urgent > 0 ? { label: "Open the list", to: "alerts" } : null}
        />

        <Kpi
          tone={welfareTone(snap.welfare.average)}
          label="Welfare index"
          value={snap.welfare.average ?? "—"}
          caption={snap.welfare.average != null ? bandFor(snap.welfare.average).label.toLowerCase() : "no horses yet"}
          rows={[
            { k: "Settled", v: spread.good, tone: "good" },
            { k: "Watch", v: spread.watch, tone: "warning" },
            { k: "Attention or worse", v: spread.bad, tone: "serious" },
          ]}
        />

        <Kpi
          tone={belowOwn > 0 ? "warning" : "good"}
          label="Water today"
          value={snap.intakePct}
          unit="%"
          caption="of pace across the yard"
          rows={[
            { k: "Below their own normal", v: belowOwn, tone: belowOwn ? "warning" : "good" },
            { k: "Average so far", v: `${snap.intakeL} L` },
            { k: "Baselines learned", v: `${learned}/${snap.welfare.scored.length}` },
          ]}
        />

        <Kpi
          tone={snap.counts.offline ? "warning" : "good"}
          label="Monitoring"
          value={snap.counts.occupied}
          unit={`/${snap.counts.stalls}`}
          caption="boxes occupied"
          rows={[
            { k: "Meters offline", v: snap.counts.offline, tone: snap.counts.offline ? "warning" : "good" },
            { k: "Cameras live", v: camerasLive },
            { k: "Barns laid out", v: `${snap.counts.configured}/${snap.counts.barns}` },
          ]}
        />
      </div>

      {/* 2 — what is wrong, with the buildings beside it rather than below */}
      <div className="grid dash-main" style={{ gridTemplateColumns: "minmax(0,1.85fr) minmax(300px,0.85fr)", alignItems: "start", marginBottom: 20 }}>
        <Card
          className="attn-card-host"
          title="Needs attention"
          big
          sub="One card per horse — every finding on that animal, worst first"
          right={
            <button className="btn sm act" onClick={() => go("alerts")}>
              Show all {snap.alerts.length} findings
            </button>
          }
        >
          <AttentionList
            alerts={critical.length ? critical : snap.alerts}
            snap={snap}
            now={now}
            limit={4}
            live
            empty="Everything is inside its limits."
          />
        </Card>

        <div className="grid">
          <Card title="Lowest welfare index" sub="Whether or not they have tripped a threshold">
            {snap.welfare.lowest.length === 0 && <div className="small mute">No monitored horses yet.</div>}
            {snap.welfare.lowest.slice(0, 5).map((x) => (
              <button
                key={x.stall.id}
                className="alert-row"
                style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "#fff" }}
                onClick={() => go(`animal/${x.animal.id}`)}
              >
                <Coat animal={x.animal} size={28} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <b>{x.animal.name}</b>
                    <span className="tiny mute">{x.stall.name}</span>
                  </div>
                  <div className="why">
                    {x.welfare.weakest ? `${x.welfare.weakest.label.toLowerCase()} — ${x.welfare.weakest.why}` : ""}
                  </div>
                </div>
                <WelfareBar welfare={x.welfare} width={44} />
              </button>
            ))}
          </Card>

          <Card title="Barn health" sub="Same read as the barns screen, in short">
            <div className="barn-mini-list">
              {snap.rolls
                .filter((r) => r.barn.configured)
                .map((r) => {
                  const water = waterStatus(
                    r.occupied ? { pctOfGoal: r.pctOfGoal, goal: s.intakeGoal, offline: false } : null,
                    s
                  );
                  const temp = tempStatus(r.occupied ? r.tempC : null, s);
                  const air = airStatus(r.occupied ? r.air : null, s);
                  const open = r.alerts.filter((a) => a.severity !== "info").length;
                  const tone = worstTone(
                    water.tone,
                    temp.tone,
                    air.tone,
                    open && r.worst ? (r.worst.severity === "info" ? "good" : r.worst.severity) : "good"
                  );
                  return (
                    <button key={r.barn.id} className={`barn-mini ${tone}`} onClick={() => go(`barn/${r.barn.id}`)}>
                      <div className="bm-hd">
                        <b>{r.barn.name}</b>
                        <Pill tone={open ? r.worst?.severity || "warning" : "good"}>
                          {open ? `${open} open` : "All clear"}
                        </Pill>
                      </div>
                      <div className="bm-occ">
                        <span style={{ width: `${r.stalls.length ? (r.occupied / r.stalls.length) * 100 : 0}%` }} />
                      </div>
                      <div className="bm-stats">
                        <span className={water.tone} title={water.hint}>
                          <Icon name="water" size={11} /> {r.pctOfGoal}% · {water.label}
                        </span>
                        <span className={temp.tone} title={temp.hint}>
                          <Icon name="temp" size={11} /> {r.tempC}°C · {temp.label}
                        </span>
                        <span className={air.tone} title={air.hint}>
                          <Icon name="air" size={11} /> {r.air}% · {air.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              {unbuilt.length > 0 && (
                <button className="barn-mini flat" onClick={() => go("barns")}>
                  <div className="bm-hd">
                    <b>
                      {unbuilt.length} barn{unbuilt.length === 1 ? "" : "s"} not set up
                    </b>
                    <Pill tone="flat">No layout</Pill>
                  </div>
                  <div className="tiny mute" style={{ marginTop: 4 }}>
                    {unbuilt.map((r) => r.barn.name).join(", ")}
                  </div>
                </button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* 3 — conditions across the yard */}
      <SectionHd title="Conditions across the yard" sub={`Averaged over every occupied box · comfort band ${s.tempMin}–${s.tempMax}°C, air target above ${s.airMin}%`} />
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 20 }}>
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

      {/* 4 — the supporting detail, last */}
      <SectionHd title="Detail" sub="The numbers behind the calls above" />
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", alignItems: "start" }}>
        <Card title="Water intake outliers" sub="Lowest against their own six-day average — the first sign something is wrong">
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

/* A quiet rule between the bands of the dashboard, so the eye knows it has
   moved from "act on this" to "here is the detail behind it". */
function SectionHd({ title, sub }) {
  return (
    <div className="section-hd">
      <h2>{title}</h2>
      {sub && <span className="small mute">{sub}</span>}
    </div>
  );
}

const bandFor = (score) =>
  score >= 85
    ? { tone: "good", label: "Settled" }
    : score >= 70
    ? { tone: "warning", label: "Watch" }
    : score >= 55
    ? { tone: "serious", label: "Needs attention" }
    : { tone: "critical", label: "Urgent" };

/* One tile shape for all four, so the row reads across. */
function Kpi({ tone = "flat", label, value, unit, caption, rows = [], action }) {
  return (
    <div className={`kpi ${tone}`}>
      <div className="kpi-lab">{label}</div>
      <div className="kpi-top">
        <span className="kpi-val nums">
          {value}
          {unit ? <span className="u">{unit}</span> : null}
        </span>
        {caption && <span className="kpi-cap">{caption}</span>}
      </div>
      <dl className="kpi-rows">
        {rows.map((r) => (
          <div key={r.k} className={`kpi-row ${r.tone || ""}`}>
            <dt>{r.k}</dt>
            <dd className="nums">{r.v}</dd>
          </div>
        ))}
      </dl>
      {action && (
        <button className="btn sm" onClick={() => go(action.to)}>
          {action.label}
        </button>
      )}
    </div>
  );
}

const welfareTone = (score) =>
  score == null ? "flat" : score >= 85 ? "good" : score >= 70 ? "warning" : score >= 55 ? "serious" : "critical";
