"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { siteConfig, loadConfig } from "@/lib/config";
import { assetUrl } from "@/lib/asset-url";
import type { DashboardVO } from "@/lib/types";
import { get } from "@/lib/api/dashboard";
import { get as getAbout } from "@/lib/api/about";
import { getArticleList } from "@/lib/api/op";
import { getPublishedList as getFriendLinks } from "@/lib/api/friend-link";
import { getPublishedList as getChatters } from "@/lib/api/chatter";
import ThemeToggleBlock from "@/app/_components/common/ThemeToggle";
import Tooltip from "@/app/_components/common/Tooltip";
import SiteDashboard from "@/app/_components/layout/SiteDashboard";
import MusicPlayer from "@/app/_components/layout/MusicPlayer";
import FloatingNav from "@/app/_components/layout/FloatingNav";
import { websiteSchema } from "@/lib/seo";

const [GH_OWNER, GH_REPO] = siteConfig.repo.split("/");

export default function Home() {
  const [dash, setDash] = useState<DashboardVO | null>(null);
  const [configReady, setConfigReady] = useState(false);
  const [literatureCount, setLiteratureCount] = useState<number | null>(null);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [chatterCount, setChatterCount] = useState<number | null>(null);
  const [repoStats, setRepoStats] = useState<{ stars: number; forks: number; watchers: number } | null>(null);

  useEffect(() => {
    get().then(dashData => {
      setDash(dashData);
      fetch(`https://${siteConfig.analytics}/api/comment/stats`)
        .then(r => r.json())
        .then(json => {
          if (json.code === 1) setDash(prev => prev ? { ...prev, commentCount: json.data.totalComments } : prev);
        }).catch(() => {});
      fetch(`https://${siteConfig.analytics}/api/view/total`)
        .then(r => r.json())
        .then(json => {
          if (json.code === 1) setDash(prev => prev ? { ...prev, totalViews: json.data.total } : prev);
        }).catch(() => {});
    }).catch(() => { });
    getAbout().then(about => { loadConfig(about); setConfigReady(true); }).catch(() => { });
    getArticleList().then(d => {
      const total = d.rows.reduce((sum, t) => sum + t.articles.length, 0);
      setLiteratureCount(total);
    }).catch(() => { });
    getFriendLinks().then(list => {
      setFriendCount(Array.isArray(list) ? list.length : (list as { rows?: unknown[] })?.rows?.length ?? null);
    }).catch(() => { });
    getChatters().then(list => {
      setChatterCount(Array.isArray(list) ? list.length : (list as { rows?: unknown[] })?.rows?.length ?? null);
    }).catch(() => { });
    fetch(`https://api.github.com/repos/${siteConfig.repo}`)
      .then(r => r.json())
      .then(d => {
        if (d.stargazers_count != null) {
          setRepoStats({ stars: d.stargazers_count, forks: d.forks_count, watchers: d.watchers_count });
        }
      }).catch(() => { });
  }, []);

  const authorName = siteConfig.authorName;
  const bio = siteConfig.bio;
  const hasContact = !!(siteConfig.email || siteConfig.github || siteConfig.gitee || siteConfig.juejin || siteConfig.csdn || siteConfig.cnblogs);

  return (
    <>
      <FloatingNav />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteSchema()),
        }}
      />
      <div className="flex flex-col gap-6 w-full mt-6">
        {/* Row 1: Profile Card + Player */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          {/* ProfileCard — 7 cols */}
          <div className="col-span-1 lg:col-span-7 rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5 sm:p-6 md:p-8 flex flex-col justify-between transition-all duration-700 hover:scale-[1.01] group relative overflow-hidden min-h-[220px]">
            <Link href="/about">
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-4 md:gap-6 w-full">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl md:rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-1 shadow-lg flex-shrink-0 transition-transform duration-500 group-hover:rotate-3">
                    <img src={assetUrl(siteConfig.avatarUrl)} alt={`${authorName} 的头像`} className="w-full h-full rounded-lg md:rounded-xl object-cover bg-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-1 tracking-tighter">{authorName}</h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{bio}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-6 md:mt-8 relative z-10">
                <div className="flex gap-2 sm:gap-6">
                  {[
                    { count: dash?.articleCount ?? "—", label: "Articles", color: "text-indigo-600 dark:text-indigo-400" },
                    { count: dash?.projectCount ?? "—", label: "Projects", color: "text-purple-600 dark:text-purple-400" },
                    { count: dash?.skillCount ?? "—", label: "Skills", color: "text-pink-600 dark:text-pink-400" },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center group/stat px-2">
                      <div className={`text-xl md:text-2xl font-black ${stat.color} transition-transform group-hover/stat:scale-110`}>{stat.count}</div>
                      <div className="text-[9px] md:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>

            </Link>

            {/* Star 引导 + GitHub Repo Stats — outside Link to prevent navigation */}
            <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-white/5 relative z-10">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  ⭐ 如果这个项目对你有帮助，欢迎去 GitHub 点个{" "}
                  <a
                    href={`https://github.com/${siteConfig.repo}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-indigo-500 hover:text-indigo-400 transition-colors"
                  >
                    Star
                  </a>{" "}
                  ❤️
                </p>
                <span className="text-slate-300 dark:text-slate-600 text-xs">|</span>
                <div className="flex items-center gap-3">
                  <Tooltip text="Stars">
                    <a
                      href={`https://github.com/${siteConfig.repo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-500 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      <span>{repoStats ? repoStats.stars.toLocaleString() : "—"}</span>
                    </a>
                  </Tooltip>
                  <Tooltip text="Watch">
                    <a
                      href={`https://github.com/${siteConfig.repo}/watchers`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-500 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      <span>{repoStats ? repoStats.watchers.toLocaleString() : "—"}</span>
                    </a>
                  </Tooltip>
                  <Tooltip text="Forks">
                    <a
                      href={`https://github.com/${siteConfig.repo}/forks`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-500 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 3a3 3 0 00-3 3v2.25a3 3 0 003 3h2.25a3 3 0 003-3V6a3 3 0 00-3-3H6zm9.75 0a3 3 0 00-3 3v2.25a3 3 0 003 3H21a3 3 0 003-3V6a3 3 0 00-3-3h-5.25zM6 12.75a3 3 0 00-3 3V18a3 3 0 003 3h2.25a3 3 0 003-3v-2.25a3 3 0 00-3-3H6zm9.75 0a3 3 0 00-3 3V18a3 3 0 003 3H21a3 3 0 003-3v-2.25a3 3 0 00-3-3h-5.25z"/></svg>
                      <span>{repoStats ? repoStats.forks.toLocaleString() : "—"}</span>
                    </a>
                  </Tooltip>
                </div>
              </div>
            </div>

            {/* Contact links — outside Link to prevent navigation */}
            {hasContact && (
              <div className="flex items-center gap-1 mt-4 relative z-10">
                {siteConfig.email && (
                  <Tooltip text="Email">
                    <button onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${siteConfig.email}`; }} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </button>
                  </Tooltip>
                )}
                {siteConfig.github && (
                  <Tooltip text="GitHub">
                    <button onClick={(e) => { e.stopPropagation(); window.open(`https://${siteConfig.github}`, "_blank", "noreferrer"); }} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" /></svg>
                    </button>
                  </Tooltip>
                )}
                {siteConfig.gitee && (
                  <Tooltip text="Gitee">
                    <button onClick={(e) => { e.stopPropagation(); window.open(`https://${siteConfig.gitee}`, "_blank", "noreferrer"); }} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.984 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 01-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .327.266.592.593.592h5.63c.982 0 1.778-.796 1.778-1.778v-1.482a.593.593 0 011.185 0v1.482c0 1.636-1.326 2.963-2.963 2.963H8.593A2.964 2.964 0 015.63 14.222V8.593a2.964 2.964 0 012.963-2.963h3.334l-.592-.593a.592.592 0 010-.838l.74-.74a.592.592 0 01.838 0l2.222 2.222a.592.592 0 010 .838l-2.222 2.222a.592.592 0 01-.838 0l-.74-.74a.592.592 0 010-.838l.593-.593H10.37a1.63 1.63 0 00-1.63 1.63v4.444c0 .9.73 1.63 1.63 1.63h4.444c.9 0 1.63-.73 1.63-1.63V9.777c0-.9-.73-1.63-1.63-1.63h-2.518l-.593-.593v-.74a.593.593 0 01.593-.593h4.444z" /></svg>
                    </button>
                  </Tooltip>
                )}
                {siteConfig.juejin && (
                  <Tooltip text="掘金">
                    <button onClick={(e) => { e.stopPropagation(); window.open(`https://${siteConfig.juejin}`, "_blank", "noreferrer"); }} className="p-1.5 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3l7 9-7 9-7-9 7-9z" stroke="currentColor" strokeWidth="1" fill="none" /><path d="M12 6l5 6-5 6-5-6 5-6z" fill="currentColor" opacity="0.7" /></svg>
                    </button>
                  </Tooltip>
                )}
                {siteConfig.csdn && (
                  <Tooltip text="CSDN">
                    <button onClick={(e) => { e.stopPropagation(); window.open(`https://${siteConfig.csdn}`, "_blank", "noreferrer"); }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3" strokeWidth="2" /><text x="12" y="16" textAnchor="middle" fill="currentColor" stroke="none" fontSize="13" fontWeight="bold">C</text></svg>
                    </button>
                  </Tooltip>
                )}
                {siteConfig.cnblogs && (
                  <Tooltip text="博客园">
                    <button onClick={(e) => { e.stopPropagation(); window.open(`https://${siteConfig.cnblogs}`, "_blank", "noreferrer"); }} className="p-1.5 rounded-lg text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C7 2 3 6 3 10c0 3 2 6 5 7l-1 3h10l-1-3c3-1 5-4 5-7 0-4-4-8-8-8z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v6" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6" /></svg>
                    </button>
                  </Tooltip>
                )}
              </div>
            )}
          </div>

          {/* Player — 5 cols */}
          <div className="col-span-1 lg:col-span-5">
            <MusicPlayer />
          </div>
        </div>

        {/* Row 2: Article Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full">
          <Link href="/article" className="rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-6 transition-all duration-700 hover:scale-[1.02] group">
            <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-500/80 text-white backdrop-blur-lg mb-3">Read</span>
            <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:-translate-y-0.5 transition-transform">Articles</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tech &amp; Research</p>
          </Link>
          <Link href="/project" className="rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-6 transition-all duration-700 hover:scale-[1.02] group">
            <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-500/80 text-white backdrop-blur-lg mb-3">Build</span>
            <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:-translate-y-0.5 transition-transform">Projects</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Code &amp; Portfolio</p>
          </Link>
          <Link href="/timeline" className="rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-6 transition-all duration-700 hover:scale-[1.02] group">
            <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-pink-500/80 text-white backdrop-blur-lg mb-3">Learn</span>
            <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:-translate-y-0.5 transition-transform">Timeline</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Learning Path</p>
          </Link>
        </div>

        {/* Row 3: Dashboard stats + Theme toggle */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          {/* Stats — 8 cols */}
          <div className="col-span-1 lg:col-span-8">
            {dash && (
              <div className="rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-6 flex items-center gap-8 flex-wrap">
                {[
                  { v: dash.commentCount, l: "Comments" },
                  { v: dash.totalViews ?? "—", l: "Views" },
                  { v: literatureCount ?? "—", l: "Literature" },
                  { v: dash.timelineCount, l: "Milestones" },
                  { v: friendCount ?? "—", l: "Friends" },
                  { v: chatterCount ?? "—", l: "Chatter" },
                ].map((s) => (
                  <div key={s.l}>
                    <span className="font-mono text-2xl font-black text-indigo-500">{s.v}</span>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{s.l}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Theme toggle — 4 cols */}
          <div className="col-span-1 lg:col-span-4 min-h-[80px]">
            <ThemeToggleBlock />
          </div>
        </div>

        {/* Row 4: Site Dashboard */}
        <SiteDashboard />
      </div>
    </>
  );
}
