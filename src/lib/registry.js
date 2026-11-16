/* ==========================================================================
   The string, and the passport index behind it.

   In the shipped product this is a lookup against the studbook and passport
   databases a yard already subscribes to (Weatherbys GSB, Horse Sport Ireland,
   FEI). Here it is a fixed table, so creating a profile can be demonstrated end
   to end: search a name or a microchip, import the record, assign a box.

   These are the horses actually in the yard, with their real breeding and
   their real owners — a National Hunt string, so geldings and mares in work
   rather than a sales ring full of yearlings. Adding one is a row: everything
   else — the colours it runs in, the owner filter, the box it stands in —
   follows from the owner id.

   A horse's colours are not held here. They belong to the owner (see owners.js)
   because that is where they are registered, and because several of these
   owners carry the same set.
   ========================================================================== */

import { noise } from "./sim";
import { OWNERS, ownerById } from "./owners";

export const REGISTRY_SOURCE = "Weatherbys GSB / HSI passport index (simulated)";

/* name | country | sex | colour | foaled | sire | sire cty | sire dist |
   dam | dam cty | dam's sire | cty | dist | owner id | breeder | trainer? */
const ROWS = `
Fiveonefive|IRE|Gelding|Bay|2018-05-19|Dylan Thomas|IRE|10|Jenmarie|IRE|Dr Massini|IRE|12.6|giannini-lagan|Joe & Mel Power
Golden Joy|FR|Gelding|Bay|2019-05-02|Conillon|GER||Erbalonga|FR|Lost World|IRE|7.9|mark-hatton|Jean-Marc Bourneuf
Kashchei|GB|Gelding|Bay|2020-04-17|Telescope|IRE|11.1|Leblon|IRE|Dansili|GB|9.8|six-degenerates|Swanbridge Bloodstock Ltd
Blue Reed|FR|Gelding|Bay|2019-04-10|Brave Mansonnien|FR||Carambole|FR|Astarabad|USA|12.5|rocket|Dr V Bernard Stoffel
Affinity Rock|IRE|Mare|Bay|2020-04-05|Affinisea|IRE|12.1|Hill Rock|IRE|Beneficial|GB|13.7|friends-low-places|Noel Collins
Hi Ho Idaho|IRE|Gelding|Bay|2021-05-10|Idaho|IRE||Miss Opera|GB|Alflora|IRE|13.4|wise-venture|Joseph Smiddy
Brandt|IRE|Gelding|Bay|2018-05-04|Affinisea|IRE|12.1|Bean Ki Moon|IRE|King's Theatre|IRE|11.6|del-boy|Tim Hegarty
Impero|IRE|Gelding|Bay|2019-05-01|Zoffany|IRE|9.5|On A Pedestal|IRE|Montjeu|IRE|11.9|angie-osullivan|Mrs Ann Marie O'Brien
Local Resident|IRE|Gelding|Bay|2022-04-22|Shirocco|GER|12.5|Bean Ki Moon|IRE|King's Theatre|IRE|11.6|wise-venture|Russet House Farm Ltd
Sporting Glance|FR|Gelding|Bay|2019-03-07|Coastal Path|GB||Analifet|FR|Califet|FR|12.2|kevin-mcconnell|Mme Sarah Faulks & Mr Nigel Faulks
Secret Rock|IRE|Gelding|Bay|2019-03-21|Fascinating Rock|IRE|9.4|So Secret|IRE|Barathea|IRE|9.8|country-ways|Maurice Regan
Chantilly Wings|IRE|Gelding|Bay|2021-04-09|Wings Of Eagles|FR|9.3|Conors Yeats|IRE|Yeats|IRE|13.1|john-lynch|Ms M Kavanagh
Codger's Rock|IRE|Gelding|Bay|2021-05-10|Fascinating Rock|IRE|9.4|Codger's Gift|IRE|Footstepsinthesand|GB|8|breslin-larkin|John Breslin
Coded Welder|IRE|Gelding|Bay|2019-03-10|Lucky Speed|IRE||Loreley|IRE|Oscar|IRE|13.3|del-boy|Kenneth Parkhill
Keep Em Quite|IRE|Gelding|Bay|2021-04-04|Jet Away|GB|12.9|Wall Of Silence|IRE|Lahib|USA|8.8|william-devereux|W Devereux
Shing Shang Lily|IRE|Mare|Grey|2021-04-27|Yeats|IRE|13.1|Lily Shing Shang|GB|Spectrum|IRE|9.5|finnegan-osullivan|Donnie Power
Drumconnor Hill|IRE|Gelding|Bay|2021-05-02|Poet's Word|IRE|9.3|Royal Bride|GB|Kayf Tara|GB|13.7|feathery-step|B & N McGoldrick
Grace's Legacy|IRE|Filly|Bay|2022-04-13|Raven's Pass|USA|8.6|Asgardella|IRE|Duke Of Marmalade|IRE|10.8|lucie-glynn|Chris Glynn
Katie Daniels|IRE|Mare|Bay|2019-03-05|Walk In The Park|IRE|13.1|Alleygrove Lass|IRE|Alderbrook|GB|15|barry-logan|Alan Loughlin
Tanga Mugi|IRE|Filly|Bay|2022-04-02|Sea Moon|GB|7|Fassadinan|IRE|Famous Name|GB|9.9|kevin-mcconnell|Gerard Leahy
The Farmers Bar|IRE|Gelding|Chestnut|2022-04-09|Old Persian|GB||Alta Definizione|IRE|Hawk Wing|USA|9.6|joe-gregg|Mr Peter Murphy
Jazzy Matty|FR|Gelding|Chestnut|2019-04-16|Doctor Dino|FR|10.8|Robbe|FR|Video Rock|FR|12.1|top-man|J, C & B Magnien
Fair Damsel|IRE|Mare|Chestnut|2018-03-08|Dragon Pulse|IRE|8.1|Placere|IRE|Noverre|USA|7.8|we-win|Richard Brabazon
Osco Flyer|IRE|Gelding|Bay|2022-04-20|Affinisea|IRE|12.1|Osco Mosco|IRE|Oscar|IRE|13.3|cian-collins|Nelius O'Keeffe
Crossing The Bar|IRE|Gelding|Bay|2017-03-18|Poet's Voice|GB|8.4|Ship's Biscuit|GB|Tiger Hill|IRE|11.3|salvo-giannini|Philip Newton
Redwood Queen|IRE|Mare|Bay|2017-04-16|Mahler|GB||Blackberry Lass|IRE|King's Theatre|IRE|11.6|del-boy|Clare A Kehoe
Go Loud|IRE|Gelding|Bay|2021-04-26|Gamut|IRE|10.7|Trending Now|IRE|Aizavoski|IRE||adam-lord|R J O'Brien
Must Meet Cecil|IRE|Gelding|Grey|2018-05-03|Mustameet|USA|12.1|Jaya Bella|IRE|Tikkanen|USA||tb-sheridan|Robert Honner
Torquay Road|IRE|Gelding|Bay|2019-02-02|No Risk At All|FR|12.5|Chattleya|FR|Desert King|IRE|10.3|kevin-mcconnell|Gary Aspell
Jetaway Nana|IRE|Mare|Bay|2020-03-15|Jet Away|GB|12.9|Arinana|IRE|Flemensfirth|USA|15.7|mark-hatton|Kevin Doyle
`.trim();

