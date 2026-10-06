/* ==========================================================================
   The people on the books.

   Who works here, what they do, and how to reach them. Plain configuration —
   no simulation, no derived readings — so it lives in the stored world
   alongside the barns.

   What those people are doing on a given day is the job planner's business and
   lives in jobs.js; this file is only the staff list itself.

   Staff are held against the operator rather than against one yard, because a
   trainer with two yards moves riders and grooms between them.
   ========================================================================== */

export const GROUPS = [
  { id: "riders", label: "Riders", colour: "#2a78d6", hint: "Anyone who sits on a horse" },
  { id: "yard", label: "Yard staff", colour: "#1baf7a", hint: "Grooms, feeding, mucking out" },
  { id: "vets", label: "Vets", colour: "#d03b3b", hint: "Veterinary" },
  { id: "farriers", label: "Farriers", colour: "#eb6834", hint: "Shoeing" },
  { id: "management", label: "Management", colour: "#6b4bbd", hint: "Yard manager, office" },
];

export const groupOf = (id) => GROUPS.find((g) => g.id === id) || { id, label: id, colour: "#86a0b8" };

export const inGroup = (person, groupId) => (person.groups || []).includes(groupId);

/** Everyone in a group, or everyone if no group is named. */
export const staffIn = (staff, groupId) =>
  (staff || []).filter((p) => !groupId || groupId === "all" || inGroup(p, groupId));

export { availableRiders, messageStamp } from "./jobs";
