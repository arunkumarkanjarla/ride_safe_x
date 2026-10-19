import { apiFetch } from "./api";

export type AppNotification = {
  id: string;
  event_type: string;
  title: string;
  body: string;
  booking_id: string | null;
  created_at: string;
  read_at: string | null;
};

export type NotificationList = {
  items: AppNotification[];
  page: number;
  page_size: number;
  total: number;
  unread_count: number;
};

export async function fetchNotifications(
  access: string,
  opts?: { unread?: boolean },
): Promise<NotificationList> {
  const q = opts?.unread ? "?unread=true&page_size=30" : "?page_size=30";
  return apiFetch<NotificationList>(`/notifications${q}`, {}, access);
}

export async function fetchUnreadCount(access: string): Promise<number> {
  const r = await apiFetch<{ unread_count: number }>(
    "/notifications/unread-count",
    {},
    access,
  );
  return r.unread_count;
}

export async function markNotificationRead(
  access: string,
  id: string,
): Promise<AppNotification> {
  return apiFetch<AppNotification>(`/notifications/${id}/read`, { method: "POST" }, access);
}
