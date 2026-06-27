"use client";

import { useState, useEffect, useMemo } from "react";
import { get } from "@/lib/api/about";
import { siteConfig, loadConfig } from "@/lib/config";
import ArticleProse from "@/app/_components/article/ArticleProse";
import CommentSection from "@/app/_components/comment/CommentSection";
import Loading from "@/app/_components/common/Loading";
import { assetUrl } from "@/lib/asset-url";
import { useContentStore } from "@/stores/contentStore";

const linkStyles = "inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors";

export default function AboutPage() {
  const [configReady, setConfigReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get().then(about => { loadConfig(about); setConfigReady(true); }).catch(() => setConfigReady(true)).finally(() => setLoading(false));
  }, []);

  // 分享 about 内容给看板娘
  useEffect(() => {
    if (configReady) {
      useContentStore.getState().setContent({
        type: "about",
        title: siteConfig.authorName,
        summary: siteConfig.bio,
        categoryName: "",
        tags: [],
        content: siteConfig.content,
      });
    }
    return () => { useContentStore.getState().clearContent(); };
  }, [configReady]);

  const coverImage = useMemo(() => assetUrl(siteConfig.bgImages[Math.floor(Math.random() * siteConfig.bgImages.length)]), []);

  if (loading) return <div className="py-24"><Loading /></div>;

  const authorName = siteConfig.authorName;
  const hasContact = siteConfig.email || siteConfig.github || siteConfig.gitee || siteConfig.qq;

  return (
    <div className="min-h-screen relative pb-20">
      <div className="max-w-3xl mx-auto">
        <article className="bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-[40px] shadow-2xl border border-white/40 dark:border-white/10 overflow-hidden">
          <div className="relative h-48 md:h-64 overflow-hidden">
            <img src={coverImage} alt="" className="w-full h-full object-cover transition duration-700 hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          </div>

          <div className="relative px-6 md:px-12 pb-10">
            <div className="flex justify-center -mt-12 md:-mt-16 mb-4">
              <div className="relative w-24 h-24 md:w-28 md:h-28">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 blur-[3px]" />
                <div className="relative w-full h-full rounded-full p-1 bg-white dark:bg-slate-900 shadow-xl">
                  <img src={assetUrl(siteConfig.avatarUrl)} alt={`${authorName} 的头像`} className="w-full h-full rounded-full object-cover" />
                </div>
              </div>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-2">About</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Hello World, I&apos;m {authorName}</p>
            </div>

            {siteConfig.content && (
              <div className="mb-8">
                <ArticleProse content={siteConfig.content} />
              </div>
            )}

            {hasContact && (
              <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">Contact & Links</h3>
                <div className="flex flex-wrap gap-2">
                  {siteConfig.email && (
                    <a href={`mailto:${siteConfig.email}`} className={linkStyles}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      {siteConfig.email}
                    </a>
                  )}
                  {siteConfig.github && (
                    <a href={`https://${siteConfig.github}`} target="_blank" rel="noreferrer" className={linkStyles}>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" /></svg>
                      GitHub
                    </a>
                  )}
                  {siteConfig.gitee && (
                    <a href={`https://${siteConfig.gitee}`} target="_blank" rel="noreferrer" className={linkStyles}>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.984 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 01-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .327.266.592.593.592h5.63c.982 0 1.778-.796 1.778-1.778v-1.482a.593.593 0 011.185 0v1.482c0 1.636-1.326 2.963-2.963 2.963H8.593A2.964 2.964 0 015.63 14.222V8.593a2.964 2.964 0 012.963-2.963h3.334l-.592-.593a.592.592 0 010-.838l.74-.74a.592.592 0 01.838 0l2.222 2.222a.592.592 0 010 .838l-2.222 2.222a.592.592 0 01-.838 0l-.74-.74a.592.592 0 010-.838l.593-.593H10.37a1.63 1.63 0 00-1.63 1.63v4.444c0 .9.73 1.63 1.63 1.63h4.444c.9 0 1.63-.73 1.63-1.63V9.777c0-.9-.73-1.63-1.63-1.63h-2.518l-.593-.593v-.74a.593.593 0 01.593-.593h4.444z" /></svg>
                      Gitee
                    </a>
                  )}
                  {siteConfig.qq && (
                    <span className={linkStyles + " cursor-default"}>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.003 2c-2.265 0-6.29 1.364-6.29 7.325v1.195S3.55 14.96 3.55 17.474v3.388c0 .548.444.992.993.992.549 0 .993-.444.993-.992v-1.368l1.092.778c.238.17.52.254.8.254.388 0 .773-.148 1.039-.44l.802-.875a2.38 2.38 0 003.418 0l.803.876c.504.553 1.522.561 2.042.017a1.44 1.44 0 00.114-.163l.854.793c.266.246.602.37.94.37.382 0 .764-.165 1.03-.46.268-.298.38-.7.298-1.087l-.696-3.234c.895-1.592 1.595-3.65 1.595-5.65 0-6.956-3.164-8.207-6.268-8.207z" /></svg>
                      QQ: {siteConfig.qq}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
              <CommentSection path="/about" />
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
