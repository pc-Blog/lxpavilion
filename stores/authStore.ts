import { create } from "zustand";
import type { User } from "@/lib/types";
import { isTokenExpired } from "@/lib/jwt-expiry";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  hydrated: boolean;
  setAuth: (token: string, user: User) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

const USER_KEY = "blog-user";

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  token: null,
  isLoggedIn: false,
  hydrated: false,

  setAuth: (token, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user, isLoggedIn: true, hydrated: true });
  },

  setToken: (token) => {
    localStorage.setItem("token", token);
    set({ token });
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, isLoggedIn: false, hydrated: true });
  },
}));

// Restore from localStorage on load (sync — no flash)
if (typeof window !== "undefined") {
  const token = localStorage.getItem("token");
  if (token && !isTokenExpired(token)) {
    let user: User | null = null;
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) user = JSON.parse(raw);
    } catch { /* ignore */ }

    useAuthStore.setState({ token, user, isLoggedIn: true, hydrated: true });
  } else {
    // token 缺失或已过期 → 不恢复登录态，并清掉残留
    localStorage.removeItem("token");
    localStorage.removeItem(USER_KEY);
    useAuthStore.setState({ hydrated: true });
  }
}
