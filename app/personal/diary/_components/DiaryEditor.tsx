"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Diary, DiaryRequest } from "@/lib/types";
import { create, remove, update } from "@/lib/api/diary";
import SubcategoryPicker from "./SubcategoryPicker";
import { WeatherIcon } from "./WeatherIcon";
import {
  CATEGORY_OPTIONS,
  WEATHER_OPTIONS,
  categoryColor,
  categoryLabel,
  formatDiaryDate,
  todayString,
  weatherLabel,
} from "./constants";

interface DraftActivity {
  activity: string;
  category: number;
  subcategory?: string | null;
}

/**
 * 日记编辑对话框
 *
 * 布局对齐源项目 LogCard.vue 的详情弹窗：
 *   - 头部：完整日期 + 「+ 日志」/「删除」（删除整天，二次确认）
 *   - 内容：天气 tag → 条目列表
 *   - 条目行：分类 tag（点击弹出分类选择框）→ 小分类 → 正文 → × 删除 / ✏️ 编辑
 *   - 分类选择框：独立的二级弹窗，分类按钮网格
 *
 * 与源的两处刻意差异（均为明确决定）：
 *   1. 新建走「填完活动再提交」，不产生没有活动的空天；
 *   2. 底部为显式「保存 / 取消」，不照抄源 watch(dialogVisible) 的「关窗即存」。
 */
