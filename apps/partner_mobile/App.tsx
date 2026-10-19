import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "./src/auth";

const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

/** Phase 2 auth shell + Phase 8 empty notification inbox (no partner domain events yet). */
export default function App() {
  const { user, ready, error, signIn, signOut, getAccessToken, apiBase } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(0);
  const [inboxMsg, setInboxMsg] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    const access = await getAccessToken();
    if (!access) return;
    try {
      const res = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${access}` },
      });
      const body = await res.json();
      if (!res.ok) {
        setInboxMsg(body?.detail?.error || `HTTP ${res.status}`);
        return;
      }
      setUnread(body.unread_count || 0);
      setInboxMsg(
        "No partner workflow events yet — inbox is ready for future modules.",
      );
    } catch (e) {
      setInboxMsg(e instanceof Error ? e.message : "Inbox unavailable");
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      setInboxMsg(null);
      return;
    }
    void loadInbox();
  }, [user, loadInbox]);

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

  if (!ready) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>RideNova</Text>
      <Text style={styles.title}>Partner app</Text>
      <Text style={styles.meta}>API: {apiBase}</Text>
      {error ? <Text style={styles.warn}>{error}</Text> : null}
      {user ? (
        <>
          <Text style={styles.body}>Signed in as {user.display_name}</Text>
          <Text style={styles.meta}>{user.email}</Text>
          <Text style={styles.meta}>Roles: {user.roles.map((r) => r.code).join(", ")}</Text>
          <Text style={styles.section}>Notifications</Text>
          <Text style={styles.meta}>Unread: {unread}</Text>
          {inboxMsg ? <Text style={styles.meta}>{inboxMsg}</Text> : null}
          <Button title="Refresh inbox" onPress={() => void loadInbox()} />
          <Button
            title="Sign out"
            onPress={() => {
              setUnread(0);
              setInboxMsg(null);
              void signOut();
            }}
          />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3EFE6", alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  brand: { fontSize: 28, fontWeight: "700", color: "#0B6E4F" },
  title: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  section: { marginTop: 16, fontSize: 16, fontWeight: "600", color: "#1C2430" },
  body: { textAlign: "center", lineHeight: 22, color: "#1C2430" },
  meta: { fontSize: 12, color: "#5C6570", marginBottom: 4, textAlign: "center" },
  warn: { color: "#8A3B12", textAlign: "center" },
  input: { width: "100%", maxWidth: 360, borderWidth: 1, borderColor: "#C5CCD4", borderRadius: 6, padding: 10, backgroundColor: "#fff" },
});
