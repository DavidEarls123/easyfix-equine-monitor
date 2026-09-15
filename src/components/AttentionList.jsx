/* ==========================================================================
   Needs attention, grouped by horse.

   The alert engine raises one alert per finding, which is right for the feed
   and wrong for the morning list: a horse that is off its water, warm and
   flank-watching is one animal to go and see, not three lines to triage. So
   the horse is the subject here — its name, its box, a still from its camera
   and its welfare index — and everything the yard has on it sits underneath,
   each with its own criticality.
   ========================================================================== */

import { useMemo, useState } from "react";
import Icon from "./Icons";
import CameraView from "./CameraView";
import { Coat, Pill, SEVERITY, ago } from "./ui";
import { WelfareRing } from "./Welfare";
import { useWorld } from "../lib/store";
import { go } from "../lib/router";
import { stallOfAnimal } from "../lib/world";
import { RANK } from "../lib/insights";

export default function AttentionList({ alerts, snap, now, limit = 4, empty = "Everything is inside its limits." }) {
  const { world, actions } = useWorld();
  const [openAll, setOpenAll] = useState({});

  // one entry per animal, plus one per barn for the findings that belong to a
  // building rather than a horse
  const groups = useMemo(() => {
    const byAnimal = new Map();
    const byBarn = new Map();
    alerts.forEach((a) => {
      const bucket = a.animalId ? byAnimal : byBarn;
      const key = a.animalId || a.barnId;
      if (!key) return;
      if (!bucket.has(key)) bucket.set(key, []);
      bucket.get(key).push(a);
    });

    const welfareOf = new Map((snap?.welfare?.scored || []).map((x) => [x.animal.id, x.welfare]));

    const animalGroups = [...byAnimal.entries()].map(([animalId, list]) => {
      const animal = world.animals.find((x) => x.id === animalId);
      const stall = animal ? stallOfAnimal(world, animalId) : null;
      const barn = stall ? world.barns.find((b) => b.id === stall.barnId) : null;
      return {
        kind: "animal",
        key: animalId,
        animal,
        stall,
        barn,
        welfare: welfareOf.get(animalId) || null,
        issues: list.slice().sort((x, y) => RANK[x.severity] - RANK[y.severity]),
      };
    });

    const barnGroups = [...byBarn.entries()].map(([barnId, list]) => ({
      kind: "barn",
      key: barnId,
      barn: world.barns.find((b) => b.id === barnId),
      issues: list.slice().sort((x, y) => RANK[x.severity] - RANK[y.severity]),
    }));

    // worst finding first; among equals the horse with the lowest welfare
    // index leads, so the sickest animal is never pushed down by a tidier one
    const rank = (g) => RANK[g.issues[0].severity];
    const score = (g) => (g.welfare ? g.welfare.score : 101);
    return [...animalGroups, ...barnGroups]
      .filter((g) => g.issues.length)
      .sort((a, b) => rank(a) - rank(b) || score(a) - score(b) || b.issues.length - a.issues.length);
  }, [alerts, world, snap]);

  const act = (id, alert) => {
    switch (id) {
      case "openAnimal":
        return go(`animal/${alert.animalId}`);
      case "openStall":
      case "openCamera":
        return go(`video/${alert.stallId}`);
      case "openBarn":
        return go(`barn/${alert.barnId}`);
      case "openLayout":
        return go(`barn/${alert.barnId}?t=layout`);
      case "swapStalls": {
        const animal = world.animals.find((a) => a.id === alert.animalId);
        const other = animal?.seenAs ? stallOfAnimal(world, animal.seenAs) : null;
        if (other) actions.swapStalls(alert.stallId, other.id);
        return;
      }
      default:
        return;
    }
  };

  if (!groups.length)
    return (
      <div className="empty">
        <Icon name="check" size={26} />
        <div style={{ marginTop: 8 }}>{empty}</div>
      </div>
    );

  return (
    <div className="attn">
      {groups.slice(0, limit).map((g) => (
        <Group
          key={g.key}
          g={g}
          now={now}
          onAction={act}
          onAck={(a) => actions.setAlertState(a.id, "ack")}
          expanded={!!openAll[g.key]}
          onExpand={() => setOpenAll((o) => ({ ...o, [g.key]: !o[g.key] }))}
        />
      ))}
    </div>
  );
}

