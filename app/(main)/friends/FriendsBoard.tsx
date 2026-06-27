"use client";

import { useState, useEffect, useRef } from "react";
import type { FriendLink } from "@/lib/types";
import { getPublishedList } from "@/lib/api/friend-link";
import { siteConfig } from "@/lib/siteConfig";
import CommentSection from "@/app/_components/comment/CommentSection";
import RssPopover from "@/app/_components/common/RssPopover";
import Link from "next/link";

export default function FriendsBoard() {
  const [friends, setFriends] = useState<FriendLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const commentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getPublishedList()
      .then(setFriends)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const friendLinkFormat = `名称：${siteConfig.title}\n简介：${siteConfig.bio}\n链接：https://${siteConfig.blog}\n头像：https://${siteConfig.blog}${siteConfig.avatarUrl}\nRSS：https://${siteConfig.blog}/feed.xml\n邮箱：${siteConfig.email}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(friendLinkFormat);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS or older browsers
      try {
        const textarea = document.createElement("textarea");
        textarea.value = friendLinkFormat;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Both methods failed
      }
    }
  };

  const scrollToComment = () => {
    commentRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen relative pb-20">
      <div className="max-w-5xl mx-auto">
        <div className="text-3xl md:text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">
          Friends
        </div>
        <p className="text-slate-500 dark:text-slate-400 mb-10">Interesting souls in the digital space.</p>

        {/* Friend Cards Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : friends.length === 0 ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500">
            <p className="text-lg font-bold mb-1">暂无友链</p>
            <p className="text-sm">在下方评论区申请友链吧~</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {friends.map((friend, i) => (
              <a
                key={friend.id ?? i}
                href={friend.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative rounded-2xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5 transition-all duration-500 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-2xl overflow-hidden"
              >
                {/* Theme color glow */}
                {friend.themeColor && (
                  <div
                    className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-0 group-hover:opacity-60 transition-opacity duration-500 blur-2xl pointer-events-none"
                    style={{ backgroundColor: friend.themeColor }}
                  />
                )}

                {/* Avatar */}
                <div className="relative mb-4 w-14 h-14 md:w-16 md:h-16">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 p-[2px] transition-transform duration-500 group-hover:rotate-45">
                    <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 overflow-hidden">
                      <img
                        src={friend.avatar || "/bg/1.jpg"}
                        alt={friend.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = "/bg/1.jpg"; }}
                      />
                    </div>
                  </div>
                </div>

                {/* Name */}
                <h3 className="font-black text-sm md:text-base text-slate-900 dark:text-white mb-1 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {friend.name}
                </h3>

                {/* Description */}
                {friend.description && (
                  <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {friend.description}
                  </p>
                )}

                {/* Top-right: Online indicator + RSS & Email (hover) */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  {/* RSS & Email — show on hover */}
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {friend.rss && (
                      <RssPopover rssUrl={friend.rss}>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(friend.rss, "_blank", "noopener");
                          }}
                          className="inline-flex items-center gap-1 text-orange-500/60 hover:text-orange-500 transition-colors cursor-pointer"
                        >
                          <span className="text-[9px] font-medium">查看订阅 →</span>
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6.18 15.64a2.18 2.18 0 010 4.36 2.18 2.18 0 010-4.36M4 4.44A15.56 15.56 0 0119.56 20h-2.83A12.73 12.73 0 004 7.27V4.44m0 5.66a9.9 9.9 0 019.9 9.9h-2.83A7.07 7.07 0 004 12.93v-2.83z" />
                          </svg>
                        </span>
                      </RssPopover>
                    )}
                    {friend.email && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`mailto:${friend.email}`);
                        }}
                        className="inline-flex items-center gap-1 text-blue-500/60 hover:text-blue-500 transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </span>
                    )}
                  </div>
                  {/* Online dot */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-green-500 uppercase tracking-wider hidden md:inline">Online</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Apply Section */}
        <div className="mt-16 rounded-3xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-6 md:p-10">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-2">
            🌐 友链申请
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            想要交换友链？请复制下方的申请格式，填写你的站点信息后在评论区发布即可~我会尽快处理。
          </p>

          {/* Apply format */}
          <div className="relative mb-6">
            <pre className="text-xs md:text-sm font-mono bg-slate-900/80 dark:bg-black/60 text-slate-200 rounded-xl p-4 md:p-6 overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {friendLinkFormat}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 px-3 py-1.5 text-[10px] font-bold rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors backdrop-blur"
            >
              {copied ? "已复制 ✓" : "复制"}
            </button>
          </div>

          {/* Scroll to comment button */}
          <button
            onClick={scrollToComment}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-bold hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg hover:shadow-xl"
          >
            前往评论区发布申请 ↓
          </button>
        </div>

        {/* Comment section */}
        <div ref={commentRef} className="mt-10">
          <div className="rounded-3xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5 md:p-8">
            <CommentSection path="/friends" />
          </div>
        </div>
      </div>
    </div>
  );
}
