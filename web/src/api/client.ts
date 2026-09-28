// Small fetch wrapper: base URL, JWT header, JSON or multipart, typed errors.
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "assettrace.token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Error from the API, carrying the backend's { code, message, details }. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { fields?: Record<string, string> } & Record<string, unknown>,
  ) {
    super(message);
  }
}

// Called when the API says the session is gone (set by AuthContext).
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

type Options = {
  method?: "GET" | "POST" | "PATCH" | "PUT";
  body?: unknown; // sent as JSON
  form?: FormData; // sent as multipart (browser sets the boundary)
  query?: Record<string, string | number | boolean | undefined | null>;
};

function buildUrl(path: string, query?: Options["query"]) {
  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function request(path: string, opts: Options = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET"),
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check your internet and try again.");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const err = data?.error;
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, err?.code ?? "INTERNAL_ERROR", err?.message ?? "Something went wrong.", err?.details);
  }
  return res;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const res = await request(path, opts);
  return (await res.json()) as T;
}

/** For images behind login: returns an object URL usable in <img src>. */
export async function apiBlobUrl(path: string): Promise<string> {
  const res = await request(path);
  return URL.createObjectURL(await res.blob());
}

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number };
