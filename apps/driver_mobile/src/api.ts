const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export { API_BASE };

export type Booking = {
  id: string;
  status: string;
  estimate_paise: number;
  currency: string;
  vehicle_type: string;
  pickup_lat: string | number;
  pickup_lon: string | number;
  drop_lat: string | number;
  drop_lon: string | number;
};

export type Offer = {
  id: string;
  booking_id: string;
  status: string;
  expires_at: string;
  booking?: Booking | null;
};

export type Assignment = {
  id: string;
  booking_id: string;
  status: string;
  next_action?: string | null;
  booking?: Booking | null;
};

export type ActiveTrip = {
  assignment: Assignment | null;
  booking: Booking | null;
  next_action: string | null;
  action_label: string | null;
};

export const ACTION_LABELS: Record<string, string> = {
  "driver.en_route": "En route to pickup",
  "driver.arrived": "Arrived at pickup",
  "trip.start": "Start trip",
  "trip.end": "Complete trip",
};

export function formatCoord(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(5);
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  access?: string | null,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (access) headers.set("Authorization", `Bearer ${access}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(
      body?.detail?.error || `HTTP ${res.status}`,
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return body as T;
}
