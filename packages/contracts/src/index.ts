/** Shared API contract types — Phase 1–3. */

export interface HealthResponse {
  status: "ok";
  service: string;
  version: string;
  env: string;
}

export interface PostgisInfo {
  extname: string;
  extversion: string;
  full_version: string | null;
}

export interface HealthDbResponse {
  status: "ok";
  database: string;
  user: string;
  postgis: PostgisInfo;
}

export interface RoleOut {
  code: string;
  name: string;
}

export interface UserOut {
  id: string;
  email: string;
  display_name: string;
  status: string;
  roles: RoleOut[];
  permissions: string[];
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer" | string;
  expires_in: number;
  user: UserOut;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface FareEstimateRequest {
  pickup_lat: number;
  pickup_lon: number;
  drop_lat: number;
  drop_lon: number;
  vehicle_type?: "Cab" | "Auto" | "Bike" | string;
}

export interface FareLine {
  label: string;
  paise: number;
}

export interface FareEstimateResponse {
  vehicle_type: string;
  distance_km: number;
  duration_min: number;
  currency: string;
  subtotal_paise: number;
  tax_paise: number;
  estimate_paise: number;
  lines: FareLine[];
}

export interface BookingCreateRequest extends FareEstimateRequest {
  idempotency_key: string;
}

export interface Booking {
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
}

export interface BookingListResponse {
  items: Booking[];
}

export interface DriverAvailability {
  driver_profile_id: string;
  is_online: boolean;
  duty_status: string;
  last_lat?: string | number | null;
  last_lon?: string | number | null;
  location_freshness: string;
  location_received_at: string | null;
  location_seq: number;
  dispatch_eligible: boolean;
  ineligibility_reason: string | null;
  updated_at?: string;
}

export interface DriverOffer {
  id: string;
  booking_id: string;
  driver_profile_id: string;
  status: string;
  expires_at: string;
  created_at: string;
  booking?: Booking | null;
}

export interface OfferListResponse {
  items: DriverOffer[];
}

export interface TripAssignment {
  id: string;
  booking_id: string;
  driver_profile_id: string;
  offer_id: string;
  status: string;
  accepted_at: string;
  booking?: Booking | null;
  next_action?: string | null;
}

export interface AssignmentListResponse {
  items: TripAssignment[];
}

export interface ActiveTrip {
  assignment: TripAssignment | null;
  booking: Booking | null;
  next_action: string | null;
  action_label: string | null;
}

export interface BookingResyncResponse {
  booking: Booking;
  events: Array<{
    id: string;
    from_status: string | null;
    to_status: string;
    reason: string | null;
    created_at: string | null;
  }>;
  cursor: string | null;
}

export interface WsEvent {
  event_id?: string;
  event_type: string;
  aggregate_type?: string;
  aggregate_id?: string;
  payload?: Record<string, unknown>;
  created_at?: string;
}

export interface OpsBookingSummary {
  total: number;
  by_status: Record<string, number>;
}

export interface OpsBookingList {
  items: Array<{
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
  }>;
  page: number;
  page_size: number;
  total: number;
}

export interface DriverLocationUpdate {
  lat: number;
  lon: number;
  seq: number;
  accuracy_m?: number;
  captured_at?: string;
}

export interface AssignedDriverSummary {
  display_name: string;
  vehicle_type: string;
  assignment_status: string | null;
}

export interface CustomerTripSummary {
  booking: Booking;
  can_cancel: boolean;
  assigned_driver: AssignedDriverSummary | null;
  status_updated_at: string;
}

export interface AppNotification {
  id: string;
  event_type: string;
  title: string;
  body: string;
  booking_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}

export interface NotificationListResponse {
  items: AppNotification[];
  page: number;
  page_size: number;
  total: number;
  unread_count: number;
}

export interface NotificationHealth {
  pending_notification_events: number;
  unpublished_outbox_events: number;
  processing_failures: number;
  oldest_pending_created_at: string | null;
  last_processed_at: string | null;
}

export interface Payment {
  id: string;
  booking_id: string;
  customer_id: string;
  amount_paise: number;
  currency: string;
  status: string;
  gateway: string;
  gateway_ref: string;
  failure_category: string | null;
  created_at: string;
  updated_at: string;
  succeeded_at: string | null;
  failed_at: string | null;
  cancelled_at: string | null;
  sandbox?: boolean;
}

export interface PaymentCreateRequest {
  booking_id: string;
  idempotency_key: string;
}

export const API_CONTRACT_VERSION = "0.9.0" as const;

export const BOOKING_STATUSES = [
  "REQUESTED",
  "SEARCHING_DRIVER",
  "DRIVER_ASSIGNED",
  "DRIVER_ACCEPTED",
  "DRIVER_ARRIVING",
  "DRIVER_ARRIVED",
  "TRIP_STARTED",
  "TRIP_COMPLETED",
  "CANCELLED",
  "NO_DRIVER_FOUND",
  "CLOSED",
] as const;
