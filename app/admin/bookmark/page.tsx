"use client";

import { useState, useEffect, useCallback } from "react";
import type { Bookmark, BookmarkCategory } from "@/lib/types";
import { getPage, create, update, remove, getCategoryTree, createCategory, updateCategory, removeCategory } from "@/lib/api/bookmark";
import Tooltip from "@/app/_components/common/Tooltip";
import Dialog from "@/app/_components/common/Dialog";
import Pagination from "@/app/_components/common/Pagination";
import SelectDropdown from "@/app/_components/admin/SelectDropdown";
import { showSuccessToast } from "@/lib/toast";
import { useConfirm } from "@/app/_components/common/ConfirmDialog";

/** 拍平分类树：返回 [{id, name, depth}] 用于下拉 */
function flattenTree(cats: BookmarkCategory[], depth = 0): { id: number; name: string; depth: number }[] {
  const result: { id: number; name: string; depth: number }[] = [];
  for (const c of cats) {
    result.push({ id: c.id!, name: c.name, depth });
    // 递归子分类（假设后端返回的 tree 已按 parent 嵌套）
    const children = cats.filter((x) => x.parentId === c.id);
    if (children.length) result.push(...flattenTree(children, depth + 1));
  }
  return result;
}

type CatMode = "list" | "form";

