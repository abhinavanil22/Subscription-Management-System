import type { ApiResponse } from "../../shared/constants";
const BASE = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000/api/v1";
export const getToken = () => localStorage.getItem("token");
export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    method: opts.method ?? "GET",
    headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) throw new Error(json.error.message);
  return json.data;
}
