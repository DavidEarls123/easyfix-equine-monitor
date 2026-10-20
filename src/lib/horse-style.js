/* ==========================================================================
   How the horse is drawn on a feed.

   The anatomy is the same in every one of these — what changes is the finish,
   which is the part people actually have an opinion about. It is a house
   preference rather than a threshold, so it lives in settings and the yard
   picks it once.

   Kept out of the camera itself so the stored world does not have to import a
   component to know what its own default is.
   ========================================================================== */

export const HORSE_STYLES = [
  { id: "vector", label: "Vector", hint: "Flat shapes, clean edges. Reads at the smallest size." },
  { id: "painted", label: "Painted", hint: "Muscled and lit, with a dapple and a light along the back." },
  { id: "footage", label: "Footage", hint: "Painted, then softened and grained like a real camera." },
  { id: "studbook", label: "Studbook", hint: "Drawn rather than lit: an outline and the muscle lines." },
];

export const DEFAULT_HORSE_STYLE = "painted";

export const horseStyle = (id) => HORSE_STYLES.find((s) => s.id === id) || HORSE_STYLES[1];
