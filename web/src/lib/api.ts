export type ApiError = { error: string; status: number };

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...init, headers, credentials: "include" });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T);
  if (res.status === 401 && !path.startsWith("/api/auth")) {
    if (
      typeof location !== "undefined" &&
      !location.pathname.startsWith("/login") &&
      !location.pathname.startsWith("/s/")
    ) {
      location.assign("/login");
    }
    throw Object.assign(new Error("ログインしてください"), { status: 401 });
  }
  if (!res.ok) {
    const err: ApiError = {
      error: (data as { error?: string }).error || `error ${res.status}`,
      status: res.status,
    };
    throw err;
  }
  return data;
}

export function isApiError(e: unknown): e is ApiError {
  return Boolean(e && typeof e === "object" && "error" in e && "status" in e);
}
