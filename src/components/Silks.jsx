/* ==========================================================================
   Racing colours.

   A groom recognises a horse by its colours on the box front long before they
   read the name off it, so these are the real registered sets rather than a
   decoration — and an approximation of someone's registered colours is worse
   than none.

   Colours belong to an owner, not to a horse: every horse an owner has runs in
   the same set, and several owners here carry the same set through a
   partnership. So a horse resolves its colours through its owner (owners.js),
   and only overrides that when its profile names a set of its own.

   Two kinds of set exist side by side. A yard that holds the artwork keeps it
   as a PNG in public/silks named after the set id — that always wins. Anything
   else is drawn from a spec by SilksArt. Until a horse has either, it shows a
   blank set rather than a guess, because guessing is what this replaced.
   ========================================================================== */

import SILKS from "../lib/silks.json";
import { silksSet } from "../lib/silks-sets";
import { ownerOf, silksOf } from "../lib/owners";
import SilksArt from "./SilksArt";

export const SILKS_LIST = SILKS;
export const silksById = (id) => SILKS.find((s) => s.id === id) || null;
export const silksSrc = (id) => `${import.meta.env.BASE_URL}silks/${id}.png`;

/** Owners whose artwork we hold, matched by name on import. */
export const silksForOwner = (owner) => {
  if (!owner) return null;
  const want = String(owner).toLowerCase().replace(/[^a-z0-9]+/g, "");
  return SILKS.find((s) => !s.stock && s.label.toLowerCase().replace(/[^a-z0-9]+/g, "") === want) || null;
};

export default function Silks({ animal, id, owner, size = 44, title }) {
  // an explicit id wins, then the horse's own set, then the one its owner carries
  const art = id ? silksById(id) : animal?.silks ? silksById(animal.silks) : null;
  const drawn = id ? silksSet(id) : animal ? silksOf(animal) : null;
  const label =
    title ||
    art?.label ||
    drawn?.label ||
    ownerOf(animal)?.name ||
    owner ||
    animal?.owner ||
    "No colours set";

  if (art)
    return (
      <img
        className="silks"
        src={silksSrc(art.id)}
        alt={`${label} racing colours`}
        title={label}
        style={{ width: size * 0.75, height: size }}
        loading="lazy"
      />
    );

  if (drawn) return <SilksArt spec={drawn} size={size} title={label} />;

  return (
    <span
      className="silks-none"
      title={`${label} — no racing colours set`}
      style={{ width: size * 0.75, height: size }}
      aria-hidden="true"
    />
  );
}
