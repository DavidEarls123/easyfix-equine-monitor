/* ==========================================================================
   Racing colours.

   These are the real registered silks, supplied as artwork rather than drawn —
   a groom recognises a horse by its colours on the box front long before they
   read the name off it, and an approximation of someone's registered colours is
   worse than none. `silks.json` is the index; the files sit in public/silks.

   A horse carries a `silks` id set on its profile. Until one is chosen it shows
   a blank set rather than guessing, because guessing is what this replaced.
   ========================================================================== */

import SILKS from "../lib/silks.json";

export const SILKS_LIST = SILKS;
export const silksById = (id) => SILKS.find((s) => s.id === id) || null;
export const silksSrc = (id) => `${import.meta.env.BASE_URL}silks/${id}.png`;

/** Owners whose registered colours we hold, matched by name on import. */
export const silksForOwner = (owner) => {
  if (!owner) return null;
  const want = String(owner).toLowerCase().replace(/[^a-z0-9]+/g, "");
  return SILKS.find((s) => !s.stock && s.label.toLowerCase().replace(/[^a-z0-9]+/g, "") === want) || null;
};

export default function Silks({ animal, id, owner, size = 44, title }) {
  // an explicit id wins, then the horse's own, then the owner's registered set
  const chosen = id || animal?.silks || silksForOwner(owner || animal?.owner)?.id || null;
  const meta = chosen ? silksById(chosen) : null;
  const label = title || meta?.label || (owner ?? animal?.owner) || "No colours set";

  if (!meta)
    return (
      <span
        className="silks-none"
        title={`${label} — no racing colours set`}
        style={{ width: size * 0.75, height: size }}
        aria-hidden="true"
      />
    );

  return (
    <img
      className="silks"
      src={silksSrc(meta.id)}
      alt={`${label} racing colours`}
      title={label}
      style={{ width: size * 0.75, height: size }}
      loading="lazy"
    />
  );
}
