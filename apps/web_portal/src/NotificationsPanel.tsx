import { useCallback, useEffect, useState } from "react";
import { ApiError } from "./api";
import { getAccessToken } from "./session";

type Note = {
  id: string;
  title: string;
  body: string;
  booking_id: string | null;
  created_at: string;
  read_at: string | null;
  event_type: string;
};

type List = {
  items: Note[];
  unread_count: number;
  total: number;
};

type Health = {
  pending_notification_events: number;
  unpublished_outbox_events: number;
  processing_failures: number;
  oldest_pending_created_at: string | null;
  last_processed_at: string | null;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
  /\/$/,
  "",
) ?? "";

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const access = getAccessToken();
  const headers = new Headers(init.headers);
  if (access) headers.set("Authorization", `Bearer ${access}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, "Request failed", body?.detail?.error);
  }
  return body as T;
}

type Props = {
  canOpsHealth: boolean;
  onOpenBooking?: (bookingId: string) => void;
};

export function NotificationsPanel({ canOpsHealth, onOpenBooking }: Props) {
  const [list, setList] = useState<List | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const notes = await api<List>("/notifications?page_size=25");
      setList(notes);
      if (canOpsHealth) {
        try {
          setHealth(await api<Health>("/ops/notifications/health"));
        } catch {
          setHealth(null);
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.code || err.message : "Failed to load");
      setList(null);
    } finally {
      setLoading(false);
    }
  }, [canOpsHealth]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string, bookingId: string | null) {
    try {
      await api(`/notifications/${id}/read`, { method: "POST" });
      await load();
      if (bookingId && onOpenBooking) onOpenBooking(bookingId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mark read failed");
    }
  }

  return (
    <section className="card">
      <h2>
        Notifications{" "}
        {list && list.unread_count > 0 ? (
          <span className="muted">({list.unread_count} unread)</span>
        ) : null}
      </h2>
      <button type="button" onClick={() => void load()} disabled={loading}>
        {loading ? "Loading…" : "Refresh"}
      </button>
      {error && <p className="warn">{error}</p>}
      {canOpsHealth && health && (
        <p className="muted">
          Pipeline: pending {health.pending_notification_events} · unpublished{" "}
          {health.unpublished_outbox_events} · failures {health.processing_failures}
        </p>
      )}
      {!list || list.items.length === 0 ? (
        <p className="muted">No notifications for this account.</p>
      ) : (
        <ul className="notif-list">
          {list.items.map((n) => (
            <li key={n.id}>
              <strong>
                {n.read_at ? "" : "• "}
                {n.title}
              </strong>
              <div className="muted">{n.body}</div>
              <button type="button" onClick={() => void markRead(n.id, n.booking_id)}>
                {n.read_at ? "Open" : "Mark read"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
