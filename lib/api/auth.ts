import type { User } from "@/lib/types";
import { siteConfig } from "@/lib/siteConfig";
import { useAuthStore } from "@/stores/authStore";
import { isTokenExpired } from "@/lib/jwt-expiry";

const WORKER_API = `https://${siteConfig.workerApi}/api`;

async function workerFetch(path: string, options?: RequestInit) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token && isTokenExpired(token)) {
    // token 已过期 → 清理登录态，视为未携带 token
    useAuthStore.getState().logout();
  }
  const finalToken = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${WORKER_API}${path}`, {
    headers: { "Content-Type": "application/json", ...(finalToken ? { Authorization: `Bearer ${finalToken}` } : {}) },
    ...options,
  });
  const json = await res.json();
  if (json.code !== 1) throw new Error(json.msg || "Request failed");
  // 响应携带新 token（登录/续期场景）→ 自动落库，保持会话滑动续期
  if (json.data && typeof json.data.token === "string") {
    useAuthStore.getState().setToken(json.data.token);
  }
  return json.data;
}

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  return workerFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function register(data: { username: string; password: string; nickname?: string; avatar?: string; email?: string }): Promise<User> {
  return workerFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getGithubUrl(): Promise<string> {
  const data = await workerFetch("/auth/github");
  return (data as { url: string }).url;
}

export async function getMe(): Promise<{ token: string; user: User }> {
  return workerFetch("/auth/me");
}

export async function forgotPassword(email: string): Promise<{ hash: string; username?: string }> {
  return workerFetch("/auth/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(data: { email: string; code: string; hash: string; password: string }): Promise<void> {
  return workerFetch("/auth/reset", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProfile(data: { nickname?: string; email?: string }): Promise<User> {
  return workerFetch("/auth/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  return workerFetch("/auth/password", {
    method: "PUT",
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

export async function deleteAccount(): Promise<void> {
  return workerFetch("/auth/delete-account", {
    method: "POST",
  });
}
