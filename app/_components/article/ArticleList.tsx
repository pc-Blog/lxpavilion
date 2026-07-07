"use client";

import { useState, useEffect, useRef } from "react";
import type { ArticleVO, ArticleQueryDTO } from "@/lib/types";
import { getPublicList, getViewCounts } from "@/lib/api/article";
import { siteConfig } from "@/lib/siteConfig";
import ArticleCard from "./ArticleCard";
import Pagination from "../common/Pagination";
import Loading from "../common/Loading";

interface Props {
  categoryId?: number;
  tagId?: number;
  keyword?: string;
}

export default function ArticleList({ categoryId, tagId, keyword }: Props) {
  const [articles, setArticles] = useState<ArticleVO[]>([]);
  const [viewMap, setViewMap] = useState<Record<number, number>>({});
  const [total, setTotal] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 9;
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) {
      setPageNum(1);
    }
    mountedRef.current = true;
  }, [categoryId, tagId, keyword]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const query: ArticleQueryDTO = { isPublished: true };
        if (categoryId) query.categoryId = categoryId;
        if (tagId) query.tagId = tagId;
        if (keyword) query.keyword = keyword;
        const data = await getPublicList({ pageNum, pageSize, query });
        if (!cancelled) {
          setArticles(data.rows);
          setTotal(data.total);
          if (siteConfig.featureViewCount) {
            getViewCounts().then((rows) => {
              const m: Record<number, number> = {};
              rows.forEach((r) => { m[r.article_id] = r.views; });
              setViewMap(m);
            }).catch(() => {});
          }
        }
      } catch {
        if (!cancelled) {
          setArticles([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [pageNum, categoryId, tagId, keyword]);

  if (loading) return <Loading />;

  if (articles.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400 dark:text-slate-500">
        <p className="text-lg">No articles found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a} viewCount={viewMap[a.id]} />
        ))}
      </div>
      <Pagination pageNum={pageNum} pageSize={pageSize} total={total} onChange={setPageNum} />
    </div>
  );
}
