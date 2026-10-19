const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export { API_BASE };

export type Booking = {
  id: string;
  customer_id: string;
  status: string;
  vehicle_type: string;
  pickup_lat: string | number;
  pickup_lon: string | number;
  drop_lat: string | number;
  drop_lon: string | number;
  distance_km: string | number;
  duration_min: number;
  estimate_paise: number;
  currency: string;
  assigned_driver_profile_id: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type FareEstimate = {
  estimate_paise: number;
  currency: string;
  distance_km: number;
  duration_min: number;
  subtotal_paise: number;
  tax_paise: number;
  lines: { label: string; paise: number }[];
};

export type TripSummary = {
  booking: Booking;
  can_cancel: boolean;
  assigned_driver: {
    display_name: string;
    vehicle_type: string;
    assignment_status: string | null;
  } | null;
  status_updated_at: string;
};

export type Resync = {
  booking: Booking;
  events: Array<{
    id: string;
    from_status: string | null;
    to_status: string;
    reason: string | null;
    created_at: string | null;
  }>;
  cursor: string | null;
};

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
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: init.signal });
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
