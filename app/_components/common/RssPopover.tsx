"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { siteConfig } from "@/lib/siteConfig";
import Tooltip from "@/app/_components/common/Tooltip";

interface RssArticle {
  title: string;
  link: string;
  date: string | null;
  summary?: string | null;
}

interface RssResult {
  title: string;
  articles: RssArticle[];
}

const WORKER_URL = `https://${siteConfig.analytics}`;

export default function RssPopover({
  rssUrl,
  children,
}: {
  rssUrl: string;
  children: React.ReactNode;
}) {
  // 功能降级：未启用时直接透传 children，不加载 Worker 请求
  if (!siteConfig.featureFriendsRss) {
    return <>{children}</>;
  }

  const [open, setOpen] = useState(false);
  const [data, setData] = useState<RssResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0, dir: "above" as "above" | "below" });
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const fetchRss = useCallback(async () => {
    if (data) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${WORKER_URL}/rss?url=${encodeURIComponent(rssUrl)}`
      );
      const json = await res.json();
      if (json.code === 1 && json.data) {
        setData(json.data);
      } else {
        setError(json.msg || "获取失败");
      }
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }, [rssUrl, data]);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const dir = rect.top < 280 ? "below" : "above";
      setPos({
        top: dir === "above" ? rect.top - 8 : rect.bottom + 8,
        left: rect.left + rect.width / 2,
        dir,
      });
    }
  }, []);

  const handleMouseEnter = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      updatePosition();
      setOpen(true);
      fetchRss();
    }, 300);
  };

  const handleMouseLeave = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setOpen(false);
    }, 200);
  };

  useEffect(() => {
    return () => clearTimeout(hoverTimer.current);
  }, []);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {/* Popover via Portal — 渲染到 body，避免 overflow 裁剪 */}
      {open && typeof document === "object" && createPortal(
        <div
          onMouseEnter={() => clearTimeout(hoverTimer.current)}
          onMouseLeave={handleMouseLeave}
          className="fixed z-[9999]"
          style={{
            top: pos.top,
            left: pos.left,
            transform: pos.dir === "above" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
          }}
        >
          {pos.dir === "below" && (
            <div className="flex justify-center mb-[2px]">
              <div className="w-2.5 h-2.5 rotate-45 bg-white/90 dark:bg-slate-800/90 border-t border-l border-white/40 dark:border-white/10" />
            </div>
          )}
          <div className="glass-card !rounded-xl p-3 min-w-[220px] max-w-[280px] bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
              <svg className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.18 15.64a2.18 2.18 0 010 4.36 2.18 2.18 0 010-4.36M4 4.44A15.56 15.56 0 0119.56 20h-2.83A12.73 12.73 0 004 7.27V4.44m0 5.66a9.9 9.9 0 019.9 9.9h-2.83A7.07 7.07 0 004 12.93v-2.83z" />
              </svg>
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
                {data ? data.title : "RSS 订阅"}
              </span>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex items-center justify-center py-4 gap-2">
                <div className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[11px] text-slate-400">加载中…</span>
              </div>
            ) : error ? (
              <p className="text-[11px] text-slate-400 text-center py-3">{error}</p>
            ) : data && data.articles.length > 0 ? (
              <ul className="space-y-1.5">
                {data.articles.map((article, i) => (
                  <li key={i}>
                    <Tooltip text={article.summary || article.title} position="bottom">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(article.link, "_blank", "noopener");
                        }}
                        className="block text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-2 rounded px-1 -mx-1 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer"
                      >
                        {article.title}
                      </span>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-400 text-center py-3">暂无文章</p>
            )}

            {/* Footer */}
            {data && data.articles.length > 0 && (
              <p className="text-[9px] text-slate-400/60 dark:text-slate-500/60 text-right mt-2 pt-1.5 border-t border-slate-200/40 dark:border-slate-700/40">
                via RSS 订阅
              </p>
            )}
          </div>

          {/* Arrow (above only — below arrow rendered before card) */}
          {pos.dir === "above" && (
            <div className="flex justify-center -mt-[2px]">
              <div className="w-2.5 h-2.5 rotate-45 bg-white/90 dark:bg-slate-800/90 border-r border-b border-white/40 dark:border-white/10" />
            </div>
          )}
        </div>,
        document.body
      )}
    </span>
  );
}
