"use client";

import { useState, useEffect, useRef } from "react";
import type { ArticleQueryDTO, GroupedItem, GroupedPageVO } from "@/lib/types";
import { getGroupedPublicList, getViewCounts } from "@/lib/api/article";
import { siteConfig } from "@/lib/siteConfig";
import ArticleCard from "./ArticleCard";
import SeriesCard from "./SeriesCard";
import SeriesArticleList from "./SeriesArticleList";
import Pagination from "../common/Pagination";
import Loading from "../common/Loading";

interface Props {
  categoryId?: number;
  tagId?: number;
  keyword?: string;
}

export default function ArticleList({ categoryId, tagId, keyword }: Props) {
  const [items, setItems] = useState<GroupedItem[]>([]);
  const [viewMap, setViewMap] = useState<Record<number, number>>({});
  const [total, setTotal] = useState(0);
  const [articleTotal, setArticleTotal] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeSeries, setActiveSeries] = useState<string | null>(null);
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
        const data = await getGroupedPublicList({ pageNum, pageSize, query });
        if (!cancelled) {
          setItems(data.rows);
          setTotal(data.total);
          setArticleTotal(data.articleTotal);
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
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [pageNum, categoryId, tagId, keyword]);

  // 已进入某系列
  if (activeSeries) {
    return (
      <SeriesArticleList
        series={activeSeries}
        onBack={() => setActiveSeries(null)}
      />
    );
  }

  if (loading) return <Loading />;

  if (items.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400 dark:text-slate-500">
        <p className="text-lg">No articles found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item, i) =>
          item.type === "series" && item.series ? (
            <SeriesCard
              key={`series-${item.series}`}
              series={item.series}
              count={item.seriesArticleCount ?? 0}
              articles={item.seriesArticles ?? []}
              onSelect={setActiveSeries}
              viewCount={(item.seriesArticles ?? []).reduce((sum, a) => sum + (viewMap[a.id] ?? 0), 0)}
            />
          ) : (
            <ArticleCard key={item.article?.id ?? i} article={item.article!} viewCount={viewMap[item.article?.id ?? 0]} />
          )
        )}
      </div>
      <Pagination pageNum={pageNum} pageSize={pageSize} total={total} displayTotal={articleTotal} onChange={setPageNum} />
    </div>
  );
}
