"use client";

import { useState, useEffect, useRef } from "react";
import { getFullList, getCategoryTree } from "@/lib/api/bookmark";
import type { Bookmark, BookmarkCategory } from "@/lib/types";
import { useTheme } from "@/app/_components/layout/ThemeProvider";
import Tooltip from "@/app/_components/common/Tooltip";

export default function BookmarksClient() {
  const [categories, setCategories] = useState<BookmarkCategory[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const { toggleTheme } = useTheme();

  useEffect(() => {
    document.documentElement.dataset.pioAlign = "right";
  }, []);

  useEffect(() => {
    Promise.all([getFullList(), getCategoryTree()]).then(([bms, cats]) => {
      setBookmarks(bms);
      setCategories(cats);
      const root = cats.find((c) => !c.parentId);
      if (root) setActiveId(root.id!);
    }).finally(() => setLoading(false));
  }, []);

  const ALL = -1;
  const roots = categories.filter((c) => !c.parentId);
  const subCats = categories.filter((c) => c.parentId === activeId);
  const activeRoot = roots.find((r) => r.id === activeId);

  function scrollToSection(id: number) {
    setActiveId(id);
    setTimeout(() => {
      const el = document.getElementById(`cat-section-${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function bmByCat(catId: number) {
    return bookmarks.filter(
      (b) => b.categoryId === catId && (!search || b.name.toLowerCase().includes(search.toLowerCase()))
    );
  }

  if (loading) return (
    <div className="w-full min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* 侧边栏 */}
      <nav className="fixed top-5 left-5 w-[260px] h-[calc(100vh-40px)] z-50 flex flex-col
        rounded-2xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-2xl
        border border-white/40 dark:border-white/10 shadow-xl">
        <div className="px-6 pt-6 pb-3 flex-shrink-0">
          <div className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            🧭 网站导航
          </div>
        </div>

        {/* 分类列表 */}
        <div className="flex-1 overflow-y-auto px-4 scrollbar-none">
          <ul className="list-none p-0 m-0">
            <li>
              <button
                onClick={() => { setActiveId(ALL); setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100); }}
                className={`w-full text-left px-4 py-3 rounded-2xl mb-1 text-sm font-medium transition-all duration-200 ${
                  activeId === ALL
                    ? "bg-indigo-100/60 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm"
                    : "bg-transparent text-slate-400 dark:text-slate-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                全部
              </button>
            </li>
            {roots.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => scrollToSection(r.id!)}
                  className={`w-full text-left px-4 py-3 rounded-2xl mb-1 text-sm font-medium transition-all duration-200 ${
                    activeId === r.id
                      ? "bg-indigo-100/60 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm"
                      : "bg-transparent text-slate-400 dark:text-slate-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 border-t border-white/30 dark:border-white/5 rounded-b-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 dark:text-slate-500">共 {bookmarks.length} 个网站</span>
            <div className="flex items-center gap-1">
              <Tooltip text="导出 JSON">
              <button
                onClick={() => {
                  const data = JSON.stringify({ categories, bookmarks }, null, 2);
                  const blob = new Blob([data], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = "bookmarks.json"; a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-indigo-100/50 dark:hover:bg-indigo-500/20 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all"
              >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M4 19H20V12H22V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V12H4V19ZM13 9H18L12 15L6 9H11V2H13V9Z" />
              </svg>
              </button>
              </Tooltip>
            <Tooltip text="切换深色/浅色主题">
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-indigo-100/50 dark:hover:bg-indigo-500/20 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all"
            >
              <svg className="w-5 h-5 hidden dark:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <svg className="w-5 h-5 block dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </button>
            </Tooltip>
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="flex-1 ml-[300px] pt-5 pb-10 pr-5">
        <div className="max-w-[1200px] mx-auto">
          {/* Hero 搜索 */}
          <header className="flex justify-center items-center flex-col py-16 px-5">
            <div className="w-full max-w-[680px] relative z-10">
              <form onSubmit={(e) => e.preventDefault()}>
                <div className="flex items-center bg-white/50 dark:bg-slate-800/40 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-full px-5 py-1.5 shadow-lg transition-all duration-300
                  focus-within:shadow-[0_0_20px_rgba(99,102,241,0.2)] focus-within:border-indigo-300/50 focus-within:-translate-y-0.5">
                  <svg className="w-5 h-5 text-slate-400 mr-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18.031 16.6168L22.3137 20.8995L20.8995 22.3137L16.6168 18.031C15.0769 19.263 13.124 20 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2C15.968 2 20 6.032 20 11C20 13.124 19.263 15.0769 18.031 16.6168Z" />
                  </svg>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="探索网络世界..."
                    className="flex-1 border-none bg-transparent text-lg text-slate-800 dark:text-slate-200 outline-none h-12 placeholder:text-slate-400"
                  />
                  <button type="submit" className="w-12 h-12 rounded-full border-none bg-gradient-to-r from-indigo-500 to-purple-500 text-white cursor-pointer flex items-center justify-center flex-shrink-0 transition-transform duration-200 hover:scale-105">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </header>

          {/* 卡片区 */}
          <div ref={contentRef}>
            {(() => {
              function renderCat(cat: BookmarkCategory): React.ReactNode {
                const items = bmByCat(cat.id!);
                const subs = categories.filter((c) => c.parentId === cat.id);
                if (subs.length > 0) {
                  const rendered = subs.map((s) => {
                    const si = bmByCat(s.id!);
                    if (si.length === 0) return null;
                    return (
                      <div key={s.id} className="mb-6 last:mb-0">
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 px-1">{s.name}</h3>
                        <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                          {si.map((b) => <Card key={b.id} bookmark={b} />)}
                        </div>
                      </div>
                    );
                  }).filter(Boolean);
                  if (rendered.length === 0) return null;
                  return (
                    <section key={cat.id} id={`cat-section-${cat.id}`} className="mb-12 scroll-mt-5">
                      <div className="flex items-center justify-between mb-6 py-2 px-4 border-l-4 border-indigo-500 bg-gradient-to-r from-indigo-500/5 to-transparent rounded-r-2xl">
                        <h2 className="text-xl font-bold m-0 pl-2.5 tracking-tight text-slate-800 dark:text-slate-100">{cat.name}</h2>
                      </div>
                      {rendered}
                    </section>
                  );
                }
                if (items.length === 0) return null;
                return (
                  <section key={cat.id} id={`cat-section-${cat.id}`} className="mb-12 scroll-mt-5">
                    <div className="flex items-center justify-between mb-6 py-2 px-4 border-l-4 border-indigo-500 bg-gradient-to-r from-indigo-500/5 to-transparent rounded-r-2xl">
                      <h2 className="text-xl font-bold m-0 pl-2.5 tracking-tight text-slate-800 dark:text-slate-100">{cat.name}</h2>
                    </div>
                    <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                      {items.map((b) => <Card key={b.id} bookmark={b} />)}
                    </div>
                  </section>
                );
              }

              if (activeId === ALL) {
                const rendered = roots.map(renderCat).filter(Boolean);
                return rendered.length > 0 ? rendered : <p className="text-center mt-20 text-slate-400">{search ? "无匹配结果" : "暂无收藏"}</p>;
              }
              if (activeRoot) {
                if (subCats.length > 0) {
                  const rendered = subCats.map(renderCat).filter(Boolean);
                  return rendered.length > 0 ? rendered : <p className="text-center mt-20 text-slate-400">{search ? "无匹配结果" : "暂无收藏"}</p>;
                }
                return renderCat(activeRoot) || <p className="text-center mt-20 text-slate-400">{search ? "无匹配结果" : "暂无收藏"}</p>;
              }
              return null;
            })()}
          </div>
        </div>
      </main>
    </div>
  );
}

function Card({ bookmark: b }: { bookmark: Bookmark }) {
  return (
    <a
      href={b.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl p-[18px] transition-all duration-300 hover:-translate-y-1 group
        bg-white/50 dark:bg-slate-800/40 backdrop-blur-md
        border border-white/40 dark:border-white/10
        hover:bg-white/70 dark:hover:bg-slate-700/50
        hover:shadow-lg hover:border-indigo-300/50 dark:hover:border-indigo-500/30"
    >
      <div className="flex items-center gap-3.5 mb-3">
        <span className="w-[42px] h-[42px] rounded-xl flex items-center justify-center flex-shrink-0 bg-white/70 dark:bg-slate-700/50">
          {b.icon?.startsWith("http") ? (
            <img src={b.icon} alt="" className="w-6 h-6 object-contain" />
          ) : (
            <span className="text-xl">{b.icon || "🔗"}</span>
          )}
        </span>
        <span className="text-sm font-semibold truncate text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {b.name}
        </span>
      </div>
      {b.description && (
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[38px]">
          {b.description}
        </p>
      )}
    </a>
  );
}
