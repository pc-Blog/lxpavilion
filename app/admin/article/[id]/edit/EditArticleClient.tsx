"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import type { Category, Tag } from "@/lib/types";
import api from "@/lib/axios";
import { getList as getCategories } from "@/lib/api/category";
import { getList as getTags } from "@/lib/api/tag";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import AdminMarkdownEditor from "@/app/_components/admin/MarkdownEditor";
import CoverImageInput from "@/app/_components/admin/CoverImageInput";
import SelectDropdown from "@/app/_components/admin/SelectDropdown";
import TagDropdown from "@/app/_components/admin/TagDropdown";

export default function EditArticlePage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [categoryId, setCategoryId] = useState<number>(0);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getCategories(undefined, 1, 9999).then((d) => setCategories(d.rows.filter((c) => c.type === "ARTICLE"))).catch(() => {});
    getTags(undefined, 1, 9999).then((d) => setTags(d.rows)).catch(() => {});
    api.get(`/article/${id}`).then((raw: unknown) => {
      const a = raw as Record<string, unknown>;
      setTitle(String(a.title || ""));
      setSummary(String(a.summary || ""));
      setContent(String(a.content || ""));
      setCoverImage(String(a.coverImage || ""));
      setCategoryId(Number(a.categoryId || 0));
      const tags = (a.tags as { id: number }[]) || [];
      setTagIds(tags.map((t) => t.id));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (close = false) => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.put("/article", { id: Number(id), title: title.trim(), summary, content, coverImage, categoryId, tagIds });
      showSuccessToast("Saved");
      if (close) router.push("/admin/article");
    } catch { showErrorToast("Save failed"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mt-10" />;

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Edit Article</h1>
      <div className="glass-card p-4 space-y-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="glass-card !rounded-xl px-4 py-2.5 w-full text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
        <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Summary" className="glass-card !rounded-xl px-4 py-2.5 w-full text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
        <CoverImageInput value={coverImage} onChange={setCoverImage} />
        <div className="flex gap-4">
          <SelectDropdown
            options={categories}
            value={categoryId}
            onChange={(v) => setCategoryId(Number(v))}
            placeholder="Select category"
            renderOption={(c) => c.name}
            getValue={(c) => c.id!}
          />
          <TagDropdown
            options={tags}
            selected={tagIds}
            onChange={(v) => setTagIds(v as number[])}
            placeholder="Select tags..."
            renderOption={(t) => t.name}
            getValue={(t) => t.id!}
          />
        </div>
        <label className="block text-xs font-bold text-slate-500">Content (Markdown)</label>
        <AdminMarkdownEditor value={content} onChange={setContent} />
        <div className="flex gap-3">
          <button onClick={() => handleSave()} disabled={saving} className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl disabled:opacity-50">Save</button>
          <button onClick={() => handleSave(true)} disabled={saving} className="px-6 py-2 bg-slate-400 hover:bg-slate-500 text-white text-sm font-bold rounded-xl disabled:opacity-50">Save &amp; Close</button>
        </div>
      </div>
    </div>
  );
}
