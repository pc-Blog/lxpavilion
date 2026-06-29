"use client";

import { useState, useEffect } from "react";
import { siteConfig, loadConfig } from "@/lib/config";
import { assetUrl } from "@/lib/asset-url";
import { getPublicList } from "@/lib/api/article";
import { get as getAbout } from "@/lib/api/about";
import type { ArticleVO } from "@/lib/types";
import Link from "next/link";
import ArticleTOC from "./ArticleTOC";
import SubscribeForm from "@/app/_components/subscribe/SubscribeForm";

export default function ArticleSidebar({ content }: { content: string }) {
  const [recentPosts, setRecentPosts] = useState<ArticleVO[]>([]);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    getPublicList({ pageNum: 1, pageSize: 3, query: { keyword: "" } })
      .then((d) => setRecentPosts(d.rows))
      .catch(() => { });
    getAbout().then(about => { loadConfig(about); forceUpdate(n => n + 1); }).catch(() => { });
  }, []);

  const authorName = siteConfig.authorName;
  const bio = siteConfig.bio;

  return (
    <aside className="w-full lg:w-[320px] flex flex-col gap-6 flex-shrink-0">
      {/* Profile card */}
      <div className="glass-card p-6 text-center">
        <div className="relative w-20 h-20 mx-auto mb-4">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 opacity-40 blur-[2px]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assetUrl(siteConfig.avatarUrl)} alt={`${authorName} 的头像`} className="relative w-full h-full rounded-full object-cover shadow-lg" />
        </div>
        <h3 className="text-base font-black text-slate-800 dark:text-white">{authorName}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{bio}</p>
        {(siteConfig.github || siteConfig.email) && (
          <div className="flex justify-center gap-3 mt-4">
            {siteConfig.github && (
              <a href={`https://${siteConfig.github}`} target="_blank" rel="noopener" className="text-slate-400 hover:text-indigo-500 transition-colors text-lg font-mono">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
              </a>
            )}
            {siteConfig.email && (
              <a href={`mailto:${siteConfig.email}`} className="text-slate-400 hover:text-indigo-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Subscribe */}
      <SubscribeForm />

      {/* Recent posts */}
      {recentPosts.length > 0 && (
        <div className="glass-card p-5">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 pl-4 border-l-4 border-indigo-500">
            RECENT
          </h4>
          <div className="flex flex-col gap-3">
            {recentPosts.map((p) => (
              <Link key={p.id} href={`/article/${p.id}`} className="group">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug">
                  {p.title}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {p.createdAt ? new Date(p.createdAt).toLocaleDateString("zh-CN") : ""}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* TOC */}
      <ArticleTOC content={content} />
    </aside>
  );
}
