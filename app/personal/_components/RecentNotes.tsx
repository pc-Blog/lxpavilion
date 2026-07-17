"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getPublicList } from "@/lib/api/article";
import type { ArticleVO } from "@/lib/types";

export default function RecentNotes() {
  const [articles, setArticles] = useState<ArticleVO[]>([]);

  useEffect(() => {
    getPublicList({ pageNum: 1, pageSize: 5, query: { isPublished: true } })
      .then((data) => {
        setArticles(data.rows);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {articles.length > 0 ? (
        <div className="space-y-2">
          {articles.map((a) => (
            <Link
              key={a.id}
              href={`/article/${a.id}`}
              className="flex items-start gap-2 group"
            >
              <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-indigo-400" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                  {a.title}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {a.categoryName}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">
          还没有笔记，开始记录吧 📝
        </p>
      )}
    </>
  );
}
