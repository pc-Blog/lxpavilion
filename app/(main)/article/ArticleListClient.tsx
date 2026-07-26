"use client";

import { useState, useEffect } from "react";
import type { Category, Tag } from "@/lib/types";
import { getList as getCategories } from "@/lib/api/category";
import { getList as getTags } from "@/lib/api/tag";
import ArticleList from "@/app/_components/article/ArticleList";
import SearchBar from "@/app/_components/common/SearchBar";
import CategoryNav from "@/app/_components/common/CategoryNav";
import TagCloud from "@/app/_components/common/TagCloud";

export default function ArticlePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [tagId, setTagId] = useState<number | undefined>();
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    getCategories().then((data) =>
      setCategories(data.rows.filter((c) => c.type === "ARTICLE"))
    ).catch(() => {});
    getTags().then((data) => setTags(data.rows)).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("categoryId");
    const tid = params.get("tagId");
    if (cid) setCategoryId(Number(cid));
    if (tid) setTagId(Number(tid));
  }, []);

  return (
    <>
      <div className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">Articles</div>
      <p className="text-slate-500 dark:text-slate-400 mb-6">Tech, research, and thoughts.</p>

      <div className="flex flex-col gap-4 mb-8">
        <SearchBar onSearch={setKeyword} />
        {categories.length > 0 && (
          <CategoryNav categories={categories} activeId={categoryId} onSelect={setCategoryId} />
        )}
        {tags.length > 0 && (
          <TagCloud tags={tags} activeId={tagId} onSelect={setTagId} />
        )}
      </div>

      <ArticleList categoryId={categoryId} tagId={tagId} keyword={keyword} />
    </>
  );
}
