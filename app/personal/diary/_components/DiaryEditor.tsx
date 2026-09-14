"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import type { Diary, DiaryRequest } from "@/lib/types";
import { create, remove, update } from "@/lib/api/diary";
import SubcategoryPicker from "./SubcategoryPicker";
import { WeatherIcon } from "./WeatherIcon";
import {
  CATEGORY_OPTIONS,
  WEATHER_OPTIONS,
  categoryColor,
  formatDiaryDate,
  todayString,
} from "./constants";

interface DraftActivity {
  activity: string;
  category: number;
  subcategory?: string | null;
}

/**
 * 日记编辑对话框
 *
 * 对应源项目 LogCard.vue 的详情弹窗，但改了两处：
 *   1. 新建走「填完活动再提交」（方案乙），不会产生没有活动的空天；
 *   2. 显式「保存 / 取消」，不照抄源项目「关窗即存」的行为
 *      （源那个 watch(dialogVisible) 在点取消时同样会 PUT）。
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

  const busy = saving || deleting;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-white/40 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-800/95">
        {/* ── 头部 ── */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-3.5 dark:border-slate-700">
          <h3 className="text-sm font-black text-slate-800 dark:text-white">{title}</h3>
          <div className="flex items-center gap-2">
            {isEdit && (
              <button
                type="button"
                onClick={handleDeleteDay}
                disabled={busy}
                className="flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/30"
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

        {/* ── 表单 ── */}
        <div className="space-y-4 px-5 py-4">
          {/* 日期 */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-10 shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">日期</span>
            <input
              type="date"
              value={recordDate}
              max={todayString()}
              disabled={isEdit || busy}
              onChange={(e) => setRecordDate(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white/80 px-2.5 text-xs text-slate-700 outline-none focus:border-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-200 dark:disabled:bg-slate-700/30"
            />
            {isEdit && (
              <span className="text-[10px] text-slate-400">日期不可修改</span>
            )}
          </div>

          {/* 天气 */}
          <div className="flex flex-wrap items-start gap-3">
            <span className="mt-1 w-10 shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">天气</span>
            <div className="flex flex-wrap gap-1.5">
              {WEATHER_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  disabled={busy}
                  onClick={() => setWeather(o.value)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-all disabled:opacity-50 ${
                    weather === o.value
                      ? "border-indigo-400 bg-indigo-50 font-bold text-indigo-600 dark:border-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-300"
                      : "border-slate-200 bg-white/60 text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-300"
                  }`}
                >
                  <WeatherIcon weather={o.value} size={13} />
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* 活动条目 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                活动条目
                <span className="ml-1.5 font-normal text-slate-400">
                  {validRows.length} 条
                </span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setRows((prev) => [
                    ...prev,
                    { activity: "", category: 1, subcategory: undefined },
                  ])
                }
                className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-900/20 dark:text-indigo-400"
              >
                <Plus size={13} />
                添加一行
              </button>
            </div>

            <div className="space-y-1.5">
              {rows.map((row, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white/50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-700/20"
                >
                  <span className="w-4 shrink-0 text-center text-[10px] font-bold text-slate-300 dark:text-slate-600">
                    {index + 1}
                  </span>

                  {/* 分类选择 */}
                  <select
                    value={row.category}
                    disabled={busy}
                    onChange={(e) => patchRow(index, { category: Number(e.target.value) })}
                    style={{ backgroundColor: categoryColor(row.category) }}
                    className="h-8 w-[76px] shrink-0 rounded-lg px-1.5 text-xs font-bold text-white outline-none disabled:opacity-60"
                  >
                    {CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className="bg-white text-slate-700">
                        {o.label}
                      </option>
                    ))}
                  </select>

                  {/* 小分类 */}
                  <SubcategoryPicker
                    value={row.subcategory}
                    category={row.category}
                    onChange={(v) => patchRow(index, { subcategory: v })}
                  />

                  {/* 正文：非编辑态是文本，点击进入内联编辑 */}
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
                      className="min-h-8 flex-1 resize-y rounded-lg border border-indigo-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none dark:border-indigo-500/60 dark:bg-slate-900/50 dark:text-slate-100"
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setEditingIndex(index)}
                      className="min-h-8 flex-1 rounded-lg px-2 py-1 text-left text-xs text-slate-700 transition-colors hover:bg-slate-100/70 dark:text-slate-200 dark:hover:bg-slate-600/30"
                    >
                      {row.activity || (
                        <span className="text-slate-400 dark:text-slate-500">点击填写内容…</span>
                      )}
                    </button>
                  )}

                  {/* 行内操作：确认 / 删除 */}
                  {editingIndex === index ? (
                    <button
                      type="button"
                      onClick={() => setEditingIndex(null)}
                      className="shrink-0 rounded-full p-1 text-emerald-500 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      title="完成"
                    >
                      <Check size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (rows.length === 1) {
                          patchRow(index, { activity: "", subcategory: undefined });
                          return;
                        }
                        setRows((prev) => prev.filter((_, i) => i !== index));
                        setEditingIndex(null);
                      }}
                      className="shrink-0 rounded-full p-1 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50 dark:text-slate-600 dark:hover:bg-rose-900/20"
                      title="删除这一条"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {rows.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">
                还没有条目，点「添加一行」开始记录
              </p>
            )}
          </div>
        </div>

        {/* ── 底部按钮 ── */}
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
  );
}
