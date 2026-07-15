"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  const mounted = useRef(false);

  const update = useCallback(() => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? Math.min(Math.round((scrollTop / docHeight) * 100), 100) : 0;
    setProgress(pct);
    setAtBottom(pct >= 100);
    setVisible(scrollTop > 200);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", update, { passive: true });
    update();
    mounted.current = true;
    return () => window.removeEventListener("scroll", update);
  }, [update]);

  const handleClick = () => {
    window.scrollTo({
      top: atBottom ? 0 : document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  };

  const circumference = 2 * Math.PI * 18;
  const offset = circumference * (1 - progress / 100);

  return (
    <div
      className={`
        fixed bottom-8 right-8 z-50
        transition-all duration-500 ease-out
        ${visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-90 pointer-events-none"}
      `}
    >
      <button
        onClick={handleClick}
        className="relative w-14 h-14 rounded-full flex items-center justify-center outline-none group"
        title={atBottom ? "回到顶部" : "跳到底部"}
      >
        {/* 外层光晕 */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400/20 via-purple-400/10 to-pink-400/20 dark:from-indigo-500/20 dark:via-purple-500/10 dark:to-pink-500/20 blur-xl group-hover:blur-2xl transition-all duration-700 scale-110 group-hover:scale-125" />

        {/* 主背景 — 玻璃拟态 */}
        <div className="absolute inset-0.5 rounded-full bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg group-hover:shadow-indigo-500/20 group-hover:shadow-2xl transition-all duration-500" />

        {/* 进度环背景 */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
          <circle
            cx="24" cy="24" r="18" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            className="text-slate-200/60 dark:text-slate-700/60"
          />
          {/* 进度环 — 渐变色 */}
          <circle
            cx="24" cy="24" r="18" fill="none" strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-300 ease-out"
            style={{
              stroke: `url(${atBottom ? "#scrollUp" : "#scrollDown"})`,
            }}
          />
          {/* 渐变定义 */}
          <defs>
            <linearGradient id="scrollDown" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
            <linearGradient id="scrollUp" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
        </svg>

        {/* 中间内容 */}
        <div className="relative flex flex-col items-center justify-center leading-none">
          {/* 箭头图标 */}
          <svg
            className={`w-4 h-4 transition-all duration-500 ${
              atBottom
                ? "text-cyan-500 -translate-y-[1px]"
                : "text-indigo-500 translate-y-[1px]"
            }`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{
              filter: atBottom
                ? "drop-shadow(0 0 4px rgba(6,182,212,0.5))"
                : "drop-shadow(0 0 4px rgba(99,102,241,0.5))",
            }}
          >
            {atBottom ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            )}
          </svg>
          {/* 百分比 */}
          <span
            className={`text-[9px] font-extrabold transition-colors duration-500 ${
              atBottom ? "text-cyan-500" : "text-indigo-500"
            }`}
          >
            {progress}%
          </span>
        </div>

        {/* 悬浮标签 */}
        <span
          className="
            absolute -top-9 right-1/2 translate-x-1/2 whitespace-nowrap
            px-2.5 py-1 rounded-lg text-[11px] font-bold
            bg-white/80 dark:bg-slate-800/80 backdrop-blur-md
            border border-white/40 dark:border-white/10 shadow-lg
            text-slate-600 dark:text-slate-300
            opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0
            transition-all duration-300 pointer-events-none
          "
        >
          {atBottom ? "↑ 回到顶部" : "↓ 跳到底部"}
        </span>
      </button>

      {/* 脉冲动画圈 */}
      <div
        className="absolute inset-0 rounded-full animate-ping opacity-20 pointer-events-none"
        style={{
          background: "linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)",
          animationDuration: "3s",
        }}
      />
    </div>
  );
}
