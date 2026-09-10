"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { getMe } from "@/lib/api/auth";

/**
 * 会话滑动续期：每次进入网页（页面首次加载）时，
 * 若本地存在未过期的 token，则调用 /api/auth/me —— Worker 会签发新的 7 天 token，
 * 由 workerFetch 自动落库（localStorage + store）。
 *
 * 续期失败（网络抖动、服务端异常）静默跳过：不登出、不改状态，下次进站再续。
 */
export default function AuthSessionRenewer() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  useEffect(() => {
    if (!isLoggedIn) return;
    getMe().catch(() => { /* 静默：续期失败不惩罚现有登录态 */ });
  }, [isLoggedIn]);

  return null;
}