/** Nearly all of them are in one yard; the few that are not say so. */
const HOME_TRAINER = "Cian Collins";

/* A passport index does not stop at the horses that are still in work, and
   neither does this one. A horse that has died stays in the index — it has a
   history and the yard may still be asked about it — but it is not a horse
   you can put in a box, so it is marked here and the yard seeder skips it. */
const DECEASED = ["Crossing The Bar"];

const MARKINGS = [
  "Star",
  "Star and snip, near-fore sock",
  "Blaze, two hind socks",
  "White stripe, off-hind sock",
  "Small star, no other markings",
  "Snip, near-hind coronet",
  "Broad blaze, four white feet",
  "No white markings",
];

const digits = (seed, n) =>
  Array.from({ length: n }, (_, i) => Math.floor(noise(`${seed}|${i}`) * 10)).join("");

const dist = (f) => (f ? `${f}f` : null);

export const REGISTRY = ROWS.split("\n").map((line, i) => {
  const [
    name, country, sex, colour, foaled,
    sire, sireCountry, sireDist,
    dam, damCountry,
    damSire, damSireCountry, damSireDist,
    ownerId, breeder, trainer,
  ] = line.split("|");
  const seed = `reg|${name}`;
  const owner = ownerById(ownerId);
  return {
    id: `${foaled.slice(0, 4)}-${country}-${digits(seed, 5)}`,
    name,
    country,
    sex,
    colour,
    foaled,
    breed: "Thoroughbred",
    sire,
    sireCountry,
    sireDist: dist(sireDist),
    dam,
    damCountry,
    damSire,
    damSireCountry,
    damSireDist: dist(damSireDist),
    trainer: trainer || HOME_TRAINER,
    deceased: DECEASED.includes(name),
    breeder,
    ownerId,
    owner: owner?.name || ownerId,
    markings: MARKINGS[i % MARKINGS.length],
    microchip: `985${digits(`${seed}|chip`, 12)}`,
    ueln: `372${digits(`${seed}|ueln`, 12)}`,
    height: `${15 + Math.floor(noise(`${seed}|h`) * 2)}.${Math.floor(noise(`${seed}|h2`) * 4)}hh`,
    source: REGISTRY_SOURCE,
  };
});

/* Two horses with the same name, or a horse pointing at an owner that does not
   exist, are both the kind of mistake that is invisible until somebody is
   looking at the wrong animal. Say so at load rather than at the box door. */
export const REGISTRY_PROBLEMS = (() => {
  const seen = new Map();
  const out = [];
  REGISTRY.forEach((r) => {
    const k = r.name.toLowerCase();
    if (seen.has(k)) out.push(`${r.name} is listed twice`);
    seen.set(k, true);
    if (!OWNERS.some((o) => o.id === r.ownerId)) out.push(`${r.name} has no owner called "${r.ownerId}"`);
  });
  return out;
})();

if (REGISTRY_PROBLEMS.length && typeof console !== "undefined")
  console.warn("Passport index:\n  " + REGISTRY_PROBLEMS.join("\n  "));

export const byName = (name) => REGISTRY.find((r) => r.name.toLowerCase() === String(name).toLowerCase());

/** Free-text search over name, microchip, sire and dam — as the yard would use it. */
export function searchRegistry(q) {
  const s = String(q || "").trim().toLowerCase();
  if (s.length < 2) return [];
  return REGISTRY.filter((r) =>
    [r.name, r.microchip, r.ueln, r.sire, r.dam, r.trainer].some((f) => String(f).toLowerCase().includes(s))
  ).slice(0, 12);
}

/** Age in years at `now`, the way a passport reads it. */
export function ageOf(foaled, now = Date.now()) {
  if (!foaled) return null;
  const born = new Date(foaled).getTime();
  return Math.max(0, Math.floor((now - born) / (365.25 * 86400000)));
}