const SHOWN = 3; // issues visible before the card folds the rest away

function Group({ g, now, onAction, onAck, expanded, onExpand }) {
  const worst = g.issues[0].severity;
  const tone = worst === "info" ? "good" : worst;
  const visible = expanded ? g.issues : g.issues.slice(0, SHOWN);
  const hidden = g.issues.length - visible.length;

  return (
    <article className={`attn-card ${tone}`}>
      {g.kind === "animal" && g.animal ? (
        <button className="attn-hd" onClick={() => go(`animal/${g.animal.id}`)}>
          {g.stall ? (
            <span className="attn-still">
              <CameraView stall={g.stall} animal={g.animal} at={now} animate={false} overlay={false} height={78} />
            </span>
          ) : (
            <Coat animal={g.animal} size={52} />
          )}
          <span className="attn-who">
            <span className="row" style={{ gap: 8 }}>
              <span className="nm">{g.animal.name}</span>
              <Pill tone={tone}>
                {g.issues.length} {g.issues.length === 1 ? "issue" : "issues"}
              </Pill>
            </span>
            <span className="sub">
              {g.barn?.name}
              {g.stall ? ` · ${g.stall.name}` : ""} · {g.animal.colour} {g.animal.sex?.toLowerCase()}
              {g.animal.age != null ? `, ${g.animal.age}` : ""}
            </span>
          </span>
          {g.welfare && (
            <span style={{ display: "grid", placeItems: "center", gap: 3, flex: "none" }}>
              <WelfareRing welfare={g.welfare} size={54} showLabel={false} />
              {g.welfare.confidence < 100 && (
                <span className="tiny" style={{ color: "#b0790a", fontWeight: 700 }}>
                  {g.welfare.confidence}% data
                </span>
              )}
            </span>
          )}
          <Icon name="right" size={17} style={{ color: "#86a0b8", flex: "none" }} />
        </button>
      ) : (
        <button className="attn-hd" onClick={() => go(`barn/${g.barn?.id}`)}>
          <span className={`ico ${tone}`} style={{ width: 46, height: 46, borderRadius: 12 }}>
            <Icon name="barn" size={22} />
          </span>
          <span className="attn-who">
            <span className="row" style={{ gap: 8 }}>
              <span className="nm">{g.barn?.name || "Barn"}</span>
              <Pill tone={tone}>
                {g.issues.length} {g.issues.length === 1 ? "issue" : "issues"}
              </Pill>
            </span>
            <span className="sub">Building — not tied to one horse</span>
          </span>
          <Icon name="right" size={17} style={{ color: "#86a0b8", flex: "none" }} />
        </button>
      )}

      <div className="attn-issues">
        {visible.map((a) => {
          const meta = SEVERITY[a.severity] || SEVERITY.info;
          const t = a.severity === "info" ? "good" : a.severity;
          return (
            <div className="attn-issue" key={a.id + (a.at || "")}>
              <span className={`ico ${t}`}>
                <Icon name={meta.icon} size={14} />
              </span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="ttl">{a.title}</span>
                  <Pill tone={t}>{meta.label}</Pill>
                  <span className="when">{ago(a.at || a.ts, now)}</span>
                </div>
                <div className="why">{a.detail}</div>
                {a.recommendation && (
                  <div className="rec">
                    <b>Do this:</b> {a.recommendation}
                  </div>
                )}
                <div className="acts">
                  {(a.actions || []).map((x) => (
                    <button key={x.id} className="btn sm" onClick={() => onAction(x.id, a)}>
                      {x.label}
                    </button>
                  ))}
                  <button className="btn sm ghost" onClick={() => onAck(a)}>
                    <Icon name="check" size={13} /> Acknowledge
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(hidden > 0 || expanded) && g.issues.length > SHOWN && (
        <div className="attn-more">
          <button className="btn sm" onClick={onExpand}>
            {hidden > 0 ? `Show ${hidden} more on this horse` : "Show fewer"}
          </button>
        </div>
      )}
    </article>
  );
}
