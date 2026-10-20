/* ==========================================================================
   The owners on the books.

   An owner is a record rather than a line of text on a horse, for two reasons
   the yard cares about every day.

   The first is filtering. "Show me everything Skara Glen has" has to mean the
   same thing whether the horse was entered as "Skara Glen Stables" or
   "Skara Glen Stables ". A horse points at an owner by id, so a filter is an
   identity check and the count beside it is right.

   The second is colours. Colours are registered to an owner, and every horse
   that owner has runs in them — so the set lives on the owner, not the horse.
   Several owners can carry the same registered set through a partnership, and
   in this string three do: the Medallion/Weston claret and navy runs under
   three different partnership names, the Reeves green diamond under two, and
   the Fowler blue and white cross under two. A horse may still override its
   own set, which is what the field on its profile is for.
   ========================================================================== */

import { silksSet } from "./silks-sets";

export const OWNERS = [
  { id: "almuhaideb", name: "Muhaideb A Almuhaideb", silks: "almuhaideb" },
  { id: "ana-obrien", name: "Ana O'Brien", silks: "ana-obrien" },
  { id: "weston-medallion-reeves", name: "S I Weston/Medallion Racing LLC/Reeves T'bred/L A McNulty", silks: "weston-pt" },
  { id: "medallion-weston-trommer-fowler", name: "Medallion, Weston, Trommer, Fowler", silks: "medallion" },
  { id: "trc", name: "The Thoroughbred Racing Corporation Ltd", silks: "trc" },
  { id: "al-shaqab", name: "Al Shaqab Racing", silks: "al-shaqab" },
  { id: "skara-glen", name: "Skara Glen Stables", silks: "skara-glen" },
  { id: "orr-medallion-hoffman-weston", name: "Orr, Medallion, Hoffman & Weston", silks: "orr" },
  { id: "al-wasmiyah", name: "Al Wasmiyah Stud", silks: "al-wasmiyah" },
  { id: "hoffman-medallion-shanahan-magnier", name: "Hoffman, Medallion, Shanahan & Magnier", silks: "hoffman" },
  { id: "eclipse-gaynor-gallagher", name: "Eclipse T'bred Partners/Gaynor Bloodstock LLC/F Gallagher", silks: "eclipse" },
  { id: "reeves-blake-flexford", name: "ReevesTB Racing, K Blake, Flexford P'ners", silks: "reeves" },
  { id: "medallion-swinbank", name: "MedallionSwinbank BTypeMcStantonWeston", silks: "medallion" },
  { id: "lissa-mcnulty", name: "Lissa Ann McNulty", silks: "mcnulty" },
  { id: "gillian-khosla", name: "Ms Gillian Khosla", silks: "khosla" },
  { id: "smith-magnier-tabor-westerberg", name: "Derrick Smith/Mrs John Magnier/Michael Tabor/Westerberg", silks: "coolmore-purple" },
  { id: "agave-medallion-trommer", name: "Agave Racing Stable, Medallion Racing & Evan Trommer", silks: "agave" },
  { id: "fw-lynch", name: "F W Lynch", silks: "lynch" },
  { id: "magnier-oloughlin-byrne", name: "Mrs M V Magnier, Mrs O'Loughlin, Mrs Byrne", silks: "magnier-navy" },
  { id: "barry-fowler", name: "Barry Fowler", silks: "fowler" },
  { id: "henry-magnier", name: "Mrs Richard Henry & Mrs John Magnier", silks: "henry-magnier" },
  { id: "dalmook", name: "Sheikh Hamed Dalmook Al Maktoum", silks: "dalmook" },
  { id: "am-obrien", name: "Mrs A M O'Brien", silks: "am-obrien" },
  { id: "p-smith-partners", name: "P Smith, Magnier, Tabor, D Smith, Westerberg", silks: "smith-magnier" },
  { id: "medallion-kisber", name: "Medallion Racing, Kisber Et Al", silks: "medallion" },
  { id: "tabor-smith-magnier-westerberg", name: "M Tabor & D Smith & Mrs J Magnier & Westerberg", silks: "tabor-smith" },
  { id: "reeves-fowler", name: "Reeves Thoroughbred Racing & Barry Fowler", silks: "reeves" },
  { id: "fowler-oxley-casse", name: "Fowler, Oxley, Casse, Berk & Romano", silks: "fowler" },
  { id: "magnier-tabor-smith-westerberg", name: "Mrs John Magnier/Michael Tabor/Derrick Smith/Westerberg", silks: "navy" },
  { id: "joseph-allen", name: "Joseph Allen LLC", silks: "allen" },
  { id: "magnier-tabor-smith", name: "Mrs John Magnier & Michael Tabor & Derrick Smith", silks: "navy" },
  { id: "cheeky-pups", name: "The Cheeky Pups", silks: "cheeky-pups" },
  { id: "al-attiyah", name: "Abdullah Fahad Al Attiyah", silks: "al-attiyah" },
  { id: "smith-magnier-tabor", name: "Derrick Smith & Mrs John Magnier & Michael Tabor", silks: "coolmore-purple" },
  { id: "p-boyle", name: "P Boyle", silks: "boyle" },
  { id: "brook-smith", name: "Brook T Smith", silks: "brook-smith" },
  { id: "hugh-brunton", name: "Hugh Brunton", silks: "brunton" },

  /* The yearling yard. These owners are invented, as are their colours — the
     yard is a demonstration of a second string rather than a real one. */
  { id: "bawnmore-bloodstock", name: "Bawnmore Bloodstock", silks: "bawnmore-bloodstock" },
  { id: "clonard-partnership", name: "The Clonard Partnership", silks: "clonard" },
  { id: "ardglass-stud", name: "Ardglass Stud", silks: "ardglass" },
  { id: "keane-mcgrath", name: "Keane & McGrath", silks: "keane-mcgrath" },
  { id: "riverfield", name: "Riverfield Racing Club", silks: "riverfield" },
  { id: "two-furlong", name: "The Two Furlong Syndicate", silks: "two-furlong" },
  { id: "slaneyside", name: "Slaneyside Bloodstock", silks: "slaneyside" },
];

