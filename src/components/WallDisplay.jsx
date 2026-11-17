/* ==========================================================================
   The screen at the end of the barn.

   Not a page in the app: a television on a wall that nobody operates. It
   carries eight boxes at a time, each with who is in it, what it is bred from
   and the three readings a yard actually argues about — air, water, heat.

   So it is built for one thing, being read from the far end of a barn by
   somebody walking past with a barrow. Big names, thin dividers, and nothing
   on it that needs explaining. A reading only takes a colour when it is out
   of band, because a screen where everything is coloured is a screen nobody
   looks at.
   ========================================================================== */

import Silks from "./Silks";
import ScrollName from "./ScrollName";
import { airStatus, tempStatus, waterStatus } from "../lib/status";

/** A breeding line, the way a racecard writes it: Dylan Thomas (IRE). */
const bred = (name, country) => (name ? `${name}${country ? ` (${country})` : ""}` : "—");

export default function WallDisplay({ live, now, settings, title }) {
  const eight = (live || []).slice(0, 8);
  const when = new Date(now);

  return (
    <div className="wall">
      <div className="wall-screen">
        <header className="wall-hd">
          {/* the wordmark carries a white EQUINE under it, so it sits on a
              dark plate rather than vanishing into a light grey screen */}
          <span className="wall-plate">
            <img
              className="wall-logo"
              src={`${import.meta.env.BASE_URL}brand/easyfix-logo.svg`}
              alt="EASYFIX Equine"
            />
          </span>
          <h2 className="wall-name">{title || settings?.business || "Racing"}</h2>
          <div className="wall-when">
            <span className="wall-date">
              {when.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </span>
            <span className="wall-time nums">
              {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
            </span>
          </div>
        </header>

        <div className="wall-grid">
          {eight.map(({ stall, animal, today }) => (
            <Box key={stall.id} stall={stall} animal={animal} today={today} settings={settings} />
          ))}
          {/* a barn with fewer than eight horses in it still shows eight boxes,
              because the screen is the wall and the wall does not change size */}
          {Array.from({ length: Math.max(0, 8 - eight.length) }, (_, i) => (
            <article className="wall-card empty" key={`empty${i}`}>
              <h3>Empty box</h3>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function Box({ stall, animal, today, settings }) {
  const water = waterStatus(today, settings);
  const temp = tempStatus(today?.tempNow, settings);
  const air = airStatus(today?.airNow, settings, today?.nh3Now);

  return (
    <article className="wall-card">
      <h3>
        <ScrollName>{animal?.name || "Empty box"}</ScrollName>
      </h3>

      <div className="wall-mid">
        <dl className="wall-bred">
          <div>
            <dt>Sire</dt>
            <dd>{bred(animal?.sire, animal?.sireCountry)}</dd>
          </div>
          <div>
            <dt>Dam</dt>
            <dd>{bred(animal?.dam, animal?.damCountry)}</dd>
          </div>
          <div>
            <dt>Dam's sire</dt>
            <dd>{bred(animal?.damSire, animal?.damSireCountry)}</dd>
          </div>
        </dl>
        <span className="wall-silks">
          <Silks animal={animal} size={52} />
        </span>
      </div>

      <div className="wall-reads">
        <Read label="AQI" value={today?.airNow != null ? `${Math.round(today.airNow)}%` : "—"} st={air} />
        {/* a meter that has not reported says so: a hard 0 on a wall reads as
            a horse that has not drunk, which is a different emergency */}
        <Read label="Lts" value={today && !today.offline ? `${today.intakeL}` : "—"} st={water} />
        <Read label="Tmp" value={today?.tempNow != null ? `${today.tempNow}°` : "—"} st={temp} />
      </div>
    </article>
  );
}

/** One of the three figures. The label stays put so the three line up. */
function Read({ label, value, st }) {
  return (
    <div className={`wall-read ${st.tone}`} title={st.hint}>
      <span className="wall-read-v nums">{value}</span>
      <span className="wall-read-l">{label}</span>
    </div>
  );
}
