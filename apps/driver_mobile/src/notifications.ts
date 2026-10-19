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
  unread_count: number;
};

export async function fetchNotifications(access: string): Promise<NotificationList> {
  return apiFetch<NotificationList>("/notifications?page_size=30", {}, access);
}

export async function markNotificationRead(
  access: string,
  id: string,
): Promise<AppNotification> {
  return apiFetch<AppNotification>(`/notifications/${id}/read`, { method: "POST" }, access);
}
