/* Every alert the yard has been sent, newest first — live ones first, then the
   same engine replayed over the past week so the history is real. */

import { useMemo, useState } from "react";
import Icon from "../components/Icons";
import { Card, Empty, Pill, Tabs, ago, dmy } from "../components/ui";
import AlertList from "../components/AlertList";
import { useWorld } from "../lib/store";
import { notificationFeed } from "../lib/insights";

const FILTERS = [
  { id: "open", label: "Open", icon: "bell" },
  { id: "all", label: "All", icon: "note" },
  { id: "critical", label: "Critical", icon: "alert" },
  { id: "camera", label: "Camera", icon: "camera" },
];

export default function Notifications({ snap }) {
  const { world, now, actions } = useWorld();
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const [tab, setTab] = useState("open");
  const [barn, setBarn] = useState(params.get("barn") || "all");

  const feed = useMemo(() => notificationFeed(world, now), [world, now]);

  const rows = useMemo(() => {
    let list = tab === "open" ? snap.alerts.filter((a) => world.alertState?.[a.id] !== "ack") : feed;
    if (tab === "critical") list = list.filter((a) => a.severity === "critical" || a.severity === "serious");
    if (tab === "camera") list = list.filter((a) => a.kind === "camera" || a.kind === "identity");
    if (barn !== "all") list = list.filter((a) => a.barnId === barn);
    return list;
  }, [tab, barn, feed, snap, world]);

  const today = rows.filter((a) => !a.historic);
  const earlier = rows.filter((a) => a.historic);

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Notifications</h1>
          <div className="sub">
            {snap.counts.critical} critical · {snap.counts.serious} needing attention · {snap.counts.warning} to watch
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
          <button className="btn" onClick={() => snap.alerts.forEach((a) => actions.setAlertState(a.id, "ack"))}>
            <Icon name="check" size={15} /> Acknowledge all
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Tabs items={FILTERS} value={tab} onChange={setTab} />
      </div>

      <Card title="Today" sub={`${today.length} alerts`}>
        <AlertList alerts={today} now={now} empty="Nothing raised today." />
      </Card>

      {earlier.length > 0 && (
        <Card title="Earlier" sub="Replayed from the same thresholds" style={{ marginTop: 16 }}>
          {earlier.slice(0, 40).map((a) => (
            <div key={`${a.id}-${a.at}`} className="row" style={{ gap: 12, padding: "10px 2px", borderBottom: "1px solid var(--line)" }}>
              <span className={`ico ${a.severity === "info" ? "good" : a.severity}`} style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center" }}>
                <Icon name={a.kind === "camera" ? "camera" : a.kind === "intake" ? "water" : a.kind === "temp" ? "temp" : "bell"} size={15} />
              </span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <b className="small">{a.title}</b>
                  <Pill tone={a.severity === "info" ? "flat" : a.severity}>{a.severity}</Pill>
                </div>
                <div className="tiny mute" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.detail}
                </div>
              </div>
              <span className="tiny mute nowrap">
                {dmy(a.at)} · {ago(a.at, now)}
              </span>
            </div>
          ))}
        </Card>
      )}

      {rows.length === 0 && (
        <Card>
          <Empty icon="check">Nothing matches this filter.</Empty>
        </Card>
      )}
    </>
  );
}
