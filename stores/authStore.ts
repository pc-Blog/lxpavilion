import { create } from "zustand";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  hydrated: boolean;
  setAuth: (token: string, user: User) => void;
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

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, isLoggedIn: false, hydrated: true });
  },
}));

// Restore from localStorage on load (sync — no flash)
if (typeof window !== "undefined") {
  const token = localStorage.getItem("token");
  if (token) {
    let user: User | null = null;
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) user = JSON.parse(raw);
    } catch { /* ignore */ }

    useAuthStore.setState({ token, user, isLoggedIn: true, hydrated: true });
  } else {
    useAuthStore.setState({ hydrated: true });
  }
}
