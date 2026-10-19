/** Maps backend booking status enums to customer-facing labels. */
export const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Request submitted",
  SEARCHING_DRIVER: "Searching for a driver",
  DRIVER_ASSIGNED: "Driver offer sent",
  DRIVER_ACCEPTED: "Driver accepted",
  DRIVER_ARRIVING: "Driver en route",
  DRIVER_ARRIVED: "Driver arrived",
  TRIP_STARTED: "Trip in progress",
  TRIP_COMPLETED: "Trip completed",
  CLOSED: "Completed",
  CANCELLED: "Cancelled",
  NO_DRIVER_FOUND: "No driver available",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

/** Partial order for UI — never move displayed status backwards on late WS events. */
export const STATUS_RANK: Record<string, number> = {
  REQUESTED: 1,
  SEARCHING_DRIVER: 2,
  DRIVER_ASSIGNED: 3,
  DRIVER_ACCEPTED: 4,
  DRIVER_ARRIVING: 5,
  DRIVER_ARRIVED: 6,
  TRIP_STARTED: 7,
  TRIP_COMPLETED: 8,
  CLOSED: 9,
  NO_DRIVER_FOUND: 3,
  CANCELLED: 100,
};

export function isStatusForwardOrSame(current: string | null | undefined, next: string): boolean {
  if (!current) return true;
  if (next === "CANCELLED") return true;
  const a = STATUS_RANK[current];
  const b = STATUS_RANK[next];
  if (a === undefined || b === undefined) return true;
  return b >= a;
}

export type PlacePreset = {
  id: string;
  label: string;
  lat: number;
  lon: number;
};

/** Labeled Hyderabad presets — not geocoding; documented fallback. */
export const PLACE_PRESETS: PlacePreset[] = [
  { id: "hyd-charminar", label: "Charminar area", lat: 17.3616, lon: 78.4747 },
  { id: "hyd-hitech", label: "HITEC City", lat: 17.4480, lon: 78.3910 },
  { id: "hyd-airport", label: "RGIA Airport", lat: 17.2403, lon: 78.4294 },
  { id: "hyd-secunderabad", label: "Secunderabad", lat: 17.4399, lon: 78.4983 },
  { id: "hyd-gachibowli", label: "Gachibowli", lat: 17.4401, lon: 78.3489 },
];

export function formatInr(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}
