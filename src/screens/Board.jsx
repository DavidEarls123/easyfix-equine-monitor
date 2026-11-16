/* ==========================================================================
   The board on the yard wall.

   A big screen by the tack room that the string reads on the way past. Nobody
   operates it, so there is nothing to press: it shows the work that matters
   now, rolls on by itself, and is legible from the other side of the yard.

   It rolls through the day's jobs a kind at a time — the farrier's list, the
   vet's list, who is swimming — and finishes on the rounds, so a groom walking
   in can see their own boxes and how far down them the morning is.

   Everything here is sized for distance rather than density — somebody should
   be able to find their own name from twenty feet without stopping.
   ========================================================================== */

import { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icons";
import Silks from "../components/Silks";
import ScrollName from "../components/ScrollName";
import { useWorld } from "../lib/store";
import { go } from "../lib/router";
import { activityOf, jobKind, JOB_KINDS, planFor } from "../lib/jobs";
import { ROUND_KINDS, describeRound, roundProgress, roundsOf } from "../lib/rounds";
import { currentYard, stallOfAnimal } from "../lib/world";

const ROLL_MS = 12000;

export default function Board() {
  const { world, now } = useWorld();
  const yard = currentYard(world);
  const plan = planFor(world, now, yard);
  const jobs = (plan.jobs || []).filter((j) => j.staffId || (j.animalIds || []).length);

  const rounds = useMemo(
    () =>
      ROUND_KINDS.flatMap((k) =>
        roundsOf(world, k.id, yard?.id)
          .filter((r) => (r.stallIds || []).length)
          .map((r) => ({ kind: k, round: r }))
      ),
    [world, yard]
  );

  // one slide per kind of work that has anything on it, then the rounds
  const slides = useMemo(() => {
    const byKind = JOB_KINDS.map((k) => ({
      kind: "jobs",
      label: k.label,
      icon: k.icon,
      colour: k.colour,
      at: k.at,
      jobs: jobs.filter((j) => j.kind === k.id),
    })).filter((s) => s.jobs.length);
    return [...byKind, ...(rounds.length ? [{ kind: "rounds", label: "The boxes" }] : [])];
  }, [jobs, rounds.length]);

  const [i, setI] = useState(0);
  const [rolling, setRolling] = useState(true);

  useEffect(() => {
    setI(0);
  }, [slides.length]);

  useEffect(() => {
    if (!rolling || slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), ROLL_MS);
    return () => clearInterval(t);
  }, [rolling, slides.length]);

  const slide = slides[Math.min(i, Math.max(0, slides.length - 1))];

  return (
    <div className="board-wrap">
      <div className="board-bar">
        <button className="btn sm" onClick={() => go("rides")}>
          <Icon name="left" size={14} /> Back to planning
        </button>
        <span className="small mute">
          A mock-up of the screen on the yard wall — it rolls through the day on its own.
        </span>
        <button className={`btn sm ${rolling ? "pri" : ""}`} onClick={() => setRolling((r) => !r)}>
          <Icon name={rolling ? "pause" : "play"} size={14} /> {rolling ? "Rolling" : "Paused"}
        </button>
      </div>

      <div className="board">
        <header className="bd-hd">
          <img className="bd-logo" src={`${import.meta.env.BASE_URL}brand/easyfix-logo.svg`} alt="EASYFIX Equine" />
          <div className="bd-title">
            <h1>{yard?.name || "Yard"}</h1>
            <span>
              {new Date(now).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>
          <div className="bd-clock nums">{new Date(now).toLocaleTimeString([], { hour12: false }).slice(0, 5)}</div>
        </header>

        {!slide ? (
          <div className="bd-empty">
            <Icon name="head" size={50} />
            <h2>Nothing planned</h2>
            <p>Assign jobs and rounds on the planner and they appear here.</p>
          </div>
        ) : (
          <>
            <div className="bd-lot">
              {slide.kind === "jobs" ? (
                <>
                  {slide.at && <span className="bd-lot-time nums">{slide.at}</span>}
                  <span className="bd-lot-name">{slide.label}</span>
                  <span className="bd-lot-n nums">
                    {slide.jobs.reduce((n, j) => n + (j.animalIds || []).length, 0)} horses
                  </span>
                </>
              ) : (
                <>
                  <span className="bd-lot-name">The boxes</span>
                  <span className="bd-lot-n nums">{rounds.length} rounds</span>
                </>
              )}
              <div className="bd-dots">
                {slides.map((sl, k) => (
                  <span key={k} className={k === i ? "on" : ""} onClick={() => setI(k)} />
                ))}
              </div>
            </div>

            {slide.kind === "jobs" ? (
              <div className="bd-rows" style={{ "--cols": slide.jobs.length > 8 ? 2 : 1 }}>
                {slide.jobs.map((j) => {
                  const kind = jobKind(j.kind);
                  const person = (world.staff || []).find((p) => p.id === j.staffId);
                  const animals = (j.animalIds || [])
                    .map((id) => world.animals.find((a) => a.id === id))
                    .filter(Boolean);
                  return (
                    <div className="bd-row" key={j.id}>
                      {animals.length === 1 ? (
                        <Silks animal={animals[0]} size={40} />
                      ) : (
                        <span className="bd-job-ico" style={{ color: kind.colour }}>
                          <Icon name={kind.icon} size={30} />
                        </span>
                      )}
                      <div className="bd-pair">
                        <ScrollName className="bd-rider">{person?.name || "Nobody yet"}</ScrollName>
                        <ScrollName className="bd-horse">
                          {animals.length ? animals.map((a) => a.name).join(", ") : "No horses on it"}
                        </ScrollName>
                      </div>
                      <span className="bd-work">{workLabel(world, j)}</span>
                      <span className="bd-box nums">
                        {animals.length === 1 ? boxLabel(world, animals[0]) : j.at || ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bd-rows" style={{ "--cols": rounds.length > 8 ? 2 : 1 }}>
                {rounds.map(({ kind, round }) => {
                  const person = (world.staff || []).find((p) => p.id === round.staffId);
                  const p = roundProgress(world, round, now);
                  return (
                    <div className="bd-row" key={`${kind.id}|${round.id || round.staffId}`}>
                      <span className="bd-job-ico" style={{ color: kind.colour }}>
                        <Icon name={kind.icon} size={30} />
                      </span>
                      <div className="bd-pair">
                        <ScrollName className="bd-rider">{person?.name || "Nobody yet"}</ScrollName>
                        <ScrollName className="bd-horse">
                          {kind.label} — {describeRound(world, round)}
                        </ScrollName>
                      </div>
                      <span className={`bd-work ${p.tone}`}>
                        {p.done}/{p.boxes} done{p.behind ? ` · ${p.behind} behind` : ""}
                      </span>
                      <span className="bd-box nums">{p.pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <footer className="bd-ft">
          <span>
            {jobs.length} jobs
            {rounds.length ? ` · ${rounds.length} rounds` : ""}
          </span>
        </footer>
      </div>
    </div>
  );
}

/** The time and anything the horse is down for, in one line. */
function workLabel(world, job) {
  const bits = [];
  if (job.at) bits.push(job.at);
  (job.activities || []).forEach((id) => {
    const tag = activityOf(world.settings, id);
    if (tag) bits.push(tag.label);
  });
  return bits.join(" · ");
}

const boxLabel = (world, animal) => {
  const st = stallOfAnimal(world, animal.id);
  if (!st) return "";
  const barn = world.barns.find((b) => b.id === st.barnId);
  return `${barn?.name || ""} ${st.name}`.trim();
};
