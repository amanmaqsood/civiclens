/**
 * Enforces plain human sentence-case conversion of system enums for Civic Dossier.
 */

export function humanizeCategory(category?: string): string {
  if (!category) return "Other";
  const mapping: Record<string, string> = {
    pothole: "Pothole",
    water_leak: "Water Leak",
    streetlight: "Street Light",
    waste: "Garbage & Sanitation",
    drainage: "Drain & Sewerage",
    road_damage: "Road Damage",
    other: "Other"
  };
  const key = category.toLowerCase().trim();
  return mapping[key] || category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function humanizeUrgency(urgency?: string): string {
  if (!urgency) return "Routine";
  const mapping: Record<string, string> = {
    routine: "Routine",
    priority: "Priority",
    urgent: "Urgent"
  };
  const key = urgency.toLowerCase().trim();
  return mapping[key] || urgency.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
