import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const BASE_URL = Constants.expoConfig?.extra?.apiUrl ?? "https://api.dorada.com/api/v1";

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await SecureStore.getItemAsync("dorada_access_token");
  const headers: Record<string, string> = {
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = await SecureStore.getItemAsync("dorada_access_token");
      headers["Authorization"] = `Bearer ${newToken}`;
      const retry = await fetch(`${BASE_URL}${path}`, { ...init, headers });
      if (!retry.ok) {
        const body = await retry.json().catch(() => ({}));
        throw new ApiError(retry.status, body.code ?? "UNKNOWN", body.message ?? retry.statusText);
      }
      return retry.json() as Promise<T>;
    }
    await clearTokens();
    throw new ApiError(401, "UNAUTHORIZED", "Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: { code?: string; message?: string } });
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN", body.error?.message ?? res.statusText);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

async function tryRefresh(): Promise<boolean> {
  const token = await SecureStore.getItemAsync("dorada_refresh_token");
  if (!token) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: token }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    await SecureStore.setItemAsync("dorada_access_token", data.access_token);
    await SecureStore.setItemAsync("dorada_refresh_token", data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync("dorada_access_token");
  await SecureStore.deleteItemAsync("dorada_refresh_token");
}

export async function setTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync("dorada_access_token", accessToken);
  await SecureStore.setItemAsync("dorada_refresh_token", refreshToken);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
