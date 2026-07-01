"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Category, Technology } from "@/lib/types";
import api from "@/lib/axios";
import { getList as getCategories } from "@/lib/api/category";
import { getTechList } from "@/lib/api/project";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import AdminMarkdownEditor from "@/app/_components/admin/MarkdownEditor";
import CoverImageInput from "@/app/_components/admin/CoverImageInput";
import SelectDropdown from "@/app/_components/admin/SelectDropdown";
import TagDropdown from "@/app/_components/admin/TagDropdown";

export default function NewProjectPage() {
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [categoryId, setCategoryId] = useState<number>(0);
  const [techIds, setTechIds] = useState<number[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [techs, setTechs] = useState<Technology[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    getCategories(undefined, 1, 9999).then((d) => setCategories(d.rows.filter((c) => c.type === "PROJECT"))).catch(() => {});
    getTechList().then((d) => setTechs(d)).catch(() => {});
  }, []);

  const handleSave = async (publish: boolean) => {
    if (!name.trim()) { setError("Name is required."); return; }
    if (!categoryId) { setError("Please select a category."); return; }
    setError("");
    setSaving(true);
    try {
      await api.post("/project", { name: name.trim(), summary, content, coverImage, techIds, githubUrl, demoUrl, categoryId, isPublished: publish ? 1 : 0 });
      showSuccessToast("Saved");
      router.push("/admin/project");
    } catch { showErrorToast("Save failed"); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-6">New Project</h1>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name *" className="glass-card !rounded-xl px-4 py-2.5 w-full text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          <SelectDropdown
            options={categories}
            value={categoryId}
            onChange={(v) => setCategoryId(Number(v))}
            placeholder="Select category *"
            renderOption={(c) => c.name}
            getValue={(c) => c.id!}
          />
          <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Summary" className="glass-card !rounded-xl px-4 py-2.5 w-full text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          <TagDropdown
            options={techs}
            selected={techIds}
            onChange={(v) => setTechIds(v as number[])}
            placeholder="Select techs..."
            renderOption={(t) => t.name}
            getValue={(t) => t.id!}
          />
          <CoverImageInput value={coverImage} onChange={setCoverImage} />
          <input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="GitHub URL" className="glass-card !rounded-xl px-4 py-2.5 w-full text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          <input value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} placeholder="Demo URL" className="glass-card !rounded-xl px-4 py-2.5 w-full text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
        </div>
        <label className="block text-xs font-bold text-slate-500">Content (Markdown)</label>
        <AdminMarkdownEditor value={content} onChange={setContent} />
        {error && <p className="text-sm text-red-500 font-bold">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => handleSave(true)} disabled={saving} className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl disabled:opacity-50">Publish</button>
          <button type="button" onClick={() => handleSave(false)} disabled={saving} className="px-6 py-2 bg-slate-400 hover:bg-slate-500 text-white text-sm font-bold rounded-xl disabled:opacity-50">Save Draft</button>
        </div>
      </div>
    </div>
  );
}
