import { localApi, ApiError } from "./offline/engine";

export const TokenStore = {
  get: () => localStorage.getItem("cs_token"),
  set: (t: string) => localStorage.setItem("cs_token", t),
  clear: () => { localStorage.removeItem("cs_token"); localStorage.removeItem("cs_user"); },
  user: () => { try { return JSON.parse(localStorage.getItem("cs_user") || "null"); } catch { return null; } },
  setUser: (u: any) => localStorage.setItem("cs_user", JSON.stringify(u)),
};
export const getBase = () => (localStorage.getItem("cs_api") || (import.meta as any).env?.VITE_API_URL || "").replace(/\/$/, "");
export const setBase = (v: string) => (v ? localStorage.setItem("cs_api", v) : localStorage.removeItem("cs_api"));

/** True inside the Android/iOS app (Capacitor). */
export const isNativeApp = () => !!(window as any).Capacitor?.isNativePlatform?.();

class Unreachable extends Error {}

async function serverApi<T>(path: string, method: string, body: unknown, token: string | null): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try { res = await fetch(getBase() + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Unreachable(); }
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  // Not JSON = no API behind this address (server stopped, proxy error, static host): treat as offline.
  if (!res.ok && !isJson) throw new Unreachable();
  const data: any = isJson ? await res.json().catch(() => ({})) : {};
  if (res.status === 401 && token) { TokenStore.clear(); location.reload(); }
  if (!res.ok) throw new ApiError(typeof data.detail === "string" ? data.detail : data.detail?.[0]?.msg || "Request failed", res.status);
  return data as T;
}

/**
 * Online-first, offline-capable.
 * - Signed in on this device (token "local.*") -> on-device engine, always.
 * - Otherwise try the server; if it cannot be reached, use the on-device engine.
 * - In the mobile app with no server URL set, the on-device engine is used directly.
 */
export async function api<T = any>(path: string, method = "GET", body?: unknown): Promise<T> {
  const token = TokenStore.get();
  const localSession = !!token && token.startsWith("local.");
  if (!localSession && (!isNativeApp() || getBase())) {
    try { return await serverApi<T>(path, method, body, token); }
    catch (e) { if (!(e instanceof Unreachable)) throw e; }
  }
  return (await localApi(path, method, body, token)) as T;
}

export type Scan = { id: number; kind: "url" | "sms" | "qr"; input: string; verdict: "safe" | "suspicious" | "dangerous"; score: number; reasons: string[]; created_at: string };
export const Auth = {
  register: (name: string, email: string, password: string) => api("/api/auth/register", "POST", { name, email, password }),
  login: (email: string, password: string) => api("/api/auth/login", "POST", { email, password }),
};

export type Full = Scan & { confidence: number; engine: "ml+rules" | "rules"; type: string; recommendation: string; explanation: string; flags: string[];
  breakdown: { name: string; points: number }[]; checks: { name: string; status: "ok" | "warn" | "bad" | "na"; detail: string }[] };
