import type { User } from "@/lib/types";

const WORKER_API = "https://api.lxpavilion.top/api";

async function workerFetch(path: string, options?: RequestInit) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${WORKER_API}${path}`, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...options,
  });
  const json = await res.json();
  if (json.code !== 1) throw new Error(json.msg || "Request failed");
  return json.data;
}

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  return workerFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function register(data: { username: string; password: string; nickname?: string; avatar?: string }): Promise<User> {
  return workerFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getGithubUrl(): Promise<string> {
  const data = await workerFetch("/auth/github");
  return (data as { url: string }).url;
}

export async function getMe(): Promise<User> {
  return workerFetch("/auth/me");
}
