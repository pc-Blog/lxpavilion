"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import type { Literature, LiteratureCategory } from "@/lib/types";
import { getCategories, getList } from "@/lib/api/literature";
import { tagIconMap } from "./tag-icons";
import LiteratureCard from "./LiteratureCard";
import Loading from "../common/Loading";

type ViewMode = "category" | "timeline";

const staggerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

/** 分类图标（未登记的分类用默认菱形） */
function CategoryIcon({ name }: { name: string }) {
  const info = tagIconMap[name];
  if (info) {
    const { Icon, color } = info;
    return <Icon className={`w-6 h-6 ${color}`} strokeWidth={1.5} />;
  }
  return <span className="text-indigo-400">◇</span>;
}

export default function LiteratureList() {
  const [items, setItems] = useState<Literature[]>([]);
  const [categories, setCategories] = useState<LiteratureCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("category");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [list, cats] = await Promise.all([getList(), getCategories()]);
        setItems(list.rows);
        setCategories(cats);
      } catch {
        setItems([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const nameOf = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  /**
   * 分类视图：后端已按 sort_order 预排，此处用 Map 保持首次出现顺序即可，
   * 不需要额外排序。
   */
  const groupedByCategory = useMemo(() => {
    const groups = new Map<number | null, Literature[]>();
    for (const item of items) {
      const key = item.categoryId ?? null;
      const arr = groups.get(key);
      if (arr) arr.push(item);
      else groups.set(key, [item]);
    }
    return [...groups.entries()].map(([key, articles]) => ({
      key: key ?? 0,
      name: key != null ? nameOf.get(key) ?? "未分类" : "未分类",
      articles,
    }));
  }, [items, nameOf]);

  /** 时间视图：按年月降序分组，月内按日期降序、同日按 id 降序 */
  const groupedByTime = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const da = a.writtenAt ?? "";
      const db = b.writtenAt ?? "";
      if (da !== db) return db.localeCompare(da);
      return b.id - a.id;
    });
    const years = new Map<number, Map<number, Literature[]>>();
    for (const item of sorted) {
      if (!item.writtenAt) continue;
      const [y, m] = item.writtenAt.split("-").map(Number);
      if (!years.has(y)) years.set(y, new Map());
      const months = years.get(y)!;
      const arr = months.get(m);
      if (arr) arr.push(item);
      else months.set(m, [item]);
    }
    return [...years.entries()].map(([year, months]) => ({
      year,
      total: [...months.values()].reduce((sum, arr) => sum + arr.length, 0),
      months: [...months.entries()].map(([month, articles]) => ({
        month,
        articles,
      })),
    }));
  }, [items]);

  const total = items.length;

  return (
    <div>
      <div className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">Literature</div>
      <p className="text-slate-500 dark:text-slate-400 mb-6">Poetry, prose, and creative writing.</p>

      {/* 视图切换 */}
      <div className="flex items-center gap-2 mb-8">
        {([
          { value: "category", label: "按分类" },
          { value: "timeline", label: "按时间" },
        ] as const).map((o) => (
          <button
            key={o.value}
            onClick={() => setView(o.value)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              view === o.value
                ? "bg-indigo-500 text-white"
                : "bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60"
            }`}
          >
            {o.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">{total} 篇</span>
      </div>

      {loading ? (
        <Loading />
      ) : total === 0 ? (
        <p className="text-center py-10 text-slate-400">尚无作品。</p>
      ) : view === "category" ? (
        /* ============ 按分类 ============ */
        groupedByCategory.map((group, idx) => (
          <section key={group.key} className={idx < groupedByCategory.length - 1 ? "mb-12" : ""}>
            <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <CategoryIcon name={group.name} /> {group.name}
              <span className="text-xs font-normal text-slate-400 dark:text-slate-500">{group.articles.length}</span>
            </h2>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={staggerVariants}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {group.articles.map((article) => (
                <motion.div key={article.id} variants={cardVariants}>
                  <LiteratureCard item={article} categoryName={group.name} />
                </motion.div>
              ))}
            </motion.div>
            {idx < groupedByCategory.length - 1 && (
              <div className="mt-8 h-px bg-gradient-to-r from-transparent via-indigo-300/50 dark:via-indigo-500/30 to-transparent" />
            )}
          </section>
        ))
      ) : (
        /* ============ 按时间 ============ */
        groupedByTime.map((year, yIdx) => (
          <section key={year.year} className={yIdx < groupedByTime.length - 1 ? "mb-10" : ""}>
            <h2 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white mb-4">
              {year.year}
              <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">{year.total} 篇</span>
            </h2>
            {year.months.map((m) => (
              <div key={m.month} className="mb-8">
                <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-3 border-l-[3px] border-indigo-300/50 dark:border-indigo-600/40 pl-3">
                  {m.month} 月
                  <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">{m.articles.length}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {m.articles.map((article) => (
                    <LiteratureCard
                      key={article.id}
                      item={article}
                      categoryName={article.categoryId != null ? nameOf.get(article.categoryId) : undefined}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
