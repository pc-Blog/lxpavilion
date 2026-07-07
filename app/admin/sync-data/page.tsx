"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/axios";

interface SyncStatus {
  [table: string]: string | null;
}

interface TableData {
  total: number;
  rows: Record<string, unknown>[];
}

const TABLE_DEFS: Record<string, { label: string; pageKey: string; columns: string[] }> = {
  emails:     { label: "邮件归档",     pageKey: "email",     columns: ["id", "fromAddr", "subject", "createdAt"] },
  subscribers: { label: "邮件订阅者",   pageKey: "subscriber", columns: ["id", "email", "groupName", "createdAt"] },
  reactions:  { label: "评论反应",     pageKey: "reaction",  columns: ["id", "subjectId", "userId", "reaction", "createdAt"] },
  upvotes:    { label: "评论点赞",     pageKey: "upvote",    columns: ["id", "subjectId", "userId", "createdAt"] },
  "push-logs":{ label: "推送记录",     pageKey: "push-log",  columns: ["id", "pushedAt", "articleCount", "groupName", "status"] },
  users:      { label: "用户",         pageKey: "user",      columns: ["id", "username", "nickname", "email", "githubId", "createTime"] },
};

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SyncDataPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [tables, setTables] = useState<Record<string, TableData | null>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const data: SyncStatus = await api.get("/sync/status") as unknown as SyncStatus;
      setStatus(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([loadStatus(), loadTable()]).then(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTable = async (table?: string) => {
    const targets = table ? [table] : Object.keys(TABLE_DEFS);
    const results: Record<string, TableData | null> = {};
    await Promise.all(targets.map(async (key) => {
      const def = TABLE_DEFS[key];
      if (!def) return;
      try {
        const url = def.pageKey === "user" ? "/user/page" : `/sync-data/${def.pageKey}/page`;
      const data: TableData = await api.post(url, { pageNum: 1, pageSize: 20 }) as unknown as TableData;
        results[key] = data;
      } catch { results[key] = null; }
    }));
    setTables((prev) => ({ ...prev, ...results }));
  };

  const handleSync = async (overwrite = false) => {
    setSyncing(true);
    setResult(null);
    try {
      const res: Record<string, { data: { table: string; fetched: number } }> = await api.post(`/sync/all${overwrite ? "?overwrite=true" : ""}`) as unknown as Record<string, { data: { table: string; fetched: number } }>;
      const parts = Object.values(res).map((v) => `${v.data.table}: ${v.data.fetched}条`);
      setResult(`✅ 同步完成 — ${parts.join(" | ")}`);
      loadStatus();
      loadTable();
    } catch {
      setResult("❌ 同步失败");
    } finally {
      setSyncing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStatus(), loadTable()]);
    setRefreshing(false);
  };

  const toggleExpand = (key: string) => {
    setExpanded(expanded === key ? null : key);
  };

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-6">数据同步</h1>

      {/* 同步按钮 */}
      <div className="flex gap-3 mb-6">
        <button onClick={() => handleSync(false)} disabled={syncing}
          className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
          {syncing && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {syncing ? "同步中..." : "增量同步"}
        </button>
        <button onClick={() => handleSync(true)} disabled={syncing}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2">
          {syncing && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {syncing ? "同步中..." : "全量覆盖"}
        </button>
        <button onClick={handleRefresh} disabled={refreshing}
          className="px-5 py-2.5 bg-white/40 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-xl border border-white/40 dark:border-white/10 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors disabled:opacity-50 flex items-center gap-2">
          <svg className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? "刷新中..." : "刷新"}
        </button>
      </div>

      {result && (
        <div className="glass-card p-4 mb-6 text-sm text-slate-700 dark:text-slate-200">{result}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(TABLE_DEFS).map(([key, def]) => {
            const data = tables[key];
            const isOpen = expanded === key;
            return (
              <div key={key} className="glass-card overflow-hidden">
                <button onClick={() => toggleExpand(key)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/20 dark:hover:bg-slate-700/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{def.label}</span>
                    <span className="text-[11px] text-slate-400">
                      {data ? `${data.total} 条` : "—"}
                      {status?.[key] ? ` · 上次同步: ${formatTime(status[key]!)}` : " · 未同步"}
                    </span>
                  </div>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-200/50 dark:border-slate-700/50 overflow-x-auto">
                    {data && data.rows.length > 0 ? (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
                            {def.columns.map((col) => (
                              <th key={col} className="px-4 py-2 text-left font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                          {data.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-white/20 dark:hover:bg-slate-700/20">
                              {def.columns.map((col) => (
                                <td key={col} className="px-4 py-2 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                                  {col.toLowerCase().includes("time") || col.toLowerCase().includes("at") ? formatTime(String(row[col] ?? "")) : String(row[col] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="px-5 py-4 text-xs text-slate-400 text-center">暂无数据</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
