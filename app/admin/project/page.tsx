"use client";

import { useState, useEffect, useCallback } from "react";
import type { Project, ProjectVO } from "@/lib/types";
import { getList, remove, create, update } from "@/lib/api/project";
import { repoLabel } from "@/lib/github-repo";
import Dialog from "@/app/_components/common/Dialog";
import Tooltip from "@/app/_components/common/Tooltip";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { useConfirm } from "@/app/_components/common/ConfirmDialog";
import Pagination from "@/app/_components/common/Pagination";

export default function AdminProjectPage() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [items, setItems] = useState<ProjectVO[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async (kw?: string, pn?: number, ps?: number) => {
    try {
      const d = await getList({ pageNum: pn || 1, pageSize: ps || 10, query: kw ? ({ githubUrl: kw } as Project) : undefined });
      setItems(d.rows);
      setTotal(d.total);
    } catch {}
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
    setGithubUrl("");
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (p: ProjectVO) => {
    setEditingId(p.id);
    setGithubUrl(p.githubUrl);
    setError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!githubUrl.trim()) { setError("GitHub 仓库地址不能为空"); return; }
    setError("");
    setSaving(true);
    try {
      const payload: Project = { githubUrl: githubUrl.trim() };
      if (editingId) { await update({ ...payload, id: editingId }); showSuccessToast("已更新"); }
      else { await create(payload); showSuccessToast("已创建"); }
      setDialogOpen(false);
      refresh(keyword || undefined, pageNum, pageSize);
    } catch { showErrorToast("保存失败"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm("确认删除？"); if (!ok) return;
    await remove(id); showSuccessToast("已删除");
    refresh(keyword || undefined, pageNum, pageSize);
  };

  if (loading) return <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mt-10" />;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Projects</h1>

      {/* Search + Add */}
      <div className="flex gap-3 mb-6">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search by GitHub URL..."
          className="glass-card !rounded-xl px-4 py-2.5 flex-1 text-sm outline-none bg-white/50 dark:bg-slate-800/50"
        />
        <button onClick={openAdd} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors">New Project</button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="flex flex-col gap-2">
          {items.map((p) => (
            <div key={p.id} className="glass-card px-4 py-3 flex items-center gap-4 group">
              <a href={p.githubUrl} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 block text-sm font-bold text-indigo-500 hover:text-indigo-600 transition-colors truncate">
                {repoLabel(p.githubUrl)}
              </a>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Tooltip text="Edit">
                  <button onClick={() => openEdit(p)} className="p-1 text-indigo-400 hover:text-indigo-600 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                </Tooltip>
                <Tooltip text="Delete">
                  <button onClick={() => handleDelete(p.id)} className="p-1 text-red-400 hover:text-red-600 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Pagination total={total} pageNum={pageNum} pageSize={pageSize} onChange={(pn) => { setPageNum(pn); refresh(keyword || undefined, pn, pageSize); }} onPageSizeChange={(ps) => { setPageSize(ps); setPageNum(1); refresh(keyword || undefined, 1, ps); }} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editingId ? "Edit Project" : "New Project"} size="lg">
        <div className="space-y-3">
          <input
            autoFocus
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="GitHub URL *"
            className="w-full glass-card !rounded-xl px-4 py-2.5 text-sm outline-none bg-white/50 dark:bg-slate-800/50"
          />
          {error && <p className="text-sm text-red-500 font-bold">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setDialogOpen(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors">Save</button>
        </div>
      </Dialog>
      {ConfirmDialog}
    </div>
  );
}