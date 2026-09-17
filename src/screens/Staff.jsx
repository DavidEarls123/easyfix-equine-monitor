/* ==========================================================================
   Staff: who works here, which groups they are in, and telling them things.

   A profile is deliberately three fields. A yard will not maintain more than
   that, and everything the system needs to reach someone is a name, an address
   and a number. Groups are the useful part — they are how a message gets to
   "the riders" without anyone picking twelve names out of a list.
   ========================================================================== */

import { useMemo, useState } from "react";
import Icon from "../components/Icons";
import { Card, Empty, Field, Modal, Pill, Switch, Tabs, ago } from "../components/ui";
import { useWorld } from "../lib/store";
import { go } from "../lib/router";
import { GROUPS, groupOf, messageStamp, morningMessage, planFor, ridesOf } from "../lib/staff";

export default function Staff() {
  const { world, now, actions } = useWorld();
  const staff = world.staff || [];
  const [tab, setTab] = useState("people");
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");
  const [editing, setEditing] = useState(null);
  const [composing, setComposing] = useState(false);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return staff
      .filter((p) => group === "all" || (p.groups || []).includes(group))
      .filter(
        (p) =>
          needle.length < 2 ||
          [p.name, p.email, p.phone].filter(Boolean).some((f) => f.toLowerCase().includes(needle))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [staff, q, group]);

  const counts = useMemo(
    () => Object.fromEntries(GROUPS.map((g) => [g.id, staff.filter((p) => (p.groups || []).includes(g.id)).length])),
    [staff]
  );

  return (
    <>
      <div className="page-hd">
        <div>
          <h1>Staff</h1>
          <div className="sub">
            {staff.length} people · {counts.riders || 0} riders · {(world.messages || []).length} messages sent
          </div>
        </div>
        <div className="hd-actions">
          <button className="btn" onClick={() => go("rides")}>
            <Icon name="helmet" size={15} /> Ride planning
          </button>
          <button className="btn" onClick={() => setComposing(true)}>
            <Icon name="bell" size={15} /> Send a message
          </button>
          <button className="btn pri" onClick={() => setEditing({ name: "", email: "", phone: "", groups: [] })}>
            <Icon name="plus" size={15} /> Add staff
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Tabs
          items={[
            { id: "people", label: "People", icon: "id", count: staff.length },
            { id: "sent", label: "Messages sent", icon: "bell", count: (world.messages || []).length },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "people" ? (
        <>
          <div className="filters">
            <label className="filter filter-search">
              <span>Search</span>
              <Icon name="search" size={15} />
              <input className="inp" placeholder="Name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <label className="filter">
              <span>Group</span>
              <select className="sel" value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="all">All groups ({staff.length})</option>
                {GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label} ({counts[g.id] || 0})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <Card pad={false}>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Groups</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Riding today</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <button className="lnk" onClick={() => setEditing(p)}>
                          {p.name}
                        </button>
                      </td>
                      <td>
                        <div className="row" style={{ gap: 5, justifyContent: "center", flexWrap: "wrap" }}>
                          {(p.groups || []).map((g) => (
                            <span key={g} className="grp" style={{ background: groupOf(g).colour }}>
                              {groupOf(g).label}
                            </span>
                          ))}
                          {!(p.groups || []).length && <span className="tiny mute">None</span>}
                        </div>
                      </td>
                      <td className="small mute">{p.email}</td>
                      <td className="small mute nums">{p.phone}</td>
                      <td>
                        {(p.groups || []).includes("riders") ? (
                          <Switch on={p.riding !== false} onChange={(v) => actions.updateStaff(p.id, { riding: v })} />
                        ) : (
                          <span className="tiny mute">—</span>
                        )}
                      </td>
                      <td>
                        <button className="icon-btn" title="Edit" onClick={() => setEditing(p)}>
                          <Icon name="edit" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!shown.length && <Empty icon="id">Nobody matches that.</Empty>}
          </Card>
        </>
      ) : (
        <Card title="Messages sent" sub="Recorded here rather than delivered — this build has no mail server behind it">
          {!(world.messages || []).length && <Empty icon="bell">Nothing sent yet.</Empty>}
          {(world.messages || []).map((m) => (
            <div className="alert-row" key={m.id}>
              <span className="ico good">
                <Icon name="bell" size={16} />
              </span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <b>{m.subject}</b>
                  <Pill tone="flat">{m.audience}</Pill>
                  <Pill tone="good">{m.recipients} sent</Pill>
                  {m.scheduledFor && <Pill tone="warning">Goes out {m.scheduledFor}</Pill>}
                  <span className="when">{ago(m.at, now)}</span>
                </div>
                <div className="why" style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
                <div className="tiny mute" style={{ marginTop: 4 }}>
                  {(m.channels || []).join(" · ")}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {editing && <StaffModal person={editing} onClose={() => setEditing(null)} />}
      {composing && <Compose onClose={() => setComposing(false)} />}
    </>
  );
}

/* -------------------------------- the profile ------------------------------ */

function StaffModal({ person, onClose }) {
  const { world, now, actions } = useWorld();
  const isNew = !person.id;
  const [f, setF] = useState({ name: "", email: "", phone: "", groups: [], riding: true, ...person });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (g) =>
    set("groups", f.groups.includes(g) ? f.groups.filter((x) => x !== g) : [...f.groups, g]);

  const plan = planFor(world, now);
  const mine = person.id ? ridesOf(plan, person.id) : [];

  const save = () => {
    if (!f.name.trim()) return;
    if (isNew) actions.addStaff(f);
    else actions.updateStaff(person.id, f);
    onClose();
  };

  return (
    <Modal
      title={isNew ? "Add staff" : f.name}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <button
              className="btn danger"
              style={{ marginRight: "auto" }}
              onClick={() => {
                actions.removeStaff(person.id);
                onClose();
              }}
            >
              <Icon name="trash" size={14} /> Remove
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn pri" disabled={!f.name.trim()} onClick={save}>
            <Icon name="check" size={15} /> {isNew ? "Add" : "Save"}
          </button>
        </>
      }
    >
      <div className="grid" style={{ gap: 13 }}>
        <Field label="Name">
          <input className="inp" autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 13 }}>
          <Field label="Email">
            <input className="inp" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className="inp nums" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
        </div>

        <Field label="Groups" hint="Somebody can be in as many as they actually work in.">
          <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
            {GROUPS.map((g) => (
              <button
                key={g.id}
                className={`grp-pick ${f.groups.includes(g.id) ? "on" : ""}`}
                style={f.groups.includes(g.id) ? { background: g.colour, borderColor: g.colour } : undefined}
                onClick={() => toggle(g.id)}
                type="button"
                title={g.hint}
              >
                {f.groups.includes(g.id) && <Icon name="check" size={12} />}
                {g.label}
              </button>
            ))}
          </div>
        </Field>

        {f.groups.includes("riders") && (
          <Switch on={f.riding !== false} label="Available to ride today" onChange={(v) => set("riding", v)} />
        )}

        {mine.length > 0 && (
          <div>
            <div className="tiny mute" style={{ marginBottom: 5 }}>DOWN TO RIDE TODAY</div>
            {mine.map((r) => {
              const a = world.animals.find((x) => x.id === r.animalId);
              return (
                <div className="row" key={r.id} style={{ gap: 8, padding: "3px 0" }}>
                  <Pill tone="flat">{r.lot.time}</Pill>
                  <b style={{ fontSize: 13 }}>{a ? a.name : "TBC"}</b>
                  <span className="tiny mute">{r.lot.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------ the broadcast ------------------------------ */

function Compose({ onClose, preset }) {
  const { world, now, actions } = useWorld();
  const staff = world.staff || [];
  const [audience, setAudience] = useState(preset?.audience || "riders");
  const [subject, setSubject] = useState(preset?.subject || `${world.yards[0]?.name || "Yard"} — ${messageStamp(now)}`);
  const [body, setBody] = useState(preset?.body || "");
  const [channels, setChannels] = useState({ email: true, sms: false, push: true });

  const recipients = useMemo(
    () => (audience === "all" ? staff : staff.filter((p) => (p.groups || []).includes(audience))),
    [staff, audience]
  );
  const reachable = recipients.filter((p) => (channels.email && p.email) || (channels.sms && p.phone) || channels.push);

  const send = () => {
    actions.sendMessage({
      subject: subject.trim(),
      body: body.trim(),
      audience: audience === "all" ? "Everyone" : groupOf(audience).label,
      recipients: reachable.length,
      channels: Object.entries(channels).filter(([, v]) => v).map(([k]) => k),
      to: reachable.map((p) => p.id),
    });
    onClose();
  };

  return (
    <Modal
      title="Send a message"
      wide
      onClose={onClose}
      footer={
        <>
          <span className="small mute" style={{ marginRight: "auto" }}>
            {reachable.length} of {recipients.length} reachable on the chosen channels
          </span>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn pri" disabled={!subject.trim() || !body.trim() || !reachable.length} onClick={send}>
            <Icon name="check" size={15} /> Send to {reachable.length}
          </button>
        </>
      }
    >
      <div className="grid" style={{ gap: 13 }}>
        <Field label="Who gets it">
          <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
            <button
              className={`grp-pick ${audience === "all" ? "on" : ""}`}
              onClick={() => setAudience("all")}
              type="button"
            >
              Everyone ({staff.length})
            </button>
            {GROUPS.map((g) => {
              const n = staff.filter((p) => (p.groups || []).includes(g.id)).length;
              return (
                <button
                  key={g.id}
                  className={`grp-pick ${audience === g.id ? "on" : ""}`}
                  style={audience === g.id ? { background: g.colour, borderColor: g.colour } : undefined}
                  onClick={() => setAudience(g.id)}
                  type="button"
                  disabled={!n}
                >
                  {g.label} ({n})
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Subject">
          <input className="inp" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Message">
          <textarea
            className="inp"
            rows={7}
            style={{ resize: "vertical", lineHeight: 1.6 }}
            placeholder="Frost overnight — all lots pushed back thirty minutes."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>

        <Field label="Channels">
          <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
            {["email", "sms", "push"].map((c) => (
              <Switch
                key={c}
                on={channels[c]}
                label={c === "sms" ? "SMS" : c === "push" ? "Push to the app" : "Email"}
                onChange={(v) => setChannels((x) => ({ ...x, [c]: v }))}
              />
            ))}
          </div>
        </Field>

        <div className="hint">
          Nothing leaves the browser — this build records what would have been sent, to whom, on which channels.
        </div>
      </div>
    </Modal>
  );
}

export { Compose };
