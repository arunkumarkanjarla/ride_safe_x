import { ApiError } from "./api";
import { getAccessToken } from "./session";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
  /\/$/,
  "",
) ?? "";

async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const access = getAccessToken();
  if (!access) throw new ApiError(401, "Not authenticated");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${access}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = (body as { detail?: { error?: string } })?.detail;
    throw new ApiError(res.status, "Request failed", detail?.error);
  }
  return body as T;
}

export type OpsSummary = { total: number; by_status: Record<string, number> };

export type OpsBookingRow = {
  id: string;
  status: string;
  vehicle_type: string;
  customer_id: string;
  customer_email: string | null;
  estimate_paise: number;
  currency: string;
  assigned_driver_profile_id: string | null;
  created_at: string;
  updated_at: string;
  open_offer_count: number;
};

export type OpsList = {
  items: OpsBookingRow[];
  page: number;
  page_size: number;
  total: number;
};

export type OpsDetail = {
  id: string;
  status: string;
  vehicle_type: string;
  customer_id: string;
  customer_email: string | null;
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
  offers: Array<{
    id: string;
    driver_profile_id: string;
    status: string;
    expires_at: string;
    created_at: string;
    responded_at: string | null;
    driver_online: boolean | null;
    driver_last_lat: string | number | null;
    driver_last_lon: string | number | null;
  }>;
  events: Array<{
    id: string;
    from_status: string | null;
    to_status: string;
    reason: string | null;
    created_at: string;
  }>;
  assignment: {
    id: string;
    driver_profile_id: string;
    status: string;
    accepted_at: string;
  } | null;
  unassigned_reason: string | null;
  offer_counts: Record<string, number>;
};

export function fetchOpsSummary() {
  return authFetch<OpsSummary>("/ops/bookings/summary");
}

export function fetchOpsBookings(params: URLSearchParams) {
  return authFetch<OpsList>(`/ops/bookings?${params.toString()}`);
}

export function fetchOpsBooking(id: string) {
  return authFetch<OpsDetail>(`/ops/bookings/${id}`);
}

export function retryDispatch(id: string) {
  return authFetch<{ booking_id: string; status: string; action: string }>(
    `/ops/bookings/${id}/dispatch-retry`,
    { method: "POST", body: "{}" },
  );
}

export function opsCancel(id: string, reason: string) {
  return authFetch<{ booking_id: string; status: string; action: string }>(
    `/ops/bookings/${id}/cancel`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

export type OpsDriverRow = {
  driver_profile_id: string;
  email: string | null;
  vehicle_type: string;
  is_online: boolean;
  duty_status: string;
  location_freshness: string;
  location_received_at: string | null;
  dispatch_eligible: boolean;
  ineligibility_reason: string | null;
};

export function fetchOpsDrivers(params: URLSearchParams) {
  return authFetch<{ items: OpsDriverRow[]; page: number; total: number }>(
    `/ops/drivers?${params.toString()}`,
  );
}

export function wsUrl(accessToken: string): string {
  const base = API_BASE || window.location.origin;
  const wsBase = base.replace(/^http/, "ws");
  return `${wsBase}/ws?token=${encodeURIComponent(accessToken)}`;
}