export default function DiaryEditor({
  /** 传 null 表示新建；传 Diary 表示编辑 */
  diary,
  onClose,
  onSaved,
}: {
  diary: Diary | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!diary?.id;
  const [recordDate, setRecordDate] = useState(diary?.recordDate ?? todayString());
  const [weather, setWeather] = useState(diary?.weather ?? 1);
  const [rows, setRows] = useState<DraftActivity[]>(
    diary?.logs?.length
      ? diary.logs.map((l) => ({
          activity: l.activity,
          category: l.category,
          subcategory: l.subcategory ?? undefined,
        }))
      : [{ activity: "", category: 1, subcategory: undefined }],
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /** 当前正在内联编辑的行号 */
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  /** 分类选择弹窗：记录正在改哪一行 */
  const [categoryPickerFor, setCategoryPickerFor] = useState<number | null>(null);
  const [weatherPickerOpen, setWeatherPickerOpen] = useState(false);

  useEffect(() => {
    if (editingIndex !== null) editInputRef.current?.focus();
  }, [editingIndex]);

  const title = useMemo(
    () => (isEdit ? formatDiaryDate(diary!.recordDate) : "新建日记"),
    [isEdit, diary],
  );

  const patchRow = (index: number, patch: Partial<DraftActivity>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const validRows = rows
    .map((r) => ({ ...r, activity: r.activity.trim() }))
    .filter((r) => r.activity.length > 0);

  const handleSave = async () => {
    if (validRows.length === 0) return;
    setSaving(true);
    try {
      const payload: DiaryRequest = {
        weather,
        logs: validRows.map((r) => ({
          activity: r.activity,
          category: r.category,
          subcategory: r.subcategory ?? null,
        })),
      };
      if (isEdit) {
        // 日期不可修改，故不传 recordDate
        await update({ ...payload, id: diary!.id });
      } else {
        await create({ ...payload, recordDate });
      }
      onSaved();
    } catch {
      // 错误提示由 axios 拦截器统一弹出
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDay = async () => {
    if (!isEdit) return;
    if (!window.confirm("确定要删除这一天的所有日志吗？此操作不可恢复。")) return;
    setDeleting(true);
    try {
      await remove(diary!.id!);
      onSaved();
    } catch {
      /* 拦截器已提示 */
    } finally {
      setDeleting(false);
    }
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, { activity: "", category: 1, subcategory: undefined }]);
  };

  const handleDeleteRow = (index: number) => {
    if (!window.confirm("确定要删除这条日志吗？")) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
    setEditingIndex(null);
  };

  const busy = saving || deleting;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center"
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy) onClose();
        }}
      >
        {/* 源项目 el-dialog width="80%" */}
        <div className="my-8 w-full max-w-3xl rounded-2xl border border-white/40 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-800/95">
          {/* ── 头部：日期 + 「+ 日志」/「删除」── */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-3.5 dark:border-slate-700">
            <span className="text-sm font-black text-slate-800 dark:text-white">{title}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                disabled={busy}
                className="flex items-center gap-1 rounded-full bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
              >
                <Plus size={13} />
                日志
              </button>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDeleteDay}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-full bg-rose-500 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-rose-600 disabled:opacity-50"
                >
                  {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  删除
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-700"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── 内容：源 log-detail-content，padding 16px ── */}
          <div className="p-4">
            {/* 日期（新建时可改；源里日期由卡片决定，此处保留新建时选择能力） */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={recordDate}
                max={todayString()}
                disabled={isEdit || busy}
                onChange={(e) => setRecordDate(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white/80 px-2.5 text-xs text-slate-700 outline-none focus:border-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-200"
              />
              {isEdit && <span className="text-[10px] text-slate-400">日期不可修改</span>}
            </div>

            {/* 天气：源用 el-tag 展示，这里点击可切换（新档位 9=中雨） */}
            <div className="relative">
              <button
                type="button"
                disabled={busy}
                onClick={() => setWeatherPickerOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <WeatherIcon weather={weather} size={14} />
                {weatherLabel(weather)}
              </button>
              {weatherPickerOpen && (
                <div className="absolute left-0 top-[calc(100%+6px)] z-20 flex max-w-[320px] flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-600 dark:bg-slate-800">
                  {WEATHER_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => {
                        setWeather(o.value);
                        setWeatherPickerOpen(false);
                      }}
                      className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition-all ${
                        weather === o.value
                          ? "border-indigo-400 bg-indigo-50 font-bold text-indigo-600 dark:border-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-300"
                          : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <WeatherIcon weather={o.value} size={12} />
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── 条目列表：源 log-entries（gap 16 / margin-top 20）── */}
            <div className="mt-5 flex flex-col gap-4">
              {rows.map((row, index) => (
                <div key={index} className="flex items-start gap-3 max-sm:flex-col">
                  {/* 分类 tag：源 category-tag（min-width 80 / height 32），点击弹出分类选择 */}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setCategoryPickerFor(index)}
                    style={{ backgroundColor: categoryColor(row.category) }}
                    className="mt-0.5 inline-flex h-8 min-w-20 shrink-0 items-center justify-center rounded px-2 text-xs font-bold text-white transition-all duration-200 hover:scale-105 hover:shadow-md disabled:opacity-60 max-sm:mt-0 max-sm:self-start"
                    title="点击更换分类"
                  >
                    {categoryLabel(row.category)}
                  </button>

                  <SubcategoryPicker
                    value={row.subcategory}
                    category={row.category}
                    onChange={(v) => patchRow(index, { subcategory: v })}
                  />

                  {/* 正文：非编辑态为文本，编辑态为输入框（源 activity-text / edit-input） */}
                  {editingIndex === index ? (
                    <textarea
                      ref={editInputRef}
                      value={row.activity}
                      rows={1}
                      disabled={busy}
                      onChange={(e) => patchRow(index, { activity: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          setEditingIndex(null);
                        } else if (e.key === "Escape") {
                          setEditingIndex(null);
                        }
                      }}
                      className="min-h-8 flex-1 resize-y rounded-lg border border-indigo-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none dark:border-indigo-500/60 dark:bg-slate-900/50 dark:text-slate-100"
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setEditingIndex(index)}
                      className="min-h-8 flex-1 rounded-lg px-1 py-1.5 text-left text-[13px] leading-relaxed text-slate-700 transition-colors hover:bg-slate-100/70 dark:text-slate-200 dark:hover:bg-slate-600/30"
                    >
                      {row.activity || (
                        <span className="text-slate-400 dark:text-slate-500">点击填写内容…</span>
                      )}
                    </button>
                  )}

                  {/* 行内操作：源为「× 删除」+「✏️ 编辑」两个按钮 */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDeleteRow(index)}
                      title="删除这条"
                      className="rounded p-1 text-slate-400 transition-colors hover:text-rose-500 disabled:opacity-50"
                    >
                      <X size={15} />
                    </button>
                    {editingIndex === index ? (
                      <button
                        type="button"
                        onClick={() => setEditingIndex(null)}
                        title="完成编辑"
                        className="rounded p-1 text-indigo-500 transition-colors hover:text-indigo-600"
                      >
                        <Check size={15} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setEditingIndex(index)}
                        title="编辑这条"
                        className="rounded p-1 text-slate-400 transition-colors hover:text-slate-600 disabled:opacity-50 dark:hover:text-slate-200"
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {rows.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-400">这一天没有记录日志</p>
              )}
            </div>
          </div>

          {/* ── 底部：显式保存 / 取消（不照抄源「关窗即存」）── */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200/70 px-5 py-3.5 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-full px-4 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || validRows.length === 0}
              className="flex items-center gap-1.5 rounded-full bg-indigo-500 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              保存
            </button>
          </div>
        </div>
      </div>

      {/* ── 分类选择弹窗（源 categoryDialog：width 60%，分类按钮网格）── */}
      {categoryPickerFor !== null && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCategoryPickerFor(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/40 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-800/95">
            <div className="border-b border-slate-200/70 px-5 py-3.5 text-center text-sm font-black text-slate-800 dark:border-slate-700 dark:text-white">
              选择分类
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
              {CATEGORY_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    patchRow(categoryPickerFor, { category: o.value });
                    setCategoryPickerFor(null);
                  }}
                  style={{ backgroundColor: categoryColor(o.value) }}
                  className="rounded-lg px-3 py-3 text-sm font-bold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
