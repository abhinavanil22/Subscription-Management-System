import type { ApiResponse } from "../../shared/constants";

const BASE = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000/api/v1";

export const getToken = () => localStorage.getItem("token");
export const getRole = () => localStorage.getItem("role");
export const getUserEmail = () => localStorage.getItem("email") ?? "user@brightloop.test";

export const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("email");
};

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(BASE + path, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) throw new Error(json.error.message);
  return json.data;
}

export async function apiWithMeta<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<{ data: T; meta?: { page: number; limit: number; total: number } }> {
  const token = getToken();
  const res = await fetch(BASE + path, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) throw new Error(json.error.message);
  return { data: json.data, meta: (json as any).meta };
}
