/* ==========================================================================
   The string, and the passport index behind it.

   In the shipped product this is a lookup against the studbook and passport
   databases a yard already subscribes to (Weatherbys GSB, Horse Sport Ireland,
   FEI). Here it is a fixed table, so creating a profile can be demonstrated end
   to end: search a name or a microchip, import the record, assign a box.

   These are the horses actually in the yard, with their real breeding and their
   real owners. Adding one is a row: everything else — the colours it runs in,
   the owner filter, the box it stands in — follows from the owner id.

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
Comanche Brave|IRE|Colt|Brown|2022-04-05|Wootton Bassett|GB|9.2|Ishvana|IRE|Holy Roman Emperor|IRE|8.1|almuhaideb|Whisperview Trading Ltd
A Boy Named Susie|IRE|Colt|Bay|2023-04-20|Starspangledbanner|AUS|7.1|Soho Susie|IRE|Montjeu|IRE|11.9|ana-obrien|Soho Susie Partnership
Balantina|IRE|Filly|Bay|2023-04-23|Ten Sovereigns|IRE|7.6|Balankiyla|FR|Montjeu|IRE|11.9|weston-medallion-reeves|Summerhill/Lynch Bages/S Murphy
Dee's Funny Girl|IRE|Filly|Bay|2024-02-01|Cotai Glory|GB|7.2|Comical|IRE|No Nay Never|USA|7.5|medallion-weston-trommer-fowler|Tally-Ho Stud
Where Love Lives|IRE|Gelding|Bay|2024-02-03|Cotai Glory|GB|7.2|Bettys Hope|GB|Anjaal|GB|6.9|trc|Tally-Ho Stud
Shaihaan|IRE|Gelding|Chestnut|2023-03-04|Night Of Thunder|IRE|8.1|Sea Of Faith|IRE|Sea The Stars|IRE|11.2|al-shaqab|Sunderland Holdings Inc
Glyfada|IRE|Filly|Bay|2023-01-15|Camelot|GB|11.2|Princess Noor|IRE|Holy Roman Emperor|IRE|8.1|skara-glen|Barronstown Stud
Josh's Joy|IRE|Filly|Bay|2023-03-31|Wootton Bassett|GB|9.2|Learza|IRE|High Chaparral|IRE|10.7|orr-medallion-hoffman-weston|Rabbah Bloodstock Limited
Maathoor|IRE|Colt|Bay|2024-02-25|Frankel|GB|10.5|Queen's Code|IRE|Shamardal|USA|8.2|al-wasmiyah|Al Wasmiyah Farm
Miss Hong Kong|IRE|Filly|Bay|2024-02-10|Churchill|IRE|9.6|Bint Al Reem|IRE|Elusive Quality|USA|8|hoffman-medallion-shanahan-magnier|Lynch Bages Ltd & Rhinestone B/Stock
Hip Hop Chrissy|IRE|Filly|Bay|2024-03-08|Showcasing|GB|6.8|Fauvette|IRE|Dark Angel|IRE|7.6|eclipse-gaynor-gallagher|Grangemore Stud
Final Ascent|USA|Colt|Bay|2024-05-01|Galilean|USA||Another Level|USA|Emcee|USA||reeves-blake-flexford|Hidden Lake Farm LLC & 3C Stables LLC
Sake Nights|GB|Filly|Chestnut|2024-02-19|Ulysses|IRE|10.6|Exceptional|GB|Dutch Art|GB|7.7|medallion-swinbank|Cheveley Park Stud Limited
Madam Sweetie Pie|USA|Filly|Bay|2024-04-08|Frosted|USA|9.1|Suite Madam Blue|USA|Sky Kingdom|USA||lissa-mcnulty|Brad McNulty & Lissa McNulty
Yogini|IRE|Colt|Bay|2023-06-08|Waldgeist|GB|11.6|Green Room|USA|Theatrical|IRE|11.2|gillian-khosla|Vimal & Gillian Khosla
Abiding|IRE|Filly|Bay|2024-04-04|Wootton Bassett|GB|9.2|Mississippilanding|IRE|Galileo|IRE|11.4|smith-magnier-tabor-westerberg|Coolmore
Kensington Lane|IRE|Filly|Chestnut|2023-04-21|Starspangledbanner|AUS|7.1|Almost Always|IRE|Galileo|IRE|11.4|agave-medallion-trommer|Almost Always Partnership|Philip D'Amato
Happy Pharoah|IRE|Gelding|Bay|2022-03-23|American Pharoah|USA|9.6|Happily|IRE|Galileo|IRE|11.4|fw-lynch|Coolmore
Spinning Around|IRE|Filly|Bay|2023-03-28|Australia|GB|11.2|Perfect Angel|IRE|Dark Angel|IRE|7.6|magnier-oloughlin-byrne|Westerberg
Cashel Queen|IRE|Filly|Bay|2024-03-25|Supremacy|IRE|7.4|Kendannemarie|FR|Kendargent|FR|9.1|barry-fowler|Mr Ray Kileen
Keepsgettingbetter|IRE|Filly|Bay|2023-03-31|Sottsass|FR|10.4|Mascha|FR|Le Havre|IRE|10.5|henry-magnier|Premier Bloodstock
Eretria|IRE|Filly|Bay|2023-02-15|Camelot|GB|11.2|Risen Sun|GB|Shamardal|USA|8.2|skara-glen|Newstead Breeding
Emmeleia|IRE|Filly|Bay or Brown|2023-03-01|Camelot|GB|11.2|Realtra|IRE|Dark Angel|IRE|7.6|skara-glen|Barronstown Stud
Zoar|USA|Colt|Bay|2024-04-17|No Nay Never|USA|7.5|Big Brothers Pride|FR|Invincible Spirit|IRE|7.5|dalmook|Orpendale
Cleodolinda|IRE|Filly|Bay|2024-01-22|Ten Sovereigns|IRE|7.6|Eria|IRE|Zoffany|IRE|9.5|am-obrien|Whisperview Trading Ltd
South Island|IRE|Gelding|Bay|2023-01-21|Wootton Bassett|GB|9.2|Amarena|FR|Soldier Hollow|GB|11.7|p-smith-partners|M Matsushima
La Fogata|IRE|Filly|Chestnut|2023-03-19|Mehmas|IRE|6.7|Cimeara|IRE|Vocalised|USA|8.7|medallion-kisber|Capital Bloodstock
Isle Of Capri|IRE|Filly|Bay|2024-02-22|Wootton Bassett|GB|9.2|Only|JPN|Deep Impact|JPN|10.8|tabor-smith-magnier-westerberg|Coolmore
Numantia|IRE|Gelding|Grey|2023-05-18|St Mark's Basilica|FR|8.1|Bewitched|IRE|Dansili|GB|9.8|reeves-fowler|R Scarborough & Carradale
High King|IRE|Colt|Chestnut|2024-05-05|Calyx|GB|8.2|Magic America|USA|High Yield|USA|6.3|fowler-oxley-casse|R McDonald
Tradewinds|IRE|Colt|Bay|2024-04-07|Wootton Bassett|GB|9.2|Badr Al Badoor|IRE|Acclamation|GB|6.9|magnier-tabor-smith-westerberg|Mrs T Mahon
Police Gazette|USA|Gelding|Bay|2023-03-27|War Front|USA|8.3|Akatea|IRE|Shamardal|USA|8.2|joseph-allen|Mr Joseph Allen Llc
Feel Happy|IRE|Filly|Bay|2023-01-18|Wootton Bassett|GB|9.2|Simply A Star|IRE|Giant's Causeway|USA|9.6|magnier-tabor-smith|Simply A Star Syndicate
Astronomically|IRE|Filly|Bay|2023-05-13|No Nay Never|USA|7.5|Asteya|IRE|Tiger Hill|IRE|11.3|am-obrien|Whisperview Trading Ltd
Celestially|IRE|Filly|Bay|2023-03-03|Australia|GB|11.2|Moondust|IRE|Exceed And Excel|AUS|6.8|am-obrien|Moondust Partnership
Kilmeaden|IRE|Gelding|Bay|2022-03-15|Galileo|IRE|11.4|Aegean Girl|IRE|Henrythenavigator|USA|9.2|cheeky-pups|Lynch Bages Ltd|Faye Bramley
Benaki|IRE|Filly|Bay|2023-02-10|Camelot|GB|11.2|Nobilis|GB|Rock Of Gibraltar|IRE|9|skara-glen|Rjb Bloodstock
Kraar|IRE|Gelding|Bay|2024-02-07|Footstepsinthesand|GB|8|Big Little Lie|FR|Dark Angel|IRE|7.6|al-attiyah|Michael Byrne
Chosen One|IRE|Filly|Bay|2023-02-02|Dubawi|IRE|9.6|Pink Dogwood|IRE|Camelot|GB|11.2|magnier-tabor-smith|Coolmore
Transcript|IRE|Gelding|Bay|2023-05-08|Starspangledbanner|AUS|7.1|Forever Together|IRE|Galileo|IRE|11.4|smith-magnier-tabor|Coolmore
Eniac|IRE|Colt|Chestnut|2023-04-09|Siyouni|FR|8.6|Phaenomena|IRE|Galileo|IRE|11.4|p-boyle|Flaxman Stables Ireland Ltd|Brian Ellison
Alfresco|IRE|Filly|Bay|2024-03-06|No Nay Never|USA|7.5|Princess Noor|IRE|Holy Roman Emperor|IRE|8.1|brook-smith|Barronstown Stud
Kilmac Air|IRE|Filly|Chestnut|2023-01-25|Dandy Man|IRE|6.4|Lady Beware|IRE|Dragon Pulse|IRE|8.1|hugh-brunton|John Kilbane|John & Sean Quinn
Bawnmore Lass|IRE|Filly|Bay|2025-02-18|Blue Point|IRE|6.3|Silver Harbour|IRE|Galileo|IRE|11.4|bawnmore-bloodstock|Bawnmore Stud
Clonard Boy|IRE|Colt|Chestnut|2025-03-02|Ten Sovereigns|IRE|7.6|Clonard Rose|IRE|Kodiac|IRE|6.4|clonard-partnership|Clonard House Stud
Morning Chorus|IRE|Filly|Grey|2025-04-11|Havana Grey|GB|5.9|Dawn Whistle|IRE|Dark Angel|IRE|7.6|ardglass-stud|Ardglass Stud
Winter Quarter|IRE|Colt|Dark bay|2025-01-29|Wootton Bassett|GB|9.2|Quarter Light|IRE|Dubawi|IRE|9.6|bawnmore-bloodstock|Bawnmore Stud
Ballyroan Gold|IRE|Colt|Chestnut|2025-03-24|Mehmas|IRE|6.7|Golden Furrow|IRE|Exceed And Excel|AUS|6.8|keane-mcgrath|Ballyroan Farm
Hazel Covert|IRE|Filly|Bay|2025-02-07|Camelot|GB|11.2|Covert Lady|GB|Oasis Dream|GB|7.2|clonard-partnership|Clonard House Stud
Riverfield Rose|IRE|Filly|Brown|2025-05-03|No Nay Never|USA|7.5|Rose Of Tralee|IRE|Shamardal|USA|8.2|riverfield|Riverfield Stud
Two Furlongs Out|IRE|Colt|Bay|2025-04-19|Supremacy|IRE|7.4|Short Head|IRE|Acclamation|GB|6.9|two-furlong|Knockaderry Stud
Slaneyside Belle|IRE|Filly|Liver chestnut|2025-03-15|Night Of Thunder|IRE|8.1|Belle Of Enniscorthy|IRE|Montjeu|IRE|11.9|slaneyside|Slaneyside Bloodstock
Quiet Harbour|IRE|Colt|Grey|2025-02-26|Churchill|IRE|9.6|Harbour Mist|IRE|Verglas|IRE|7.1|ardglass-stud|Ardglass Stud
Fennor Cross|IRE|Colt|Bay|2025-04-02|Starspangledbanner|AUS|7.1|Crossing Point|IRE|High Chaparral|IRE|10.7|keane-mcgrath|Fennor Stud
Lilac Morning|IRE|Filly|Bay|2025-01-14|Frankel|GB|10.5|Lilac Time|GB|Dansili|GB|9.8|bawnmore-bloodstock|Bawnmore Stud
Carrick Sands|IRE|Colt|Brown|2025-05-21|Cotai Glory|GB|7.2|Sandy Shore|IRE|Kodiac|IRE|6.4|two-furlong|Knockaderry Stud
Evening Lantern|IRE|Filly|Dark bay|2025-03-08|Sea The Stars|IRE|11.2|Lantern Light|IRE|Galileo|IRE|11.4|riverfield|Riverfield Stud
`.trim();

/** Nearly all of them are in one yard; the few that are not say so. */
const HOME_TRAINER = "Donnacha Aidan O'Brien";

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

/* A yearling is this year's crop: foaled last season, not yet in training.
   They are kept apart because they live at the second yard. */
export const YEARLING_FROM = "2025-01-01";
export const isYearling = (rec) => rec.foaled >= YEARLING_FROM;
export const YEARLINGS = REGISTRY.filter(isYearling);
export const IN_TRAINING = REGISTRY.filter((r) => !isYearling(r));

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
