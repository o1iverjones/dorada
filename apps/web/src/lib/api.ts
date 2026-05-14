const BASE = "/api/v1";

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("pulpito_access_token");
  const isFormData = init.body instanceof FormData;
  const hasBody = init.body != null;
  const headers: Record<string, string> = {
    ...(hasBody && !isFormData ? { "Content-Type": "application/json" } : {}),
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${localStorage.getItem("pulpito_access_token")}`;
      const retry = await fetch(`${BASE}${path}`, { ...init, headers });
      if (!retry.ok) {
        const body = await retry.json().catch(() => ({})) as { error?: { code?: string; message?: string } };
        throw new ApiError(retry.status, body.error?.code ?? "UNKNOWN", body.error?.message ?? retry.statusText);
      }
      return retry.json() as Promise<T>;
    }
    clearTokens();
    window.location.href = "/login";
    throw new ApiError(401, "UNAUTHORIZED", "Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: { code?: string; message?: string } };
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN", body.error?.message ?? res.statusText);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const token = localStorage.getItem("pulpito_refresh_token");
    if (!token) return false;
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: token }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem("pulpito_access_token", data.access_token);
      localStorage.setItem("pulpito_refresh_token", data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export function clearTokens() {
  localStorage.removeItem("pulpito_access_token");
  localStorage.removeItem("pulpito_refresh_token");
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("pulpito_access_token", accessToken);
  localStorage.setItem("pulpito_refresh_token", refreshToken);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  uploadFile: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: "POST", body: formData }),
};
