import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";

export type UserOut = {
  id: string;
  email: string;
  display_name: string;
  status: string;
  roles: { code: string; name: string }[];
  permissions: string[];
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserOut;
};

const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

let memoryAccess: string | null = null;
let memoryRefresh: string | null = null;

async function saveTokens(access: string, refresh: string) {
  memoryAccess = access;
  memoryRefresh = refresh;
  try {
    await SecureStore.setItemAsync("rn_access", access);
    await SecureStore.setItemAsync("rn_refresh", refresh);
  } catch {
    /* memory fallback when SecureStore unavailable */
  }
}

async function clearTokens() {
  memoryAccess = null;
  memoryRefresh = null;
  try {
    await SecureStore.deleteItemAsync("rn_access");
    await SecureStore.deleteItemAsync("rn_refresh");
  } catch {
    /* ignore */
  }
}

async function loadTokens(): Promise<{
  access: string | null;
  refresh: string | null;
}> {
  try {
    const access = (await SecureStore.getItemAsync("rn_access")) || memoryAccess;
    const refresh =
      (await SecureStore.getItemAsync("rn_refresh")) || memoryRefresh;
    return { access, refresh };
  } catch {
    return { access: memoryAccess, refresh: memoryRefresh };
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
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

export function useAuth() {
  const [user, setUser] = useState<UserOut | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bootstrap = useCallback(async () => {
    setError(null);
    try {
      const { access, refresh } = await loadTokens();
      if (!access && refresh) {
        const tokens = await api<TokenResponse>("/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refresh }),
        });
        await saveTokens(tokens.access_token, tokens.refresh_token);
        setUser(tokens.user);
        return;
      }
      if (access) {
        const me = await api<UserOut>("/auth/me", {
          headers: { Authorization: `Bearer ${access}` },
        });
        setUser(me);
        return;
      }
      setUser(null);
    } catch (e) {
      await clearTokens();
      setUser(null);
      const status = (e as { status?: number }).status;
      if (status !== 401) setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const signIn = async (email: string, password: string) => {
    setError(null);
    const tokens = await api<TokenResponse>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    await saveTokens(tokens.access_token, tokens.refresh_token);
    setUser(tokens.user);
  };

  const signOut = async () => {
    const { access, refresh } = await loadTokens();
    try {
      if (access) {
        await api("/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: refresh }),
        });
      }
    } catch {
      /* clear anyway */
    }
    await clearTokens();
    setUser(null);
  };

  const getAccessToken = async () => (await loadTokens()).access;

  return { user, ready, error, signIn, signOut, getAccessToken, apiBase: API_BASE };
}