export default function AdminBookmarkPage() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [items, setItems] = useState<Bookmark[]>([]);
  const [categories, setCategories] = useState<BookmarkCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // ── Bookmark 弹窗 ──
  const [bmDialogOpen, setBmDialogOpen] = useState(false);
  const [bmEditId, setBmEditId] = useState<number | null>(null);
  const [bmName, setBmName] = useState("");
  const [bmUrl, setBmUrl] = useState("");
  const [bmDesc, setBmDesc] = useState("");
  const [bmIcon, setBmIcon] = useState("");
  const [bmCatId, setBmCatId] = useState<number | "">("");
  const [bmIsPin, setBmIsPin] = useState(0);
  const [bmSort, setBmSort] = useState(0);

  // ── 分类管理弹窗 ──
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catMode, setCatMode] = useState<CatMode>("list");
  const [catEditId, setCatEditId] = useState<number | null>(null);
  const [catName, setCatName] = useState("");
  const [catParentId, setCatParentId] = useState<number | "">("");
  const [catSort, setCatSort] = useState(0);

  const flatCats = flattenTree(categories);

  // ── 数据加载 ──
  const loadCategories = useCallback(async () => {
    try { setCategories(await getCategoryTree()); } catch {}
  }, []);

  const refresh = useCallback(async (kw?: string, pn?: number, ps?: number) => {
    try {
      const d = await getPage(kw || undefined, pn, ps);
      setItems(d.rows);
      setTotal(d.total);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); loadCategories(); }, [refresh, loadCategories]);

  useEffect(() => {
    setPageNum(1);
    const timer = setTimeout(() => refresh(keyword || undefined, 1, pageSize), 300);
    return () => clearTimeout(timer);
  }, [keyword, refresh, pageSize]);

  function catLabel(id: number | null | undefined): string {
    if (id == null) return "";
    const c = flatCats.find((c) => c.id === id);
    return c ? "  ".repeat(c.depth) + c.name : "";
  }

  // ── Bookmark CRUD ──
  const openAddBm = () => {
    setBmEditId(null);
    setBmName(""); setBmUrl(""); setBmDesc(""); setBmIcon("🔗");
    setBmCatId(""); setBmIsPin(1); setBmSort(0);
    setBmDialogOpen(true);
  };

  const openEditBm = (b: Bookmark) => {
    setBmEditId(b.id!);
    setBmName(b.name); setBmUrl(b.url); setBmDesc(b.description || ""); setBmIcon(b.icon || "🔗");
    setBmCatId(b.categoryId ?? ""); setBmIsPin(b.isPin ?? 0); setBmSort(b.sortOrder ?? 0);
    setBmDialogOpen(true);
  };

  const saveBm = async () => {
    if (!bmName.trim() || !bmUrl.trim()) return;
    const data: Bookmark = {
      name: bmName.trim(), url: bmUrl.trim(),
      description: bmDesc.trim() || undefined, icon: bmIcon.trim() || "🔗",
      categoryId: bmCatId !== "" ? bmCatId : null,
      isPin: bmIsPin, sortOrder: bmSort,
    };
    if (bmEditId) {
      await update({ id: bmEditId, ...data });
      showSuccessToast("Updated");
    } else {
      await create(data);
      showSuccessToast("Created");
    }
    setBmDialogOpen(false);
    refresh(keyword || undefined, pageNum, pageSize);
  };

  const deleteBm = async (id: number) => {
    if (!await confirm("Delete this bookmark?")) return;
    await remove(id);
    showSuccessToast("Deleted");
    refresh(keyword || undefined, pageNum, pageSize);
  };

  const togglePin = async (b: Bookmark) => {
    await update({ id: b.id, ...b, isPin: b.isPin ? 0 : 1 });
    showSuccessToast(b.isPin ? "Unpinned" : "Pinned");
    refresh(keyword || undefined, pageNum, pageSize);
  };

  // ── 分类 CRUD ──
  const openCatList = () => {
    setCatMode("list");
    setCatDialogOpen(true);
  };

  const openAddCat = () => {
    setCatEditId(null);
    setCatName(""); setCatParentId(""); setCatSort(0);
    setCatMode("form");
  };

  const openEditCat = (c: BookmarkCategory) => {
    setCatEditId(c.id!);
    setCatName(c.name); setCatParentId(c.parentId ?? ""); setCatSort(c.sortOrder ?? 0);
    setCatMode("form");
  };

  const saveCat = async () => {
    if (!catName.trim()) return;
    const data: BookmarkCategory = {
      name: catName.trim(),
      parentId: catParentId !== "" ? catParentId : null,
      sortOrder: catSort,
    };
    if (catEditId) {
      await updateCategory({ id: catEditId, ...data });
      showSuccessToast("Category updated");
    } else {
      await createCategory(data);
      showSuccessToast("Category created");
    }
    loadCategories();
    setCatMode("list");
  };

  const deleteCat = async (id: number) => {
    if (!await confirm("Delete this category? Bookmarks under it will become uncategorized.")) return;
    await removeCategory(id);
    showSuccessToast("Category deleted");
    loadCategories();
    refresh(keyword || undefined, pageNum, pageSize);
  };

  if (loading) return <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mt-10" />;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Bookmarks</h1>
        <button onClick={openCatList} className="px-3 py-1.5 text-xs font-bold bg-white/50 dark:bg-slate-800/50 border border-white/40 dark:border-white/10 rounded-xl text-slate-500 dark:text-slate-400 hover:text-indigo-500 transition-colors">
          Manage Categories
        </button>
      </div>

      {/* 搜索 + 新增 */}
      <div className="flex gap-3 mb-6">
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search bookmarks..."
          className="glass-card !rounded-xl px-4 py-2.5 flex-1 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
        <button onClick={openAddBm} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors">
          Add Bookmark
        </button>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-auto flex flex-col gap-2">
        {items.map((b) => (
          <div key={b.id} className="glass-card px-4 py-3 flex items-center gap-4 group">
            <span className="text-2xl inline-flex items-center justify-center min-w-[2rem]">
              {b.icon?.startsWith("http") ? (
                <img src={b.icon} alt="" className="w-6 h-6 rounded" />
              ) : (
                b.icon || "🔗"
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{b.name}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${b.isPin ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600" : "bg-slate-100 dark:bg-slate-700 text-slate-400"}`}>
                  {b.isPin ? "Pinned" : "Hidden"}
                </span>
                {b.categoryId && flatCats.some((c) => c.id === b.categoryId) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-400 truncate max-w-[120px]">
                    {catLabel(b.categoryId)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{b.url}</p>
              {b.description && <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{b.description}</p>}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <Tooltip text={b.isPin ? "Unpin" : "Pin"}>
                <button onClick={() => togglePin(b)} className="p-1 text-amber-400 hover:text-amber-600 transition-colors">
                  {b.isPin ? (
                    <svg className="w-3.5 h-3.5" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                  )}
                </button>
              </Tooltip>
              <Tooltip text="Edit">
                <button onClick={() => openEditBm(b)} className="p-1 text-indigo-400 hover:text-indigo-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              </Tooltip>
              <Tooltip text="Delete">
                <button onClick={() => deleteBm(b.id!)} className="p-1 text-red-400 hover:text-red-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>

      <Pagination total={total} pageNum={pageNum} pageSize={pageSize}
        onChange={(pn) => { setPageNum(pn); refresh(keyword || undefined, pn, pageSize); }}
        onPageSizeChange={(ps) => { setPageSize(ps); setPageNum(1); refresh(keyword || undefined, 1, ps); }} />

      {/* ════════════════ Bookmark 弹窗 ════════════════ */}
      <Dialog open={bmDialogOpen} onClose={() => setBmDialogOpen(false)} title={bmEditId ? "Edit Bookmark" : "Add Bookmark"}>
        <div className="flex flex-col gap-3">
          <input autoFocus value={bmName} onChange={(e) => setBmName(e.target.value)} placeholder="Site name *" className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          <input value={bmUrl} onChange={(e) => setBmUrl(e.target.value)} placeholder="Site URL * (https://...)" className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          <input value={bmDesc} onChange={(e) => setBmDesc(e.target.value)} placeholder="Description" className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          <input value={bmIcon} onChange={(e) => setBmIcon(e.target.value)} placeholder="Icon: emoji (🎬) or logo URL (https://...)" className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
          <SelectDropdown<{ id: number; name: string; depth: number }>
            options={flatCats} value={bmCatId}
            onChange={(v) => setBmCatId(v as number)}
            placeholder="Select category (optional)"
            renderOption={(o) => "  ".repeat(o.depth) + o.name}
            getValue={(o) => o.id} searchable />
          <div className="flex gap-3">
            <input type="number" value={bmSort} onChange={(e) => setBmSort(Number(e.target.value))} placeholder="Sort order" className="w-24 glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <input type="checkbox" checked={bmIsPin === 1} onChange={(e) => setBmIsPin(e.target.checked ? 1 : 0)} className="rounded" />
              Pinned
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setBmDialogOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
          <button onClick={saveBm} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors">Save</button>
        </div>
      </Dialog>

      {/* ════════════════ 分类管理弹窗 ════════════════ */}
      <Dialog open={catDialogOpen} onClose={() => setCatDialogOpen(false)} title="Manage Categories">
        {catMode === "list" ? (
          <>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto mb-4">
              {categories.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">No categories yet.</p>
              )}
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/50 dark:bg-slate-800/50 group/cat">
                  <span className="text-sm flex-1">
                    {c.parentId && <span className="text-slate-300 dark:text-slate-600 mr-1">└</span>}
                    {c.name}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/cat:opacity-100 transition-opacity">
                    <button onClick={() => openEditCat(c)} className="p-1 text-indigo-400 hover:text-indigo-600 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => deleteCat(c.id!)} className="p-1 text-red-400 hover:text-red-600 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={openAddCat} className="w-full py-2 text-sm font-bold text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-colors">
              + New Category
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <input autoFocus value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Category name *" className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
              <SelectDropdown<{ id: number; name: string; depth: number }>
                options={flatCats.filter((c) => c.id !== catEditId)}
                value={catParentId}
                onChange={(v) => setCatParentId(v as number)}
                placeholder="Parent category (optional)"
                renderOption={(o) => "  ".repeat(o.depth) + o.name}
                getValue={(o) => o.id} />
              <input type="number" value={catSort} onChange={(e) => setCatSort(Number(e.target.value))} placeholder="Sort order" className="w-24 glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50" />
            </div>
            <div className="flex justify-between mt-6">
              <button onClick={() => setCatMode("list")} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors">← Back</button>
              <button onClick={saveCat} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors">Save</button>
            </div>
          </>
        )}
      </Dialog>

      {ConfirmDialog}
    </div>
  );
}
