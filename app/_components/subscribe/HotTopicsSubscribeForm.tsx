"use client";

import { useState } from "react";
import Tooltip from "@/app/_components/common/Tooltip";
import { siteConfig } from "@/lib/siteConfig";
import { useAuthStore } from "@/stores/authStore";

const API_BASE = `https://${siteConfig.workerApi}`;

type Status = "idle" | "loading" | "success" | "error";

export default function HotTopicsSubscribeForm() {
  if (!siteConfig.featureHotTopics) return null;
  const user = useAuthStore((s) => s.user);
  const [email, setEmail] = useState(user?.email || "");
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch(`${API_BASE}/api/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, group: "hot-topics" }),
      });

      const data = await res.json();

      if (data.code === 1) {
        setStatus("success");
        setMsg("订阅成功 🎉 每日热点准时送达！");
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
    <div className="rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5">
      <div className="flex items-center gap-2 mb-1 pl-4 border-l-4 border-orange-500">
        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          订阅技术热点
        </h4>
        <Tooltip text="AI 每日扫描 20+ 技术关键词，自动检索全网热点、去重验证、整理分类。覆盖前端、AI、后端、云原生等多领域，每条热点附带多角度观点整理，附原文链接一键直达。每天 09:00 推送">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold
                          text-slate-400 cursor-help bg-slate-200 dark:bg-slate-700
                          hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500 transition-colors">
            ?
          </span>
        </Tooltip>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 pl-4">
        AI 每日精选 · 随时退订
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
                       focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20
                       dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200
                       dark:placeholder-slate-500 dark:focus:border-orange-400"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="shrink-0 rounded-lg bg-orange-600 px-4 py-2 text-xs font-medium text-white
                       transition hover:bg-orange-700 active:bg-orange-800
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
