"use client";

import { useState, useEffect, useCallback } from "react";
import type { Timeline } from "@/lib/types";
import { getList, create, update, remove } from "@/lib/api/timeline";
import Tooltip from "@/app/_components/common/Tooltip";
import Dialog from "@/app/_components/common/Dialog";
import { showSuccessToast } from "@/lib/toast";
import { useConfirm } from "@/app/_components/common/ConfirmDialog";
import Pagination from "@/app/_components/common/Pagination";
import DatePicker from "@/app/_components/admin/DatePicker";

export default function AdminTimelinePage() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [items, setItems] = useState<Timeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");

  const refresh = useCallback(async (kw?: string, pn?: number, ps?: number) => {
    try { const d = await getList(kw || undefined, pn, ps); setItems(d.rows); setTotal(d.total); } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Debounced search (reset to page 1)
  useEffect(() => {
    setPageNum(1);
    const timer = setTimeout(() => refresh(keyword || undefined, 1, pageSize), 300);
    return () => clearTimeout(timer);
  }, [keyword, refresh, pageSize]);

  const openAdd = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setEventDate("");
    setDialogOpen(true);
  };

  const openEdit = (t: Timeline) => {
    setEditingId(t.id!);
    setTitle(t.title);
    setDescription(t.description || "");
    setEventDate(t.eventDate);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !eventDate.trim()) return;
    if (editingId) { await update({ id: editingId, title: title.trim(), description, eventDate }); showSuccessToast("Updated"); }
    else { await create({ title: title.trim(), description, eventDate }); showSuccessToast("Created"); }
    setDialogOpen(false);
    refresh(keyword || undefined, pageNum, pageSize);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm("Delete?"); if (!ok) return;
    await remove(id); showSuccessToast("Deleted");
    refresh(keyword || undefined, pageNum, pageSize);
  };

  if (loading) return <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mt-10" />;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Timeline</h1>

      {/* Search + Add */}
      <div className="flex gap-3 mb-6">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search by title or description..."
          className="glass-card !rounded-xl px-4 py-2.5 flex-1 text-sm outline-none bg-white/50 dark:bg-slate-800/50"
        />
        <button onClick={openAdd} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors">
          Add Event
        </button>
      </div>

      {/* Timeline list */}
      <div className="flex-1 overflow-auto flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className="glass-card px-4 py-3 flex items-center gap-4 group">
            <span className="text-xs text-slate-400 w-20">{t.eventDate}</span>
            <span className="flex-1 text-sm font-bold">{t.title}</span>
            <span className="text-xs text-slate-500 flex-1 truncate">{t.description}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Tooltip text="Edit">
                <button onClick={() => openEdit(t)} className="p-1 text-indigo-400 hover:text-indigo-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              </Tooltip>
              <Tooltip text="Delete">
                <button onClick={() => handleDelete(t.id!)} className="p-1 text-red-400 hover:text-red-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>

      <Pagination total={total} pageNum={pageNum} pageSize={pageSize} onChange={(pn) => { setPageNum(pn); refresh(keyword || undefined, pn, pageSize); }} onPageSizeChange={(ps) => { setPageSize(ps); setPageNum(1); refresh(keyword || undefined, 1, ps); }} />

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editingId ? "Edit Event" : "Add Event"}>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          placeholder="Title"
          className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50 mb-3"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50 mb-3"
        />
        <div className="mb-4">
          <DatePicker
            value={eventDate}
            onChange={setEventDate}
            placeholder="选择日期"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDialogOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors">Save</button>
        </div>
      </Dialog>
      {ConfirmDialog}
    </div>
  );
}
