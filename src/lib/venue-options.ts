export const ACTIVITY_OPTIONS = [
  { value: "football", label: "Football" },
  { value: "basketball", label: "Basketball" },
  { value: "tennis", label: "Tennis" },
  { value: "padel", label: "Padel" },
  { value: "volleyball", label: "Volleyball" },
  { value: "fitness", label: "Fitness / gym" },
  { value: "multi-sport", label: "Multi-sport" },
] as const;

export const AMENITY_OPTIONS = [
  { value: "parking", label: "Parking" },
  { value: "changing-room", label: "Changing room" },
  { value: "showers", label: "Showers" },
  { value: "lockers", label: "Lockers" },
  { value: "floodlights", label: "Floodlights" },
  { value: "covered", label: "Covered area" },
  { value: "equipment-rental", label: "Equipment rental" },
  { value: "cafe", label: "Cafe / snacks" },
  { value: "wifi", label: "WiFi" },
  { value: "security", label: "Security" },
  { value: "first-aid", label: "First aid" },
  { value: "spectator-seating", label: "Spectator seating" },
] as const;

export const RESOURCE_TYPE_OPTIONS = [
  { value: "pitch", label: "Pitch" },
  { value: "court", label: "Court" },
  { value: "field", label: "Field" },
  { value: "studio", label: "Studio" },
  { value: "gym-space", label: "Gym space" },
  { value: "track", label: "Track" },
  { value: "other", label: "Other" },
] as const;

export const RESOURCE_FEATURE_OPTIONS = [
  { value: "floodlights", label: "Floodlights" },
  { value: "covered", label: "Covered" },
  { value: "indoor", label: "Indoor" },
  { value: "spectator-seating", label: "Spectator seating" },
  { value: "scoreboard", label: "Scoreboard" },
  { value: "changing-room-nearby", label: "Changing room nearby" },
  { value: "equipment-included", label: "Equipment included" },
  { value: "referee-available", label: "Referee available" },
  { value: "training-friendly", label: "Training friendly" },
  { value: "event-friendly", label: "Event friendly" },
] as const;

export const ACTIVITY_VALUES: readonly string[] = ACTIVITY_OPTIONS.map((option) => option.value);
export const AMENITY_VALUES: readonly string[] = AMENITY_OPTIONS.map((option) => option.value);
export const RESOURCE_TYPE_VALUES: readonly string[] = RESOURCE_TYPE_OPTIONS.map((option) => option.value);
export const RESOURCE_FEATURE_VALUES: readonly string[] = RESOURCE_FEATURE_OPTIONS.map((option) => option.value);

export function venueOptionLabel(
  options: readonly { value: string; label: string }[],
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}
