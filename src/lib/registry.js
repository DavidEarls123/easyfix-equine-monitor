/* ==========================================================================
   Simulated external horse registry.

   In the shipped product this is a lookup against the studbook / passport
   databases a yard already subscribes to (Weatherbys GSB, Horse Sport Ireland,
   FEI). Here it is a fixed table so profile creation can be demonstrated end to
   end: search a name or a microchip, import the record, assign a stall.
   ========================================================================== */

import { noise } from "./sim";

export const REGISTRY_SOURCE = "Weatherbys GSB / HSI passport index (simulated)";

// name | sex | colour | foaled | sire | dam | dam's sire | trainer
const ROWS = `
Ndaawi|Gelding|Bay|2019-03-14|Kodiac|Nashmiah|Dubawi|M. O'Neill
Honesty Policy|Gelding|Chestnut|2020-04-02|Frankel|Straight Answer|Galileo|M. O'Neill
Wodhooh|Mare|Bay|2020-02-27|Sea The Stars|Wathba|Shamardal|M. O'Neill
Romeo Coolio|Gelding|Grey|2019-05-08|Mastercraftsman|Verona Nights|Danehill Dancer|M. O'Neill
Brighterdaysahead|Mare|Bay|2019-04-19|Walk In The Park|Brighter Morning|Presenting|J. Cullen
Casheldale Lad|Gelding|Bay|2020-03-30|Getaway|Casheldale Rose|Oscar|J. Cullen
Mordor|Gelding|Dark Bay|2020-05-11|Yeats|Shadow Lands|King's Theatre|J. Cullen
Irish Point|Gelding|Bay|2018-04-06|Frankel|Irish Rookie|Dansili|J. Cullen
Ballyhale Star|Gelding|Chestnut|2021-03-22|Gleneagles|Star Of Kilkenny|Montjeu|R. Fenton
Silver Kestrel|Mare|Grey|2019-02-18|Zoffany|Kestrel Hill|Verglas|R. Fenton
Quiet Ambition|Gelding|Bay|2020-04-25|Camelot|Silent Wish|Galileo|R. Fenton
Ardnacrusha|Mare|Bay|2018-05-02|Flemensfirth|Shannon Belle|Beneficial|M. O'Neill
Nine Mile Bridge|Gelding|Brown|2019-03-09|Milan|Bridge House|Old Vic|M. O'Neill
Tempo Rossa|Mare|Chestnut|2021-02-11|Kingman|Rossini's Girl|Dubawi|R. Fenton
Fair Deceit|Gelding|Bay|2020-04-14|No Nay Never|Fairly Honest|Invincible Spirit|J. Cullen
Clonmel Rebel|Gelding|Dark Bay|2017-03-28|Presenting|Rebel Rose|Bob Back|M. O'Neill
Harbour Lights|Mare|Bay|2019-04-30|Sea The Moon|Portside|Pivotal|R. Fenton
Slaney Sovereign|Gelding|Chestnut|2020-03-05|Soldier Of Fortune|Slaney Queen|Beneficial|J. Cullen
Winter Furlong|Gelding|Grey|2021-04-08|Dark Angel|Winter Meadow|Oasis Dream|R. Fenton
Copper Beech Lane|Mare|Chestnut|2018-02-23|Mahler|Beech Lane|Old Vic|M. O'Neill
Gallant Ledger|Gelding|Bay|2020-05-19|Lope De Vega|Ledger Line|Shamardal|J. Cullen
Moyvane Boy|Gelding|Brown|2019-03-17|Jet Away|Moyvane Lass|Definite Article|M. O'Neill
Aurora Quay|Mare|Grey|2021-03-26|Havana Grey|Quayside Girl|Acclamation|R. Fenton
Redmond's Pride|Gelding|Bay|2018-04-11|Doyen|Pride Of Redmond|Saddlers' Hall|J. Cullen
Lissadell Rain|Mare|Bay|2020-02-29|Australia|Rainy Sligo|High Chaparral|R. Fenton
Turloughmore|Gelding|Chestnut|2019-05-23|Sholokhov|Turlough Hill|Flemensfirth|M. O'Neill
Cregg Woods|Gelding|Dark Bay|2021-04-03|Blue Bresil|Cregg Lady|Winged Love|J. Cullen
Kilkea Diamond|Mare|Grey|2019-01-30|Diamond Boy|Kilkea Star|Robin Des Champs|R. Fenton
Nore Valley|Gelding|Bay|2020-04-21|Walk In The Park|Nore Native|Bienamado|M. O'Neill
Ballintubber|Gelding|Brown|2018-03-13|Fame And Glory|Tubber Rose|King's Theatre|J. Cullen
Anner Mountain|Gelding|Bay|2021-05-06|Kalanisi|Anner Lass|Alflora|R. Fenton
Suir View|Mare|Chestnut|2019-04-27|Getaway|Suir Belle|Milan|M. O'Neill
Dungarvan Dawn|Mare|Bay|2020-03-18|Ocovango|Dawn Chorus|Shantou|J. Cullen
Rathgormack|Gelding|Dark Bay|2018-02-08|Yeats|Rathgormack Rose|Presenting|R. Fenton
Portlaw Prince|Gelding|Bay|2021-03-31|Sageburg|Portlaw Queen|Oscar|M. O'Neill
Comeragh Mist|Mare|Grey|2019-05-15|Kayf Tara|Comeragh Belle|Beneficial|J. Cullen
`.trim();

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
const BREEDERS = [
  "Rathbarry Stud",
  "Ballyhane Stud",
  "Glenview Stud",
  "Coolbawn Farm",
  "Knockeen Bloodstock",
  "Slievenamon Stud",
];
const OWNERS = [
  "Clonmel Bloodstock Ltd",
  "Suirvalley Racing Club",
  "K. & M. Devereux",
  "Anner Syndicate",
  "Riverstown Partnership",
  "EASYFIX Racing",
];

const digits = (seed, n) =>
  Array.from({ length: n }, (_, i) => Math.floor(noise(`${seed}|${i}`) * 10)).join("");

export const REGISTRY = ROWS.split("\n").map((line, i) => {
  const [name, sex, colour, foaled, sire, dam, damSire, trainer] = line.split("|");
  const seed = `reg|${name}`;
  const jump = ["Walk In The Park", "Getaway", "Milan", "Yeats", "Presenting", "Flemensfirth", "Kayf Tara"];
  return {
    id: `${foaled.slice(0, 4)}-IRE-${digits(seed, 5)}`,
    name,
    sex,
    colour,
    foaled,
    breed: jump.includes(sire) ? "Irish Sport Horse (NH)" : "Thoroughbred",
    sire,
    dam,
    damSire,
    trainer,
    breeder: BREEDERS[i % BREEDERS.length],
    owner: OWNERS[(i + 2) % OWNERS.length],
    markings: MARKINGS[i % MARKINGS.length],
    microchip: `985${digits(`${seed}|chip`, 12)}`,
    ueln: `372${digits(`${seed}|ueln`, 12)}`,
    height: `${15 + Math.floor(noise(`${seed}|h`) * 2)}.${Math.floor(noise(`${seed}|h2`) * 4)}hh`,
    source: REGISTRY_SOURCE,
  };
});

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