export const ownerById = (id) => OWNERS.find((o) => o.id === id) || null;

/** An owner matched on the name as written, for anything imported as text. */
const key = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
export const ownerByName = (name) => OWNERS.find((o) => key(o.name) === key(name)) || null;

/** The owner a horse belongs to, however it was recorded. */
export const ownerOf = (animal) =>
  (animal?.ownerId && ownerById(animal.ownerId)) || ownerByName(animal?.owner) || null;

/** The set of colours a horse runs in: its own if it overrides, else its owner's. */
export const silksOf = (animal) => {
  const own = animal?.silks ? silksSet(animal.silks) : null;
  if (own) return own;
  const owner = ownerOf(animal);
  return owner ? silksSet(owner.silks) : null;
};

/**
 * Who else carries this. Colours are registered to an owner and shared across
 * partnerships, so a groom reading a set off a box front wants to know which
 * other horses in the yard will look the same coming up the gallop.
 */
export function stablemates(animals, animal) {
  const set = silksOf(animal);
  const owner = ownerOf(animal);
  const sameOwner = owner ? animals.filter((a) => a.id !== animal.id && ownerOf(a)?.id === owner.id) : [];
  const sameSilks = set
    ? animals.filter((a) => a.id !== animal.id && silksOf(a)?.id === set.id)
    : [];
  return { owner, set, sameOwner, sameSilks };
}

/** Every owner with a horse in the list, with how many, for a filter. */
export function ownersOf(animals) {
  const counts = new Map();
  (animals || []).forEach((a) => {
    const o = ownerOf(a);
    if (!o) return;
    counts.set(o.id, (counts.get(o.id) || 0) + 1);
  });
  return OWNERS.filter((o) => counts.has(o.id))
    .map((o) => ({ ...o, count: counts.get(o.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
