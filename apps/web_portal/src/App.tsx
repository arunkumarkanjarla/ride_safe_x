import { FormEvent, useEffect, useState } from "react";
import { ApiError, fetchMe, login, logout, refresh } from "./api";
import { NotificationsPanel } from "./NotificationsPanel";
import { OpsDashboard } from "./OpsDashboard";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "./session";
import type { UserOut } from "./types";
import "./styles.css";

type View = "loading" | "login" | "home" | "error";

export function App() {
  const [view, setView] = useState<View>("loading");
  const [user, setUser] = useState<UserOut | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [section, setSection] = useState<"overview" | "dispatch" | "inbox">("overview");

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    setView("loading");
    setNetworkError(null);
    try {
      let access = getAccessToken();
      const refreshTok = getRefreshToken();
      if (!access && refreshTok) {
        const tokens = await refresh(refreshTok);
        setAccessToken(tokens.access_token);
        setRefreshToken(tokens.refresh_token);
        access = tokens.access_token;
        setUser(tokens.user);
        setView("home");
        return;
      }
      if (access) {
        const me = await fetchMe(access);
        setUser(me);
        setView("home");
        return;
      }
      setView("login");
    } catch (err) {
      clearSession();
      if (err instanceof ApiError && err.status === 401) {
        setView("login");
        return;
      }
      setNetworkError(err instanceof Error ? err.message : "Network error");
      setView("error");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!email.trim() || password.length < 8) {
      setFormError("Enter a valid email and password (min 8 characters).");
      return;
    }
    setBusy(true);
    try {
      const tokens = await login({ email: email.trim(), password });
      setAccessToken(tokens.access_token);
      setRefreshToken(tokens.refresh_token);
      setUser(tokens.user);
      setPassword("");
      setView("home");
    } catch (err) {
      clearSession();
      if (err instanceof ApiError) {
        if (err.status === 401) setFormError("Invalid email or password.");
        else if (err.status === 429) setFormError("Too many attempts. Try later.");
        else setFormError("Sign-in failed.");
      } else {
        setFormError("Cannot reach the API. Is the backend running?");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    const access = getAccessToken();
    const refreshTok = getRefreshToken();
    try {
      if (access) await logout(access, refreshTok);
    } catch {
      /* still clear local session */
    }
    clearSession();
    setUser(null);
    setSection("overview");
    setView("login");
  }

  const canReadAudit = user?.permissions.includes("audit.read");
  const canManageUsers = user?.permissions.includes("users.manage");
  const canReadBookings = user?.permissions.includes("bookings.read");
  const canReadDispatch = !!user?.permissions.includes("dispatch.read");
  const canRetry = !!user?.permissions.includes("dispatch.retry");
  const canCancel = !!user?.permissions.includes("bookings.cancel");
  const canReadDrivers = !!user?.permissions.includes("drivers.read");
  const canNotifications = !!user?.permissions.includes("notifications.read_self");
  const canNotifHealth = !!user?.permissions.includes("notifications.ops_health");

  return (
    <main className={`shell ${view === "home" && canReadBookings ? "shell-wide" : ""}`}>
      <p className="brand">RideNova</p>
      <h1>Operations portal</h1>
      <p className="lede">
        Phase 4 dispatch center. Authorization is enforced by the API; nav hints are UX only.
      </p>

      {view === "loading" && <p>Restoring session…</p>}

      {view === "error" && (
        <section>
          <p className="warn">{networkError}</p>
          <button type="button" onClick={() => void bootstrap()}>
            Retry
          </button>
        </section>
      )}

      {view === "login" && (
        <form className="card" onSubmit={onSubmit} noValidate>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          {formError && <p className="warn">{formError}</p>}
          <button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}

      {view === "home" && user && (
        <>
          <section className="card">
            <p>
              Signed in as <strong>{user.display_name}</strong> ({user.email})
            </p>
            <p className="muted">
              Roles: {user.roles.map((r) => r.code).join(", ") || "none"}
            </p>
            <nav className="nav" aria-label="Permission-aware navigation">
              <button
                type="button"
                className={section === "overview" ? "on" : "ghost"}
                onClick={() => setSection("overview")}
              >
                Overview
              </button>
              <button
                type="button"
                className={`${canReadBookings ? "on" : "off"} ${section === "dispatch" ? "active-tab" : ""}`}
                disabled={!canReadBookings}
                onClick={() => canReadBookings && setSection("dispatch")}
              >
                Dispatch
              </button>
              <button
                type="button"
                className={`${canNotifications ? "on" : "off"} ${section === "inbox" ? "active-tab" : ""}`}
                disabled={!canNotifications}
                onClick={() => canNotifications && setSection("inbox")}
              >
                Inbox
              </button>
              <span className={canManageUsers ? "on" : "off"}>Users</span>
              <span className={canReadAudit ? "on" : "off"}>Audit</span>
            </nav>
            <button type="button" onClick={() => void onLogout()}>
              Sign out
            </button>
          </section>

          {section === "overview" && (
            <section className="card">
              {!canReadBookings ? (
                <p className="muted">
                  Limited portal access. Dispatch tools appear when your role includes{" "}
                  <code>bookings.read</code>.
                </p>
              ) : (
                <p className="muted">
                  Open <strong>Dispatch</strong> to monitor bookings, offers, and authorized
                  operational actions.
                </p>
              )}
            </section>
          )}

          {section === "dispatch" && canReadBookings && (
            <OpsDashboard
              canReadDispatch={canReadDispatch}
              canRetry={canRetry}
              canCancel={canCancel}
              canReadDrivers={canReadDrivers}
            />
          )}

          {section === "inbox" && canNotifications && (
            <NotificationsPanel
              canOpsHealth={canNotifHealth}
              onOpenBooking={() => setSection("dispatch")}
            />
          )}
        </>
      )}
    </main>
  );
}
