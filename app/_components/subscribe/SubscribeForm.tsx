"use client";

import { useState } from "react";
import Tooltip from "@/app/_components/common/Tooltip";
import { siteConfig } from "@/lib/siteConfig";
import { useAuthStore } from "@/stores/authStore";

const API_BASE = `https://${siteConfig.workerApi}`;

type Status = "idle" | "loading" | "success" | "error";

export default function SubscribeForm() {
  if (!siteConfig.featureRssPush) return null;
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
      <div className="flex items-center gap-2 mb-1 pl-4 border-l-4 border-indigo-500">
        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          订阅技术速递
        </h4>
        <Tooltip text="周末推送原创实战笔记。涵盖前后端工程化（框架选型/性能调优）、独立开发实战（域名/CI/CD 踩坑记录）、AI 应用落地（模型接入真实产品的麻烦事）、底层知识补全（网络协议/数据库原理/操作系统）以及工具链与效率（编辑器配置/调试技巧/自动化脚本）">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold
                          text-slate-400 cursor-help bg-slate-200 dark:bg-slate-700
                          hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-500 transition-colors">
            ?
          </span>
        </Tooltip>
      </div>
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
