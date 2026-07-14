"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/authStore";
import GitHubButton from "@/app/_components/auth/GitHubButton";
import Link from "next/link";
import { siteConfig } from "@/lib/siteConfig";

export default function LoginPage() {
  if (!siteConfig.featureAuth) {
    return (
      <div className="max-w-sm mx-auto mt-12">
        <div className="glass-card p-12 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white mb-2">Sign In</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            登录功能未启用，请在 <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">lib/siteConfig.ts</code> 中设置 <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">featureAuth: true</code>。
          </p>
        </div>
      </div>
    );
  }

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setError("");
    setLoading(true);
    try {
      const data = await login(username.trim(), password);
      setAuth(data.token, data.user);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-12">
      <div className="glass-card p-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Sign In</h1>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">Sign in with password or GitHub.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username or Email" className="glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={loading} className="py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <div className="mt-3">
          <GitHubButton />
        </div>
        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          <Link href="/auth/forgot" className="text-indigo-500 hover:underline">Forgot</Link>
          <span className="mx-2">·</span>
          <Link href="/auth/register" className="text-indigo-500 hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
