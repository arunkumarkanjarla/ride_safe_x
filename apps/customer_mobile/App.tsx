import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  apiFetch,
  type Booking,
  type FareEstimate,
  type Resync,
  type TripSummary,
} from "./src/api";
import { useAuth } from "./src/auth";
import {
  fetchNotifications,
  markNotificationRead,
  type AppNotification,
} from "./src/notifications";
import {
  initiatePayment,
  listPayments,
  newPayIdemKey,
  sandboxSimulate,
  type Payment,
} from "./src/payments";
import {
  PLACE_PRESETS,
  formatInr,
  isStatusForwardOrSame,
  statusLabel,
  type PlacePreset,
} from "./src/statusLabels";

type Place = { label: string; lat: number; lon: number };

function placesEqual(a: Place | null, b: Place | null): boolean {
  if (!a || !b) return false;
  return a.lat === b.lat && a.lon === b.lon;
}

function newIdemKey(): string {
  return `cust-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Phase 6 — customer booking journey (manual/preset + current location; no paid geocoder). */
export default function App() {
  const { user, ready, error, signIn, signOut, getAccessToken, apiBase } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [permStatus, setPermStatus] = useState("unknown");
  const [pickup, setPickup] = useState<Place | null>(PLACE_PRESETS[0]);
  const [drop, setDrop] = useState<Place | null>(PLACE_PRESETS[1]);
  const [manualPickup, setManualPickup] = useState({ lat: "17.3850", lon: "78.4867" });
  const [manualDrop, setManualDrop] = useState({ lat: "17.4480", lon: "78.3910" });
  const [showManual, setShowManual] = useState(false);
  const [estimate, setEstimate] = useState<FareEstimate | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [history, setHistory] = useState<Booking[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [staleHint, setStaleHint] = useState(false);
  const [screen, setScreen] = useState<"book" | "active" | "history" | "inbox">("book");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const payIdemRef = useRef(newPayIdemKey());

  const idemRef = useRef<string>(newIdemKey());
  const lastPayloadRef = useRef<string>("");
  const inflightRef = useRef(false);
  const estimateAbortRef = useRef<AbortController | null>(null);
  const estimateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const coordsPayload = useCallback(() => {
    if (!pickup || !drop) return null;
    return {
      pickup_lat: pickup.lat,
      pickup_lon: pickup.lon,
      drop_lat: drop.lat,
      drop_lon: drop.lon,
      vehicle_type: "Cab",
    };
  }, [pickup, drop]);

  const refreshHistory = useCallback(async () => {
    const access = await getAccessToken();
    if (!access) return;
    const list = await apiFetch<{ items: Booking[] }>("/bookings", {}, access);
    setHistory(list.items);
  }, [getAccessToken]);

  const refreshNotifications = useCallback(async () => {
    const access = await getAccessToken();
    if (!access) return;
    setNotifError(null);
    try {
      const list = await fetchNotifications(access);
      setNotifications(list.items);
      setUnreadCount(list.unread_count);
    } catch (e) {
      setNotifError(e instanceof Error ? e.message : "Notifications failed");
    }
  }, [getAccessToken]);

  const refreshPayments = useCallback(async (bookingId: string) => {
    const access = await getAccessToken();
    if (!access) return;
    setPayError(null);
    try {
      setPayments(await listPayments(access, bookingId));
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Payments failed");
    }
  }, [getAccessToken]);

  const loadSummary = useCallback(
    async (bookingId: string, opts?: { authoritative?: boolean }) => {
      const access = await getAccessToken();
      if (!access) return;
      const s = await apiFetch<TripSummary>(`/bookings/${bookingId}/summary`, {}, access);
      setBooking((prev) => {
        if (
          !opts?.authoritative &&
          prev &&
          prev.id === s.booking.id &&
          !isStatusForwardOrSame(prev.status, s.booking.status)
        ) {
          return prev;
        }
        return s.booking;
      });
      setSummary(s);
      setStaleHint(false);
      if (s.booking.status === "CLOSED") {
        void refreshPayments(bookingId).catch(() => undefined);
      }
    },
    [getAccessToken, refreshPayments],
  );

  const resync = useCallback(
    async (bookingId: string) => {
      const access = await getAccessToken();
      if (!access) return;
      const r = await apiFetch<Resync>(`/bookings/${bookingId}/resync`, {}, access);
      setBooking(r.booking);
      await loadSummary(bookingId, { authoritative: true });
    },
    [getAccessToken, loadSummary],
  );

  const connectWs = useCallback(
    async (bookingId: string) => {
      const access = await getAccessToken();
      if (!access) return;
      wsRef.current?.close();
      const wsBase = apiBase.replace(/^http/, "ws");
      const ws = new WebSocket(`${wsBase}/ws?token=${encodeURIComponent(access)}`);
      wsRef.current = ws;
      ws.onopen = () => {
        setWsStatus("connected");
        setStaleHint(false);
        ws.send(JSON.stringify({ action: "subscribe.booking", booking_id: bookingId }));
      };
      ws.onclose = () => {
        setWsStatus("disconnected");
        setStaleHint(true);
      };
      ws.onerror = () => {
        setWsStatus("error");
        setStaleHint(true);
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data));
          const bid = msg.payload?.booking_id;
          if (bid === bookingId) {
            void loadSummary(bookingId);
          }
        } catch {
          /* ignore */
        }
      };
    },
    [apiBase, getAccessToken, loadSummary],
  );

  const runEstimate = useCallback(async () => {
    const body = coordsPayload();
    if (!body) return;
    if (placesEqual(pickup, drop)) {
      setActionError("Pickup and destination must differ.");
      setEstimate(null);
      return;
    }
    estimateAbortRef.current?.abort();
    const ac = new AbortController();
    estimateAbortRef.current = ac;
    setActionError(null);
    try {
      const access = await getAccessToken();
      const res = await apiFetch<FareEstimate>(
        "/fare/estimate",
        { method: "POST", body: JSON.stringify(body), signal: ac.signal },
        access,
      );
      if (!ac.signal.aborted) setEstimate(res);
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      setEstimate(null);
      setActionError(e instanceof Error ? e.message : "Estimate failed");
    }
  }, [coordsPayload, getAccessToken, pickup, drop]);

  useEffect(() => {
    if (!user || !pickup || !drop) return;
    if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current);
    estimateTimerRef.current = setTimeout(() => {
      void runEstimate();
    }, 400);
    return () => {
      if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current);
    };
  }, [user, pickup, drop, runEstimate]);

  useEffect(() => {
    if (!user) return;
    void refreshHistory().catch(() => undefined);
    void refreshNotifications().catch(() => undefined);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshNotifications().catch(() => undefined);
        if (booking?.id) {
          void resync(booking.id).catch(() => setStaleHint(true));
        }
      }
    });
    return () => {
      sub.remove();
      wsRef.current?.close();
      estimateAbortRef.current?.abort();
    };
  }, [user, refreshHistory, refreshNotifications, booking?.id, resync]);

  function applyPreset(which: "pickup" | "drop", preset: PlacePreset) {
    const place = { label: preset.label, lat: preset.lat, lon: preset.lon };
    if (which === "pickup") setPickup(place);
    else setDrop(place);
    const key = JSON.stringify({ ...place, which });
    if (key !== lastPayloadRef.current) {
      idemRef.current = newIdemKey();
    }
  }

  function applyManual() {
    const pLat = Number(manualPickup.lat);
    const pLon = Number(manualPickup.lon);
    const dLat = Number(manualDrop.lat);
    const dLon = Number(manualDrop.lon);
    if (![pLat, pLon, dLat, dLon].every((n) => Number.isFinite(n))) {
      setActionError("Enter valid numeric coordinates.");
      return;
    }
    if (pLat < -90 || pLat > 90 || dLat < -90 || dLat > 90) {
      setActionError("Latitude must be between -90 and 90.");
      return;
    }
    setPickup({ label: `Manual ${pLat.toFixed(4)}, ${pLon.toFixed(4)}`, lat: pLat, lon: pLon });
    setDrop({ label: `Manual ${dLat.toFixed(4)}, ${dLon.toFixed(4)}`, lat: dLat, lon: dLon });
    idemRef.current = newIdemKey();
    setActionError(null);
  }

  async function useCurrentPickup() {
    setActionError(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermStatus(status);
    if (status !== "granted") {
      setActionError("Location permission denied. Choose a preset or enter coordinates manually.");
      setShowManual(true);
      return;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setPickup({
        label: "Current location",
        lat: Number(pos.coords.latitude.toFixed(6)),
        lon: Number(pos.coords.longitude.toFixed(6)),
      });
      idemRef.current = newIdemKey();
    } catch {
      setActionError("GPS unavailable. Use a preset or manual coordinates.");
      setShowManual(true);
    }
  }

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

  async function onBook() {
    const body = coordsPayload();
    if (!body || !estimate) {
      setActionError("Get a valid fare estimate before booking.");
      return;
    }
    if (placesEqual(pickup, drop)) {
      setActionError("Pickup and destination must differ.");
      return;
    }
    if (inflightRef.current) return;
    inflightRef.current = true;
    setBusy(true);
    setActionError(null);
    const payloadKey = JSON.stringify(body);
    if (payloadKey !== lastPayloadRef.current) {
      idemRef.current = newIdemKey();
      lastPayloadRef.current = payloadKey;
    }
    const key = idemRef.current;
    try {
      const access = await getAccessToken();
      const res = await apiFetch<Booking>(
        "/bookings",
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify({ ...body, idempotency_key: key }),
        },
        access,
      );
      setBooking(res);
      setScreen("active");
      await loadSummary(res.id);
      await connectWs(res.id);
      await refreshHistory();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Booking failed");
      // Keep same idempotency key for uncertain retry of the same payload
    } finally {
      inflightRef.current = false;
      setBusy(false);
    }
  }

  async function onCancel() {
    if (!booking) return;
    Alert.alert("Cancel ride?", "This cannot be undone from the app.", [
      { text: "Keep ride", style: "cancel" },
      {
        text: "Cancel ride",
        style: "destructive",
        onPress: () => {
          void (async () => {
            if (inflightRef.current) return;
            inflightRef.current = true;
            setBusy(true);
            setActionError(null);
            try {
              const access = await getAccessToken();
              const res = await apiFetch<Booking>(
                `/bookings/${booking.id}/cancel`,
                { method: "POST", body: JSON.stringify({ reason: "customer_cancel" }) },
                access,
              );
              setBooking(res);
              await loadSummary(res.id);
              await refreshHistory();
            } catch (e) {
              setActionError(e instanceof Error ? e.message : "Cancel failed");
            } finally {
              inflightRef.current = false;
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  async function onOpenNotification(n: AppNotification) {
    const access = await getAccessToken();
    if (!access) return;
    try {
      if (!n.read_at) {
        await markNotificationRead(access, n.id);
      }
      await refreshNotifications();
      if (n.booking_id) {
        await loadSummary(n.booking_id, { authoritative: true });
        setScreen("active");
      }
    } catch (e) {
      setNotifError(e instanceof Error ? e.message : "Could not open notification");
    }
  }

  async function onStartSandboxPay() {
    if (!booking || booking.status !== "CLOSED" || payBusy) return;
    setPayBusy(true);
    setPayError(null);
    try {
      const access = await getAccessToken();
      if (!access) return;
      const p = await initiatePayment(access, booking.id, payIdemRef.current);
      setPayments((prev) => {
        const rest = prev.filter((x) => x.id !== p.id);
        return [p, ...rest];
      });
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Payment init failed");
      await refreshPayments(booking.id).catch(() => undefined);
    } finally {
      setPayBusy(false);
    }
  }

  async function onSandboxOutcome(paymentId: string, outcome: "succeed" | "fail" | "cancel") {
    if (payBusy) return;
    setPayBusy(true);
    setPayError(null);
    try {
      const access = await getAccessToken();
      if (!access) return;
      const p = await sandboxSimulate(access, paymentId, outcome);
      setPayments((prev) => prev.map((x) => (x.id === p.id ? p : x)));
      payIdemRef.current = newPayIdemKey();
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Sandbox outcome failed");
      if (booking) await refreshPayments(booking.id).catch(() => undefined);
    } finally {
      setPayBusy(false);
    }
  }

  async function onSignOut() {
    wsRef.current?.close();
    await signOut();
    setBooking(null);
    setSummary(null);
    setNotifications([]);
    setUnreadCount(0);
    setPayments([]);
    payIdemRef.current = newPayIdemKey();
    setScreen("book");
  }

  if (!ready) {
    return (
      <View style={styles.container}>
        <ActivityIndicator accessibilityLabel="Loading" />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.brand} accessibilityRole="header">
        RideNova
      </Text>
      <Text style={styles.title}>Customer app</Text>
      <Text style={styles.meta}>API: {apiBase}</Text>
      {error ? <Text style={styles.warn}>{error}</Text> : null}

      {user ? (
        <>
          <Text style={styles.body}>Signed in as {user.display_name}</Text>
          <View style={styles.row}>
            <Button title="Book" onPress={() => setScreen("book")} />
            <Button title="Active" onPress={() => setScreen("active")} />
            <Button title="History" onPress={() => setScreen("history")} />
            <Button
              title={unreadCount > 0 ? `Inbox (${unreadCount})` : "Inbox"}
              onPress={() => {
                setScreen("inbox");
                void refreshNotifications();
              }}
            />
          </View>
          <Button title="Sign out" onPress={() => void onSignOut()} />

          {screen === "book" && (
            <>
              <Text style={styles.section}>Pickup</Text>
              <Text style={styles.body}>{pickup?.label || "Not set"}</Text>
              <Text style={styles.meta} accessibilityLabel="Location permission">
                Permission: {permStatus}
              </Text>
              <Button title="Use current location" onPress={() => void useCurrentPickup()} />
              <Text style={styles.meta}>Or choose a labeled place (not live geocoding):</Text>
              {PLACE_PRESETS.map((p) => (
                <Pressable
                  key={`p-${p.id}`}
                  onPress={() => applyPreset("pickup", p)}
                  style={styles.chip}
                  accessibilityRole="button"
                  accessibilityLabel={`Pickup ${p.label}`}
                >
                  <Text>{p.label}</Text>
                </Pressable>
              ))}

              <Text style={styles.section}>Destination</Text>
              <Text style={styles.body}>{drop?.label || "Not set"}</Text>
              {PLACE_PRESETS.map((p) => (
                <Pressable
                  key={`d-${p.id}`}
                  onPress={() => applyPreset("drop", p)}
                  style={styles.chip}
                  accessibilityRole="button"
                  accessibilityLabel={`Destination ${p.label}`}
                >
                  <Text>{p.label}</Text>
                </Pressable>
              ))}

              <Button
                title={showManual ? "Hide manual coordinates" : "Manual coordinates"}
                onPress={() => setShowManual((v) => !v)}
              />
              {showManual && (
                <>
                  <Text style={styles.meta}>Manual entry — no address search configured</Text>
                  <TextInput
                    style={styles.input}
                    value={manualPickup.lat}
                    onChangeText={(t) => setManualPickup((m) => ({ ...m, lat: t }))}
                    placeholder="Pickup lat"
                    accessibilityLabel="Pickup latitude"
                  />
                  <TextInput
                    style={styles.input}
                    value={manualPickup.lon}
                    onChangeText={(t) => setManualPickup((m) => ({ ...m, lon: t }))}
                    placeholder="Pickup lon"
                    accessibilityLabel="Pickup longitude"
                  />
                  <TextInput
                    style={styles.input}
                    value={manualDrop.lat}
                    onChangeText={(t) => setManualDrop((m) => ({ ...m, lat: t }))}
                    placeholder="Drop lat"
                    accessibilityLabel="Drop latitude"
                  />
                  <TextInput
                    style={styles.input}
                    value={manualDrop.lon}
                    onChangeText={(t) => setManualDrop((m) => ({ ...m, lon: t }))}
                    placeholder="Drop lon"
                    accessibilityLabel="Drop longitude"
                  />
                  <Button title="Apply coordinates" onPress={applyManual} />
                </>
              )}

              <Text style={styles.section}>Fare estimate</Text>
              {estimate ? (
                <>
                  <Text style={styles.body} accessibilityRole="text">
                    {formatInr(estimate.estimate_paise)} · {estimate.distance_km} km ·{" "}
                    {estimate.duration_min} min
                  </Text>
                  {estimate.lines.map((line) => (
                    <Text key={line.label} style={styles.meta}>
                      {line.label}: {formatInr(line.paise)}
                    </Text>
                  ))}
                </>
              ) : (
                <Text style={styles.meta}>Estimating…</Text>
              )}
              <Button
                title={busy ? "Requesting…" : "Confirm ride"}
                onPress={() => void onBook()}
                disabled={busy || !estimate}
              />
            </>
          )}

          {screen === "active" && (
            <>
              <Text style={styles.section}>Current trip</Text>
              {!booking ? (
                <Text style={styles.meta}>No active booking. Create one from Book.</Text>
              ) : (
                <>
                  <Text style={styles.body}>{statusLabel(booking.status)}</Text>
                  <Text style={styles.meta}>Ref: {booking.id}</Text>
                  <Text style={styles.meta}>
                    Fare {formatInr(booking.estimate_paise)} · WS {wsStatus}
                    {staleHint ? " · may be stale — refreshing…" : ""}
                  </Text>
                  {pickup && drop && (
                    <Text style={styles.meta}>
                      {pickup.label} → {drop.label}
                    </Text>
                  )}
                  {summary?.assigned_driver && (
                    <Text style={styles.body}>
                      Driver: {summary.assigned_driver.display_name} ·{" "}
                      {summary.assigned_driver.vehicle_type}
                    </Text>
                  )}
                  {booking.status === "NO_DRIVER_FOUND" && (
                    <Text style={styles.warn}>
                      No driver available. Try again later or change pickup.
                    </Text>
                  )}
                  <Button title="Refresh status" onPress={() => void resync(booking.id)} />
                  {summary?.can_cancel !== false && (
                    <Button title="Cancel ride" onPress={() => void onCancel()} disabled={busy} />
                  )}

                  {booking.status === "CLOSED" && (
                    <>
                      <Text style={styles.section}>Sandbox payment</Text>
                      <Text style={styles.warn}>
                        TEST MODE — sandbox payments do not move real money.
                      </Text>
                      <Text style={styles.body}>
                        Amount {formatInr(booking.estimate_paise)} ({booking.currency || "INR"})
                      </Text>
                      <Button
                        title="Refresh payments"
                        onPress={() => void refreshPayments(booking.id)}
                        disabled={payBusy}
                      />
                      <Button
                        title={payBusy ? "Working…" : "Initiate sandbox payment"}
                        onPress={() => void onStartSandboxPay()}
                        disabled={payBusy || payments.some((p) => p.status === "SUCCEEDED")}
                      />
                      {payments.map((p) => (
                        <View key={p.id} style={styles.histRow}>
                          <Text style={styles.body}>
                            {p.status} · {formatInr(p.amount_paise)}
                          </Text>
                          <Text style={styles.meta}>Ref {p.gateway_ref}</Text>
                          {p.status === "PENDING" && (
                            <>
                              <Button
                                title="Simulate success"
                                onPress={() => void onSandboxOutcome(p.id, "succeed")}
                                disabled={payBusy}
                              />
                              <Button
                                title="Simulate fail"
                                onPress={() => void onSandboxOutcome(p.id, "fail")}
                                disabled={payBusy}
                              />
                              <Button
                                title="Cancel attempt"
                                onPress={() => void onSandboxOutcome(p.id, "cancel")}
                                disabled={payBusy}
                              />
                            </>
                          )}
                        </View>
                      ))}
                      {payError ? <Text style={styles.warn}>{payError}</Text> : null}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {screen === "history" && (
            <>
              <Text style={styles.section}>Booking history</Text>
              <Button title="Refresh" onPress={() => void refreshHistory()} />
              {history.length === 0 ? (
                <Text style={styles.meta}>No bookings yet</Text>
              ) : (
                history.map((b) => (
                  <Pressable
                    key={b.id}
                    style={styles.histRow}
                    onPress={() => {
                      setBooking(b);
                      setScreen("active");
                      void loadSummary(b.id);
                      void connectWs(b.id);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Open booking ${statusLabel(b.status)}`}
                  >
                    <Text style={styles.body}>
                      {statusLabel(b.status)} · {formatInr(b.estimate_paise)}
                    </Text>
                    <Text style={styles.meta}>{b.id.slice(0, 8)}… · {new Date(b.created_at).toLocaleString()}</Text>
                  </Pressable>
                ))
              )}
            </>
          )}

          {screen === "inbox" && (
            <>
              <Text style={styles.section}>Notifications</Text>
              <Text style={styles.meta}>Unread: {unreadCount}</Text>
              <Button title="Refresh" onPress={() => void refreshNotifications()} />
              {notifError ? <Text style={styles.warn}>{notifError}</Text> : null}
              {notifications.length === 0 ? (
                <Text style={styles.meta}>No notifications yet</Text>
              ) : (
                notifications.map((n) => (
                  <Pressable
                    key={n.id}
                    style={styles.histRow}
                    onPress={() => void onOpenNotification(n)}
                    accessibilityRole="button"
                    accessibilityLabel={n.title}
                  >
                    <Text style={styles.body}>
                      {n.read_at ? "" : "• "}
                      {n.title}
                    </Text>
                    <Text style={styles.meta}>{n.body}</Text>
                    <Text style={styles.meta}>{new Date(n.created_at).toLocaleString()}</Text>
                  </Pressable>
                ))
              )}
            </>
          )}

          {actionError ? <Text style={styles.warn}>{actionError}</Text> : null}
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
            accessibilityLabel="Email"
          />
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            accessibilityLabel="Password"
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
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#C5CCD4",
    borderRadius: 6,
    marginVertical: 2,
    width: "100%",
    maxWidth: 360,
  },
  histRow: {
    width: "100%",
    maxWidth: 360,
    padding: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E4E8EC",
    marginBottom: 6,
  },
});
