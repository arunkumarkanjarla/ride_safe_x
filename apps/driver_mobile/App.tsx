import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ACTION_LABELS,
  apiFetch,
  formatCoord,
  type ActiveTrip,
  type Assignment,
  type Booking,
  type Offer,
} from "./src/api";
import { useAuth } from "./src/auth";
import {
  fetchNotifications,
  markNotificationRead,
  type AppNotification,
} from "./src/notifications";

type Availability = {
  is_online: boolean;
  duty_status: string;
  location_freshness: string;
  location_received_at: string | null;
  location_seq: number;
  dispatch_eligible: boolean;
  ineligibility_reason: string | null;
  last_lat: string | number | null;
  last_lon: string | number | null;
};

/** Phase 5–7 — availability, offers, authoritative trip workspace. */
export default function App() {
  const { user, ready, error, signIn, signOut, getAccessToken, apiBase } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [permStatus, setPermStatus] = useState<string>("unknown");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [trips, setTrips] = useState<Booking[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const seqRef = useRef(0);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mutatingRef = useRef(false);

  const stopWatch = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
  }, []);

  const pushLocation = useCallback(
    async (coords: { latitude: number; longitude: number; accuracy: number | null }) => {
      const access = await getAccessToken();
      if (!access) return;
      seqRef.current += 1;
      try {
        const res = await apiFetch<Availability & { location_seq: number; lat?: number; lon?: number }>(
          "/drivers/me/location",
          {
            method: "PUT",
            body: JSON.stringify({
              lat: coords.latitude,
              lon: coords.longitude,
              seq: seqRef.current,
              accuracy_m: coords.accuracy ?? undefined,
              captured_at: new Date().toISOString(),
            }),
          },
          access,
        );
        setAvailability((prev) => ({
          is_online: prev?.is_online ?? true,
          duty_status: res.duty_status,
          location_freshness: res.location_freshness,
          location_received_at: res.location_received_at,
          location_seq: res.location_seq,
          dispatch_eligible: res.dispatch_eligible,
          ineligibility_reason: res.ineligibility_reason,
          last_lat: res.lat ?? coords.latitude,
          last_lon: res.lon ?? coords.longitude,
        }));
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Location sync failed");
      }
    },
    [getAccessToken],
  );

  const startWatch = useCallback(async () => {
    stopWatch();
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermStatus(status);
    if (status !== "granted") {
      setActionError("Location permission denied — go online only after granting permission.");
      return false;
    }
    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15000,
        distanceInterval: 25,
      },
      (pos) => {
        void pushLocation(pos.coords);
      },
    );
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await pushLocation(current.coords);
    return true;
  }, [pushLocation, stopWatch]);

  const refresh = useCallback(async () => {
    const access = await getAccessToken();
    if (!access) return;
    setLoadError(null);
    try {
      const [offerList, tripPayload, tripList, avail] = await Promise.all([
        apiFetch<{ items: Offer[] }>("/drivers/me/offers", {}, access),
        apiFetch<ActiveTrip>("/drivers/me/active-trip", {}, access),
        apiFetch<{ items: Booking[] }>("/drivers/me/trips", {}, access),
        apiFetch<Availability>("/drivers/me/availability", {}, access),
      ]);
      setOffers(offerList.items);
      setTrips(tripList.items);
      setActiveTrip(tripPayload);
      setAvailability(avail);
      seqRef.current = Math.max(seqRef.current, avail.location_seq || 0);
      try {
        const notes = await fetchNotifications(access);
        setNotifications(notes.items);
        setUnreadCount(notes.unread_count);
      } catch {
        /* non-fatal */
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Refresh failed");
      throw e;
    }
  }, [getAccessToken]);

  const connectWs = useCallback(async () => {
    const access = await getAccessToken();
    if (!access) return;
    wsRef.current?.close();
    const wsBase = apiBase.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/ws?token=${encodeURIComponent(access)}`);
    wsRef.current = ws;
    ws.onopen = () => setWsStatus("connected");
    ws.onclose = () => setWsStatus("disconnected");
    ws.onerror = () => setWsStatus("error");
    ws.onmessage = () => {
      void refresh().catch(() => undefined);
    };
  }, [apiBase, getAccessToken, refresh]);

  useEffect(() => {
    if (!user) return;
    void refresh().catch(() => undefined);
    void connectWs();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh().catch(() => undefined);
    });
    return () => {
      sub.remove();
      stopWatch();
      wsRef.current?.close();
    };
  }, [user, refresh, connectWs, stopWatch]);

  useEffect(() => {
    if (!availability?.is_online) {
      stopWatch();
      return;
    }
    void startWatch();
  }, [availability?.is_online, startWatch, stopWatch]);

  async function onLogin() {
    setFormError(null);
    if (!email.trim() || password.length < 8) {
      setFormError("Email and password (min 8) required.");
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      setPassword("");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleOnline() {
    if (mutatingRef.current) return;
    setActionError(null);
    setBusy(true);
    mutatingRef.current = true;
    try {
      const access = await getAccessToken();
      const next = !availability?.is_online;
      if (next) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermStatus(status);
        if (status !== "granted") {
          setActionError("Cannot go online without location permission.");
          return;
        }
      } else {
        stopWatch();
      }
      const res = await apiFetch<Availability>(
        "/drivers/me/availability",
        { method: "PUT", body: JSON.stringify({ is_online: next }) },
        access,
      );
      setAvailability(res);
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Availability failed");
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
      mutatingRef.current = false;
    }
  }

  async function onAccept(offerId: string) {
    if (mutatingRef.current) return;
    setActionError(null);
    setBusy(true);
    mutatingRef.current = true;
    try {
      const access = await getAccessToken();
      await apiFetch(`/drivers/me/offers/${offerId}/accept`, { method: "POST", body: "{}" }, access);
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Accept failed");
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
      mutatingRef.current = false;
    }
  }

  async function onReject(offerId: string) {
    if (mutatingRef.current) return;
    setActionError(null);
    setBusy(true);
    mutatingRef.current = true;
    try {
      const access = await getAccessToken();
      await apiFetch(`/drivers/me/offers/${offerId}/reject`, { method: "POST", body: "{}" }, access);
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusy(false);
      mutatingRef.current = false;
    }
  }

  async function runTransition(action: string) {
    const bookingId = activeTrip?.booking?.id || activeTrip?.assignment?.booking_id;
    if (!bookingId || mutatingRef.current) return;
    setActionError(null);
    setBusy(true);
    mutatingRef.current = true;
    try {
      const access = await getAccessToken();
      await apiFetch(
        `/bookings/${bookingId}/transition`,
        { method: "POST", body: JSON.stringify({ action }) },
        access,
      );
      await refresh();
    } catch (e) {
      const err = e as Error & { status?: number };
      setActionError(err.message || "Transition failed");
      // Recover authoritative state before any retry
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
      mutatingRef.current = false;
    }
  }

  function onPrimaryAction() {
    const action = activeTrip?.next_action;
    if (!action || busy) return;
    const label = activeTrip?.action_label || ACTION_LABELS[action] || action;
    const consequential = action === "trip.start" || action === "trip.end";
    if (consequential) {
      Alert.alert("Confirm", `${label}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => void runTransition(action) },
      ]);
      return;
    }
    void runTransition(action);
  }

  async function onOpenNotification(n: AppNotification) {
    const access = await getAccessToken();
    if (!access) return;
    try {
      if (!n.read_at) await markNotificationRead(access, n.id);
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Notification update failed");
    }
  }

  async function onSignOut() {
    stopWatch();
    setNotifications([]);
    setUnreadCount(0);
    await signOut();
  }

  const booking = activeTrip?.booking;
  const assignment: Assignment | null = activeTrip?.assignment || null;
  const completedTrips = trips.filter((t) => t.status === "CLOSED" || t.status === "TRIP_COMPLETED");

  if (!ready) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.brand}>RideNova</Text>
      <Text style={styles.title}>Driver app</Text>
      <Text style={styles.meta}>API: {apiBase}</Text>
      {error ? <Text style={styles.warn}>{error}</Text> : null}
      {user ? (
        <>
          <Text style={styles.body}>Signed in as {user.display_name}</Text>
          <Text style={styles.meta}>WS: {wsStatus}</Text>
          <Button title="Sign out" onPress={() => void onSignOut()} />

          <Text style={styles.section}>Availability</Text>
          <Text style={styles.body}>
            {availability?.is_online ? "Online" : "Offline"} · duty {availability?.duty_status || "—"}
          </Text>
          <Text style={styles.meta}>Permission: {permStatus}</Text>
          <Text style={styles.meta}>
            Location: {availability?.location_freshness || "—"}
            {availability?.location_received_at
              ? ` · last ${new Date(availability.location_received_at).toLocaleTimeString()}`
              : ""}
          </Text>
          <Text style={styles.meta}>
            Dispatch eligible: {availability?.dispatch_eligible ? "yes" : "no"}
            {availability?.ineligibility_reason ? ` (${availability.ineligibility_reason})` : ""}
          </Text>
          <Button
            title={availability?.is_online ? "Go offline" : "Go online"}
            onPress={() => void toggleOnline()}
            disabled={busy}
          />

          <Text style={styles.section}>
            Inbox {unreadCount > 0 ? `(${unreadCount} unread)` : ""}
          </Text>
          {notifications.length === 0 ? (
            <Text style={styles.meta}>No notifications</Text>
          ) : (
            notifications.slice(0, 8).map((n) => (
              <View key={n.id} style={styles.offerBox}>
                <Text style={styles.body}>
                  {n.read_at ? "" : "• "}
                  {n.title}
                </Text>
                <Text style={styles.meta}>{n.body}</Text>
                <Button
                  title={n.read_at ? "Opened" : "Mark read"}
                  onPress={() => void onOpenNotification(n)}
                  disabled={busy || !!n.read_at}
                />
              </View>
            ))
          )}

          <Text style={styles.section}>Offers</Text>
          {offers.length === 0 ? (
            <Text style={styles.meta}>No pending offers</Text>
          ) : (
            offers.map((o) => (
              <View key={o.id} style={styles.offerBox}>
                <Text style={styles.body}>Offer {o.id.slice(0, 8)}</Text>
                {o.booking ? (
                  <Text style={styles.meta}>
                    Pickup {formatCoord(o.booking.pickup_lat)}, {formatCoord(o.booking.pickup_lon)}
                  </Text>
                ) : null}
                <Button title="Accept" onPress={() => void onAccept(o.id)} disabled={busy} />
                <Button title="Reject" onPress={() => void onReject(o.id)} disabled={busy} />
              </View>
            ))
          )}

          <Text style={styles.section}>Trip workspace</Text>
          {loadError ? (
            <>
              <Text style={styles.warn}>{loadError}</Text>
              <Button title="Retry" onPress={() => void refresh()} disabled={busy} />
            </>
          ) : null}
          {!assignment || assignment.status !== "ACTIVE" || !booking ? (
            <Text style={styles.meta}>No active assignment</Text>
          ) : (
            <View style={styles.tripBox}>
              <Text style={styles.body}>Ref {booking.id.slice(0, 8)}</Text>
              <Text style={styles.body}>Status: {booking.status}</Text>
              <Text style={styles.meta}>
                Pickup {formatCoord(booking.pickup_lat)}, {formatCoord(booking.pickup_lon)}
              </Text>
              <Text style={styles.meta}>
                Drop {formatCoord(booking.drop_lat)}, {formatCoord(booking.drop_lon)}
              </Text>
              <Text style={styles.meta}>
                Fare estimate ₹{(booking.estimate_paise / 100).toFixed(2)} · {booking.vehicle_type}
              </Text>
              <Text style={styles.meta}>Coordinates are not street addresses.</Text>
              {activeTrip?.next_action ? (
                <Button
                  title={
                    busy
                      ? "Working…"
                      : activeTrip.action_label ||
                        ACTION_LABELS[activeTrip.next_action] ||
                        activeTrip.next_action
                  }
                  onPress={onPrimaryAction}
                  disabled={busy}
                />
              ) : (
                <Text style={styles.meta}>No further driver actions</Text>
              )}
            </View>
          )}

          {actionError ? <Text style={styles.warn}>{actionError}</Text> : null}

          <Text style={styles.section}>Completed trips</Text>
          {completedTrips.length === 0 ? (
            <Text style={styles.meta}>No completed trips yet</Text>
          ) : (
            completedTrips.slice(0, 8).map((t) => (
              <Text key={t.id} style={styles.meta}>
                {t.status} · {t.id.slice(0, 8)} · ₹{(t.estimate_paise / 100).toFixed(2)}
              </Text>
            ))
          )}
          <Button title="Refresh" onPress={() => void refresh()} disabled={busy} />
          <Text style={styles.meta}>Foreground location only while online (background deferred).</Text>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
          />
          {formError ? <Text style={styles.warn}>{formError}</Text> : null}
          <Button title={busy ? "Signing in…" : "Sign in"} onPress={() => void onLogin()} disabled={busy} />
        </>
      )}
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#F3EFE6",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  brand: { fontSize: 28, fontWeight: "700", color: "#0B6E4F" },
  title: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  section: { marginTop: 16, fontSize: 16, fontWeight: "600", color: "#1C2430" },
  body: { textAlign: "center", lineHeight: 22, color: "#1C2430" },
  meta: { fontSize: 12, color: "#5C6570", marginBottom: 4, textAlign: "center" },
  warn: { color: "#8A3B12", textAlign: "center" },
  input: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: "#C5CCD4",
    borderRadius: 6,
    padding: 10,
    backgroundColor: "#fff",
  },
  offerBox: { width: "100%", maxWidth: 360, gap: 6, marginBottom: 8 },
  tripBox: {
    width: "100%",
    maxWidth: 360,
    gap: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: "#C5CCD4",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
});
