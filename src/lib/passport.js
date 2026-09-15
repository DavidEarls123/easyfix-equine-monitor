/* ==========================================================================
   Passport lookup: where a horse's identity comes from.

   The yard should never type a passport in by hand, so profile creation is a
   search against an external index. Which index is a customer decision, and
   every credible one is a commercial subscription rather than an open API, so
   this is a provider interface with the simulated table as the offline default.

   ── What is actually available in the real world ─────────────────────────────

   Racing Post does not publish a self-serve API. Its data reaches third parties
   through a commercial licence (Racing Post Data), so "pull it from the Racing
   Post" means signing a data agreement and then pointing `custom` below at
   whatever endpoint they give you. The providers listed here are the ones a
   yard can realistically subscribe to:

     theracingapi  The Racing API — UK & IRE racecards, results, horse profiles
                   and pedigrees over REST. The closest thing to a self-serve
                   Racing-Post-shaped feed. Basic auth, paid tiers.
     weatherbys    Weatherbys — General Stud Book and racing administration
                   data. The authority for thoroughbred breeding in GB & IRE.
     ced           UK Central Equine Database — the statutory record behind
                   equine passports, searchable by microchip. Access is granted
                   to authorised bodies rather than sold.
     hsi           Horse Sport Ireland — sport horse passports and breeding.
     fei           FEI Database — horses registered for international sport.
     custom        Anything else, including your own licensed Racing Post feed
                   or an internal system.

   ── The part that matters for deployment ────────────────────────────────────

   None of these should be called straight from this bundle. An API key in a
   browser is a published API key, and every one of these hosts will refuse a
   cross-origin request from a yard's domain anyway. So `baseUrl` is expected to
   point at a small server of your own that holds the credential and forwards
   the query. `directBrowser` exists to let someone try it without a proxy, and
   says plainly in the UI what it costs them.
   ========================================================================== */

import { REGISTRY, REGISTRY_SOURCE, searchRegistry as searchSimulated } from "./registry";

export const PROVIDERS = {
  simulated: {
    id: "simulated",
    label: "Simulated passport index",
    blurb: "The demo's own fixed table of invented horses. No network, no key.",
    needsKey: false,
    needsUrl: false,
    source: REGISTRY_SOURCE,
  },
  theracingapi: {
    id: "theracingapi",
    label: "The Racing API",
    blurb: "UK & IRE racecards, results and pedigrees over REST. Paid subscription, basic auth.",
    docs: "https://www.theracingapi.com",
    needsKey: true,
    needsUrl: true,
    defaultUrl: "https://api.theracingapi.com/v1",
    path: (q) => `/horses/search?name=${encodeURIComponent(q)}`,
    pick: (json) => json?.horses || json?.results || json?.data || [],
  },
  weatherbys: {
    id: "weatherbys",
    label: "Weatherbys (General Stud Book)",
    blurb: "The thoroughbred studbook authority for GB & IRE. Commercial agreement required.",
    docs: "https://www.weatherbys.co.uk",
    needsKey: true,
    needsUrl: true,
    defaultUrl: "",
    path: (q) => `/horses?search=${encodeURIComponent(q)}`,
    pick: (json) => json?.horses || json?.items || json?.data || [],
  },
  ced: {
    id: "ced",
    label: "UK Central Equine Database",
    blurb: "The statutory passport record. Microchip lookups. Access granted to authorised bodies.",
    docs: "https://www.equineregister.co.uk",
    needsKey: true,
    needsUrl: true,
    defaultUrl: "",
    path: (q) => `/equine?identifier=${encodeURIComponent(q)}`,
    pick: (json) => json?.equines || json?.results || json?.data || [],
  },
  hsi: {
    id: "hsi",
    label: "Horse Sport Ireland",
    blurb: "Irish sport horse passports and breeding records.",
    docs: "https://www.horsesportireland.ie",
    needsKey: true,
    needsUrl: true,
    defaultUrl: "",
    path: (q) => `/horses?q=${encodeURIComponent(q)}`,
    pick: (json) => json?.horses || json?.data || [],
  },
  fei: {
    id: "fei",
    label: "FEI Database",
    blurb: "Horses registered for FEI international competition.",
    docs: "https://data.fei.org",
    needsKey: true,
    needsUrl: true,
    defaultUrl: "",
    path: (q) => `/Horse/Search?name=${encodeURIComponent(q)}`,
    pick: (json) => json?.Horses || json?.results || json?.data || [],
  },
  custom: {
    id: "custom",
    label: "Custom endpoint or licensed feed",
    blurb:
      "Your own proxy, or a licensed feed such as Racing Post Data. Expects GET {baseUrl}/search?q=… returning a JSON array or { results: [...] }.",
    needsKey: true,
    needsUrl: true,
    defaultUrl: "",
    path: (q) => `/search?q=${encodeURIComponent(q)}`,
    pick: (json) => (Array.isArray(json) ? json : json?.results || json?.data || json?.horses || []),
  },
};

export const DEFAULT_PASSPORT = {
  provider: "simulated",
  baseUrl: "",
  apiKey: "",
  directBrowser: false,
  // fall back to the simulated table when a live lookup returns nothing, so a
  // half-configured provider never leaves the operator unable to add a horse
  fallbackToSimulated: true,
};

/* ------------------------------ normalisation ----------------------------- */

