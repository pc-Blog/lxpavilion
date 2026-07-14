"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { register } from "@/lib/api/auth";
import Link from "next/link";
import { siteConfig } from "@/lib/siteConfig";

export default function RegisterPage() {
  if (!siteConfig.featureAuth) {
    return (
      <div className="max-w-sm mx-auto mt-12">
        <div className="glass-card p-12 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white mb-2">Register</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            注册功能未启用。
          </p>
        </div>
      </div>
    );
  }
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setError("");
    setLoading(true);
    try {
      await register({ username: username.trim(), password, nickname: nickname.trim() || undefined, email: email.trim() || undefined });
      router.push("/auth/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-12">
      <div className="glass-card p-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Register</h1>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">Create a new account.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username *" className="glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password *" className="glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Nickname (optional)" className="glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={loading} className="py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          Have an account? <Link href="/auth/login" className="text-indigo-500 hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
