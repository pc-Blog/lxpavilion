"use client";

import { useState, useEffect, useCallback } from "react";
import type { Category, CategoryType } from "@/lib/types";
import { getList, create, update, remove } from "@/lib/api/category";
import Tooltip from "@/app/_components/common/Tooltip";
import Dialog from "@/app/_components/common/Dialog";
import { showSuccessToast } from "@/lib/toast";
import { useConfirm } from "@/app/_components/common/ConfirmDialog";
import Pagination from "@/app/_components/common/Pagination";
import SelectDropdown from "@/app/_components/admin/SelectDropdown";

interface TypeOption {
  value: CategoryType;
  label: string;
}

const typeOptions: TypeOption[] = [
  { value: "ARTICLE", label: "ARTICLE" },
  { value: "LITERATURE", label: "LITERATURE" },
];

export default function AdminCategoryPage() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<CategoryType>("ARTICLE");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("ARTICLE");

  const refresh = useCallback(async (
    kw?: string,
    pn?: number,
    ps?: number,
    tp?: CategoryType,
  ) => {
    try {
      const d = await getList(kw || undefined, pn, ps, tp);
      setItems(d.rows);
      setTotal(d.total);
    } catch {}
    finally { setLoading(false); }
  }, []);

  // 首次加载与关键字防抖共用同一 effect（挂载时即触发一次），
  // 避免额外的初始请求 effect 在挂载时同步 setState。
  useEffect(() => {
    const timer = setTimeout(() => refresh(keyword || undefined, 1, pageSize, typeFilter), 300);
    return () => clearTimeout(timer);
  }, [keyword, refresh, pageSize, typeFilter]);

  const openAdd = () => {
    setEditingId(null);
    setName("");
    // 默认沿用当前筛选的类型，减少手动切换
    setType(typeFilter);
    setDialogOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditingId(c.id!);
    setName(c.name);
    setType(c.type);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (editingId) { await update({ id: editingId, name: name.trim(), type }); showSuccessToast("Updated"); }
    else { await create({ name: name.trim(), type }); showSuccessToast("Created"); }
    setDialogOpen(false);
    refresh(keyword || undefined, pageNum, pageSize, typeFilter);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm("Delete?"); if (!ok) return;
    await remove(id); showSuccessToast("Deleted");
    refresh(keyword || undefined, pageNum, pageSize, typeFilter);
  };

  if (loading) return <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mt-10" />;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Categories</h1>

      {/* Type filter */}
      <div className="flex items-center gap-2 mb-4">
        {typeOptions.map((o) => (
          <button
            key={o.value}
            onClick={() => { setTypeFilter(o.value); setPageNum(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              typeFilter === o.value
                ? "bg-indigo-500 text-white"
                : "bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60"
            }`}
          >
            {o.value}
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex gap-3 mb-6">
        <input
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPageNum(1); }}
          placeholder="Search categories..."
          className="glass-card !rounded-xl px-4 py-2.5 flex-1 text-sm outline-none bg-white/50 dark:bg-slate-800/50"
        />
        <button onClick={openAdd} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors">
          Add Category
        </button>
      </div>

      {/* Category list */}
      <div className="flex-1 overflow-auto flex flex-col gap-2">
        {items.length === 0 ? (
          <div className="glass-card !rounded-2xl p-8 text-center text-sm text-slate-400 dark:text-slate-500">
            No categories
          </div>
        ) : items.map((c) => (
          <div key={c.id} className="glass-card px-4 py-3 flex items-center gap-4 group">
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 font-mono">{c.type}</span>
            <span className="flex-1 text-sm font-bold">{c.name}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Tooltip text="Edit">
                <button onClick={() => openEdit(c)} className="p-1 text-indigo-400 hover:text-indigo-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              </Tooltip>
              <Tooltip text="Delete">
                <button onClick={() => handleDelete(c.id!)} className="p-1 text-red-400 hover:text-red-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>

      <Pagination total={total} pageNum={pageNum} pageSize={pageSize} onChange={(pn) => { setPageNum(pn); refresh(keyword || undefined, pn, pageSize, typeFilter); }} onPageSizeChange={(ps) => { setPageSize(ps); setPageNum(1); refresh(keyword || undefined, 1, ps, typeFilter); }} />

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editingId ? "Edit Category" : "Add Category"}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          placeholder="Category name"
          className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50 mb-3"
        />
        <SelectDropdown
          options={typeOptions}
          value={type}
          onChange={(v) => setType(v as CategoryType)}
          placeholder="Select type"
          renderOption={(o) => o.label}
          getValue={(o) => o.value}
        />
        <div className="flex justify-end gap-3">
          <button onClick={() => setDialogOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors">Save</button>
        </div>
      </Dialog>
      {ConfirmDialog}
    </div>
  );
}