const FIELDS = {
  name: ["name", "horse_name", "horseName", "Name", "fullName"],
  sex: ["sex", "gender", "Sex", "sexCode"],
  colour: ["colour", "color", "Colour", "coatColour"],
  foaled: ["foaled", "foaling_date", "dob", "dateOfBirth", "DateOfBirth", "birthDate"],
  sire: ["sire", "sire_name", "sireName", "Sire"],
  dam: ["dam", "dam_name", "damName", "Dam"],
  damSire: ["damSire", "dam_sire", "damsire", "broodmareSire"],
  breed: ["breed", "Breed", "studbook"],
  trainer: ["trainer", "trainer_name", "Trainer"],
  owner: ["owner", "owner_name", "Owner"],
  breeder: ["breeder", "Breeder"],
  markings: ["markings", "Markings", "description"],
  microchip: ["microchip", "chip", "microchipNumber", "Microchip"],
  ueln: ["ueln", "UELN", "passportNumber", "passport"],
  height: ["height", "Height"],
  id: ["id", "horse_id", "horseId", "uid", "Id"],
};

const first = (row, keys) => {
  for (const k of keys) if (row?.[k] != null && row[k] !== "") return row[k];
  return "";
};

/** Whatever the provider returns, reshaped into the record the app expects. */
export function normaliseRecord(row, providerId) {
  const out = {};
  for (const [field, keys] of Object.entries(FIELDS)) out[field] = first(row, keys);
  const date = String(out.foaled || "");
  return {
    ...out,
    id: String(out.id || out.microchip || out.ueln || out.name || Math.random().toString(36).slice(2)),
    name: String(out.name || "").trim(),
    foaled: /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : date ? `${date}`.slice(0, 10) : "",
    source: `${PROVIDERS[providerId]?.label || providerId} (live lookup)`,
    raw: row,
  };
}

/* -------------------------------- searching ------------------------------- */

export class PassportError extends Error {
  constructor(message, kind) {
    super(message);
    this.kind = kind;
  }
}

/**
 * Search the configured provider. Always async — a real index is a network
 * call, and building the UI around that from the start is why swapping the
 * provider does not touch the screens.
 */
export async function searchPassports(q, config = DEFAULT_PASSPORT, { signal } = {}) {
  const query = String(q || "").trim();
  if (query.length < 2) return { records: [], source: sourceLabel(config), live: false };

  const p = PROVIDERS[config.provider] || PROVIDERS.simulated;
  if (p.id === "simulated") {
    return { records: searchSimulated(query), source: p.source, live: false };
  }

  try {
    return await liveSearch(query, config, p, signal);
  } catch (e) {
    // an abort is the next keystroke, not a failure
    if (e?.name === "AbortError") throw e;
    if (!config.fallbackToSimulated) throw e;
    // a half-configured provider should never leave the yard unable to add a
    // horse — hand back the offline table and say why
    return {
      records: searchSimulated(query),
      source: PROVIDERS.simulated.source,
      live: false,
      fellBack: true,
      warning: e.message,
    };
  }
}

async function liveSearch(query, config, p, signal) {

  if (!config.baseUrl) {
    throw new PassportError(
      `${p.label} needs a base URL. Point it at your own service that holds the credential.`,
      "config"
    );
  }


  const url = `${config.baseUrl.replace(/\/+$/, "")}${p.path(query)}`;
  const headers = { Accept: "application/json" };
  // only attach the key when the operator has accepted that this is a direct
  // browser call; against a proxy the credential lives on the server
  if (config.apiKey && config.directBrowser) headers.Authorization = `Bearer ${config.apiKey}`;

  let res;
  try {
    res = await fetch(url, { headers, signal });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new PassportError(
      `Could not reach ${p.label}. A browser cannot call most of these directly — this is usually CORS, and the fix is a small server of your own that forwards the query.`,
      "network"
    );
  }
  if (!res.ok) {
    throw new PassportError(
      res.status === 401 || res.status === 403
        ? `${p.label} rejected the credential (${res.status}).`
        : `${p.label} returned ${res.status}.`,
      res.status === 401 || res.status === 403 ? "auth" : "http"
    );
  }

  const json = await res.json();
  const rows = p.pick(json) || [];
  const records = rows.map((r) => normaliseRecord(r, p.id)).filter((r) => r.name);
  return { records, source: p.label, live: true };
}

/** Used by the "test connection" button, so the operator finds out here. */
export async function testProvider(config) {
  const p = PROVIDERS[config.provider] || PROVIDERS.simulated;
  if (p.id === "simulated")
    return { ok: true, message: `Simulated index ready — ${REGISTRY.length} horses, no network needed.` };

  // check the configuration before the network, so an empty form says so
  // rather than reporting whatever the fetch happens to do
  if (p.needsUrl && !config.baseUrl)
    return {
      ok: false,
      kind: "config",
      message: `${p.label} needs a base URL. Point it at a service of your own that holds the credential and forwards the query.`,
    };
  if (p.needsKey && config.directBrowser && !config.apiKey)
    return { ok: false, kind: "config", message: `${p.label} needs an API key for a direct browser call.` };

  try {
    // a real query, not a one-letter one — the search floor is two characters,
    // and the probe reports the provider rather than the safety net
    const { records } = await searchPassports(PROBE, { ...config, fallbackToSimulated: false });
    return {
      ok: true,
      message: `Connected to ${p.label}. A test query for "${PROBE}" returned ${records.length} record${
        records.length === 1 ? "" : "s"
      }.`,
    };
  } catch (e) {
    return { ok: false, message: e.message, kind: e.kind };
  }
}

const PROBE = "bay";

export const sourceLabel = (config) => {
  const p = PROVIDERS[config?.provider] || PROVIDERS.simulated;
  return p.id === "simulated" ? p.source : p.label;
};
