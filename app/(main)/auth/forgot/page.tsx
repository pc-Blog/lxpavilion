"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { forgotPassword, resetPassword } from "@/lib/api/auth";
import Link from "next/link";
import { siteConfig } from "@/lib/siteConfig";

const HASH_KEY = "blog-reset-hash";
const EMAIL_KEY = "blog-reset-email";
const USERNAME_KEY = "blog-reset-username";

export default function ForgotPage() {
  if (!siteConfig.featureAuth) {
    return (
      <div className="max-w-sm mx-auto mt-12">
        <div className="glass-card p-12 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white mb-2">Reset Password</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">功能未启用。</p>
        </div>
      </div>
    );
  }

  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setLoading(true);
    try {
      const { hash, username } = await forgotPassword(email.trim());
      localStorage.setItem(HASH_KEY, hash);
      localStorage.setItem(EMAIL_KEY, email.trim());
      if (username) localStorage.setItem(USERNAME_KEY, username);
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !password.trim()) return;
    setError("");
    setLoading(true);
    try {
      const hash = localStorage.getItem(HASH_KEY);
      const savedEmail = localStorage.getItem(EMAIL_KEY);
      if (!hash || !savedEmail) {
        setError("验证码已过期，请重新获取");
        setStep("email");
        return;
      }
      await resetPassword({ email: savedEmail, code: code.trim(), hash, password });
      localStorage.removeItem(HASH_KEY);
      localStorage.removeItem(EMAIL_KEY);
      localStorage.removeItem(USERNAME_KEY);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "重置失败");
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") {
    return (
      <div className="max-w-sm mx-auto mt-12">
        <div className="glass-card p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white mb-2">密码重置成功</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">请使用新密码登录。</p>
          <Link href="/auth/login" className="inline-block py-2.5 px-6 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors">
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <div className="glass-card p-6">
        {step === "email" ? (
          <>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Reset Password</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">输入绑定账号的邮箱，获取验证码。</p>
            <form onSubmit={handleSendCode} className="flex flex-col gap-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Code"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Enter Code</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
              验证码已发送至 <span className="text-indigo-500">{localStorage.getItem(EMAIL_KEY) || email}</span>
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">
              账号：<span className="text-indigo-500">{localStorage.getItem(USERNAME_KEY) || "-"}</span>
            </p>
            <form onSubmit={handleReset} className="flex flex-col gap-4">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="验证码"
                maxLength={6}
                className="glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50 text-center text-lg tracking-widest"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New Password *"
                className="glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          </>
        )}

        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          <Link href="/auth/login" className="text-indigo-500 hover:underline">← Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
