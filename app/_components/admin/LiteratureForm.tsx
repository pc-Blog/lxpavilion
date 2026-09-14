"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Literature, LiteratureCategory } from "@/lib/types";
import { getCategories } from "@/lib/api/literature";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import SelectDropdown from "@/app/_components/admin/SelectDropdown";

interface LiteratureFormProps {
  /** 传入表示编辑，不传表示新建 */
  initial?: Literature | null;
  onSubmit: (payload: Literature, publish: boolean) => Promise<void>;
}

const inputClass =
  "glass-card !rounded-xl px-4 py-2.5 w-full text-sm outline-none bg-white/50 dark:bg-slate-800/50";

export default function LiteratureForm({ initial, onSubmit }: LiteratureFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [categoryId, setCategoryId] = useState<number>(initial?.categoryId ?? 0);
  const [writtenAt, setWrittenAt] = useState(initial?.writtenAt ?? "");
  const [weather, setWeather] = useState(initial?.weather ?? "");
  const [categories, setCategories] = useState<LiteratureCategory[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  const handleSave = async (publish: boolean) => {
    if (!title.trim()) { showErrorToast("标题不能为空"); return; }
    if (!content.trim()) { showErrorToast("正文不能为空"); return; }
    setSaving(true);
    try {
      await onSubmit(
        {
          id: initial?.id,
          title: title.trim(),
          content,
          categoryId: categoryId || null,
          writtenAt: writtenAt || null,
          weather: weather.trim() || null,
          isPublished: publish ? 1 : 0,
        },
        publish,
      );
      showSuccessToast(publish ? "已发布" : "已保存为隐藏");
      router.push("/admin/literature");
    } catch { showErrorToast("保存失败"); }
    finally { setSaving(false); }
  };

  const isEdit = Boolean(initial);

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-6">
        {isEdit ? "Edit Work" : "New Work"}
      </h1>

      <div className="glass-card p-4 space-y-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="作品标题"
          className={inputClass}
        />

        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <SelectDropdown
              options={categories}
              value={categoryId}
              onChange={(v) => setCategoryId(Number(v))}
              placeholder="选择分类"
              renderOption={(c) => c.name}
              getValue={(c) => c.id}
            />
          </div>
          <input
            type="date"
            value={writtenAt ?? ""}
            onChange={(e) => setWrittenAt(e.target.value)}
            className={`${inputClass} flex-1 min-w-[160px]`}
            aria-label="写作日期"
          />
          <input
            value={weather ?? ""}
            onChange={(e) => setWeather(e.target.value)}
            placeholder="天气（如：夜、阴晴）"
            className={`${inputClass} flex-1 min-w-[160px]`}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
            正文（纯文本，换行按原样保留）
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={20}
            placeholder="在此粘贴或撰写作品正文…"
            className="w-full glass-card !rounded-xl p-3 text-sm outline-none bg-white/50 dark:bg-slate-800/50 resize-y leading-relaxed"
          />
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {content.length} 字符
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => router.push("/admin/literature")}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all disabled:opacity-50"
          >
            保存为隐藏
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? "保存中…" : "发布"}
          </button>
        </div>
      </div>
    </div>
  );
}
