"use client";

import { useState } from "react";

const API_BASE = "https://api.lxpavilion.top";

type Status = "idle" | "loading" | "success" | "error";

export default function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch(`${API_BASE}/api/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (data.code === 1) {
        setStatus("success");
        setMsg("订阅成功 🎉 欢迎加入！");
        setEmail("");
      } else {
        setStatus("error");
        setMsg(data.msg || "订阅失败，请稍后重试");
      }
    } catch {
      setStatus("error");
      setMsg("网络错误，请稍后重试");
    }
  };

  return (
    <div className="glass-card p-5">
      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1 pl-4 border-l-4 border-indigo-500">
        订阅技术速递
      </h4>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 pl-4">
        每周一篇，随时退订
      </p>

      {status === "success" ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400 pl-4">{msg}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2 px-4">
          <input
            type="email"
            required
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "loading"}
            className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white/80 px-3 py-2 text-xs
                       placeholder-slate-400 outline-none transition
                       focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20
                       dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200
                       dark:placeholder-slate-500 dark:focus:border-indigo-400"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white
                       transition hover:bg-indigo-700 active:bg-indigo-800
                       disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "loading" ? "..." : "订阅"}
          </button>
        </form>
      )}

      {status === "error" && (
        <p className="mt-2 text-xs text-red-500 dark:text-red-400 pl-4">{msg}</p>
      )}
    </div>
  );
}
