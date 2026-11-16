/* ==========================================================================
   The owners on the books.

   An owner is a record rather than a line of text on a horse, for two reasons
   the yard cares about every day.

   The first is filtering. "Show me everything the Del Boy Partnership has" has
   to mean the same thing whether the horse was entered as "Del Boy
   Partnership" or "Del Boy Partnership ". A horse points at an owner by id, so
   a filter is an identity check and the count beside it is right.

   The second is colours. Colours are registered to an owner, and every horse
   that owner has runs in them — so the set lives on the owner, not the horse.
   Several owners can carry the same registered set, and in this string two do:
   the Giannini yellow and green star runs under both the Giannini/Lagan
   partnership and Salvo Giannini's own name. A horse may still override its
   own set, which is what the field on its profile is for.

   Four owners here have more than one horse in the yard — Del Boy and Kevin
   McConnell have three each, Wise Venture and Mark Hatton two — so a groom
   reading a set off a box front will see the same colours again down the barn.
   ========================================================================== */

import { silksSet } from "./silks-sets";

export const OWNERS = [
  { id: "giannini-lagan", name: "Salvatore Giannini & Tony Lagan", silks: "giannini" },
  { id: "salvo-giannini", name: "Salvo Giannini", silks: "giannini" },
  { id: "mark-hatton", name: "Mark Hatton", silks: "hatton" },
  { id: "six-degenerates", name: "Six Degenerates Syndicate", silks: "six-degenerates" },
  { id: "rocket", name: "Rocket Syndicate", silks: "rocket" },
  { id: "friends-low-places", name: "Friends In Low Places Syndicate", silks: "friends-low-places" },
  { id: "wise-venture", name: "Wise Venture Partnership", silks: "wise-venture" },
  { id: "del-boy", name: "Del Boy Partnership", silks: "del-boy" },
  { id: "angie-osullivan", name: "Angie O'Sullivan", silks: "osullivan" },
  { id: "kevin-mcconnell", name: "Kevin McConnell", silks: "mcconnell" },
  { id: "country-ways", name: "Country Ways Syndicate", silks: "country-ways" },
  { id: "john-lynch", name: "John M Lynch", silks: "john-lynch" },
  { id: "breslin-larkin", name: "John Breslin & Mike Larkin", silks: "breslin-larkin" },
  { id: "william-devereux", name: "William Devereux", silks: "william-devereux" },
  { id: "finnegan-osullivan", name: "Paul A Finnegan & Michael C Finnegan & Pat O'Sullivan", silks: "finnegan-osullivan" },
  { id: "feathery-step", name: "Feathery Step Syndicate", silks: "feathery-step" },
  { id: "lucie-glynn", name: "Lucie Glynn", silks: "lucie-glynn" },
  { id: "barry-logan", name: "Barry Logan", silks: "barry-logan" },
  { id: "joe-gregg", name: "Joe Gregg", silks: "joe-gregg" },
  { id: "top-man", name: "Top Man Racing Syndicate", silks: "top-man" },
  { id: "we-win", name: "We Win Racing Syndicate", silks: "we-win" },
  { id: "cian-collins", name: "Cian Collins", silks: "cian-collins" },
  { id: "adam-lord", name: "Adam Lord", silks: "adam-lord" },
  { id: "tb-sheridan", name: "T B Sheridan", silks: "tb-sheridan" },
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
 * other horses in the yard will look the same on the racecourse.
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
