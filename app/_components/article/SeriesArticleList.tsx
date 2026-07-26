"use client";

import { useState, useEffect, useRef } from "react";
import type { ArticleVO, ArticleQueryDTO } from "@/lib/types";
import { getPublicList } from "@/lib/api/article";
import ArticleCard from "./ArticleCard";
import Pagination from "../common/Pagination";
import Loading from "../common/Loading";

interface Props {
  series: string;
  onBack: () => void;
}

export default function SeriesArticleList({ series, onBack }: Props) {
  const [articles, setArticles] = useState<ArticleVO[]>([]);
  const [total, setTotal] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 9;
  const initialSeries = useRef(series);

  // Reset pageNum when series changes
  useEffect(() => {
    if (initialSeries.current !== series) {
      setPageNum(1);
      initialSeries.current = series;
    }
  }, [series]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const query: ArticleQueryDTO = { isPublished: true, series };
    getPublicList({ pageNum, pageSize, query })
      .then((data) => {
        if (!cancelled) {
          setArticles(data.rows);
          setTotal(data.total);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setArticles([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [series, pageNum]);

  return (
    <div>
      {/* 返回按钮 + 系列标题 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-white/60 dark:bg-slate-800/60 rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to series
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{series}</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500">{total} articles</p>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : articles.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <p className="text-lg">No articles found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
          <Pagination pageNum={pageNum} pageSize={pageSize} total={total} onChange={setPageNum} />
        </>
      )}
    </div>
  );
}
