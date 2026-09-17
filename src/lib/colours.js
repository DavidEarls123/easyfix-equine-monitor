/* ==========================================================================
   Coat colours.

   The passport term for a horse's colour is a short, closed list — a yard says
   "dark bay" or "liver chestnut", not "brown-ish". These are the terms used on
   Irish and British passports, each with the two tones the app draws it in: the
   body, and the points (mane, tail, lower legs), because on most colours those
   differ and that is what makes a drawn horse read as the right colour.

   Selectable on the profile until the passport source fills it in.
   ========================================================================== */

export const COLOURS = [
  { id: "Bay", label: "Bay", body: "#8a5527", points: "#241708", hint: "Brown body, black points" },
  { id: "Dark Bay", label: "Dark bay", body: "#5b3a20", points: "#181008", hint: "Deep brown, black points" },
  { id: "Brown", label: "Brown", body: "#6b4b36", points: "#26190f", hint: "Brown throughout" },
  { id: "Chestnut", label: "Chestnut", body: "#b4652c", points: "#8a4a1c", hint: "Ginger, no black" },
  { id: "Liver Chestnut", label: "Liver chestnut", body: "#6f3b1e", points: "#552c15", hint: "Dark chocolate chestnut" },
  { id: "Grey", label: "Grey", body: "#c3c7cc", points: "#8d949c", hint: "White hairs through the coat" },
  { id: "Dark Grey", label: "Dark grey", body: "#8f959c", points: "#5f666d", hint: "Steel grey" },
  { id: "Black", label: "Black", body: "#2f2b28", points: "#141211", hint: "Black throughout" },
  { id: "Roan", label: "Roan", body: "#9a7d72", points: "#4a362c", hint: "White mixed through a base colour" },
  { id: "Palomino", label: "Palomino", body: "#d3a860", points: "#eee3cb", hint: "Gold body, flaxen mane and tail" },
  { id: "Dun", label: "Dun", body: "#c2a473", points: "#4a3a22", hint: "Sandy body, dark points and dorsal stripe" },
  { id: "Piebald", label: "Piebald", body: "#31302e", points: "#f2efe9", hint: "Black and white patches" },
  { id: "Skewbald", label: "Skewbald", body: "#8a5527", points: "#f2efe9", hint: "Brown and white patches" },
];

export const colourOf = (id) => COLOURS.find((c) => c.id === id) || COLOURS[0];
export const COLOUR_IDS = COLOURS.map((c) => c.id);
