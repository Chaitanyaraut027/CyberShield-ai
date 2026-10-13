import AsyncStorage from "@react-native-async-storage/async-storage";
import { localApi, ApiError } from "./offline/engine";

let cachedToken: string | null = null;
let cachedUser: any = null;
let cachedBase: string = "https://cybershield-ai-1-apmx.onrender.com";

const TOKEN_KEY = "cs_token";
const USER_KEY = "cs_user";
const BASE_KEY = "cs_api";

export const TokenStore = {
  get: () => cachedToken,
  set: (t: string) => {
    cachedToken = t;
    AsyncStorage.setItem(TOKEN_KEY, t).catch(() => {});
  },
  clear: () => {
    cachedToken = null;
    cachedUser = null;
    AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
    AsyncStorage.removeItem(USER_KEY).catch(() => {});
  },
  user: () => cachedUser,
  setUser: (u: any) => {
    cachedUser = u;
    AsyncStorage.setItem(USER_KEY, JSON.stringify(u)).catch(() => {});
  },
};

export const getBase = () => cachedBase;
export const setBase = (v: string) => {
  cachedBase = v;
  if (v) AsyncStorage.setItem(BASE_KEY, v).catch(() => {});
  else AsyncStorage.removeItem(BASE_KEY).catch(() => {});
};

export async function initStorage() {
  try {
    const [t, u, b] = await Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(USER_KEY),
      AsyncStorage.getItem(BASE_KEY),
    ]);
    if (t) cachedToken = t;
    if (u) {
      try {
        cachedUser = JSON.parse(u);
      } catch {}
    }
    if (b) cachedBase = b;
  } catch {}
}

class Unreachable extends Error {}

async function serverApi<T>(path: string, method: string, body: unknown, token: string | null): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(getBase() + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Unreachable();
  }
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  if (!res.ok && !isJson) throw new Unreachable();
  const data: any = isJson ? await res.json().catch(() => ({})) : {};
  if (res.status === 401 && token) {
    TokenStore.clear();
  }
  if (!res.ok) {
    throw new ApiError(typeof data.detail === "string" ? data.detail : data.detail?.[0]?.msg || "Request failed", res.status);
  }
  return data as T;
}

export async function api<T = any>(path: string, method = "GET", body?: unknown): Promise<T> {
  const token = TokenStore.get();
  const localSession = !!token && token.startsWith("local.");
  if (!localSession && getBase()) {
    try {
      return await serverApi<T>(path, method, body, token);
    } catch (e) {
      if (!(e instanceof Unreachable)) throw e;
    }
  }
  return (await localApi(path, method, body, token)) as T;
}

export type Scan = {
  id: number;
  kind: "url" | "sms" | "qr";
  input: string;
  verdict: "safe" | "suspicious" | "dangerous";
  score: number;
  reasons: string[];
  created_at: string;
};

export const Auth = {
  register: (name: string, email: string, password: string) =>
    api("/api/auth/register", "POST", { name, email, password }),
  login: (email: string, password: string) =>
    api("/api/auth/login", "POST", { email, password }),
};

export type Full = Scan & {
  confidence: number;
  engine: "ml+rules" | "rules";
  type: string;
  recommendation: string;
  explanation: string;
  flags: string[];
  breakdown: { name: string; points: number }[];
  checks: { name: string; status: "ok" | "warn" | "bad" | "na"; detail: string }[];
};
