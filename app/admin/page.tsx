"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { DashboardVO } from "@/lib/types";
import type { MediaWithRef } from "@/lib/api/media";
import { get } from "@/lib/api/dashboard";
import { getArticleList } from "@/lib/api/op";
import { siteConfig } from "@/lib/siteConfig";
import { syncJson, syncMedia, syncMusic, generateSyncZip, type SyncProgress } from "@/lib/github-sync";
import { scanMediaWithRefs, remove as deleteMedia } from "@/lib/api/media";

const STORAGE_KEY = "github_token";

interface SyncState {
  syncing: boolean;
  progress: SyncProgress | null;
  logs: string[];
  result: "success" | "error" | null;
}

function SyncPanel({ label, syncing, progress, logs, result, onSync }: {
  label: string;
  syncing: boolean;
  progress: SyncProgress | null;
  logs: string[];
  result: "success" | "error" | null;
  onSync: () => void;
}) {
  return (
    <div className="border-t border-slate-200 dark:border-slate-700 pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-3">
        <button onClick={onSync} disabled={syncing}
          className="px-4 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white disabled:opacity-50 transition-all"
        >
          {syncing ? "Syncing..." : `Sync ${label}`}
        </button>
        {progress && (
          <span className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">{progress.message}</span>
        )}
      </div>
      {logs.length > 0 && (
        <div className="mt-2 max-h-40 overflow-y-auto bg-slate-900/80 rounded-lg p-2 text-[10px] font-mono leading-relaxed">
          {logs.map((line, i) => (
            <div key={i} className={`${line.includes("OK") ? "text-emerald-400" : line.includes("FAIL") ? "text-red-400" : "text-slate-300"}`}>
              {line}
            </div>
          ))}
        </div>
      )}
      {result === "success" && <p className="text-xs text-emerald-500 font-medium mt-1">✓ Sync complete!</p>}
      {result === "error" && progress && <p className="text-xs text-red-400 font-medium mt-1">✗ {progress.message}</p>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [dash, setDash] = useState<DashboardVO | null>(null);
  const [literatureCount, setLiteratureCount] = useState<number | null>(null);
  const [workerCommentCount, setWorkerCommentCount] = useState<number | null>(null);
  const [token, setToken] = useState("");
  const [savedToken, setSavedToken] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [savedAdminToken, setSavedAdminToken] = useState("");
  const [showAdminTokenInput, setShowAdminTokenInput] = useState(false);
  const [jsonSync, setJsonSync] = useState<SyncState>({ syncing: false, progress: null, logs: [], result: null });
  const [mediaSync, setMediaSync] = useState<SyncState>({ syncing: false, progress: null, logs: [], result: null });
  const [musicSync, setMusicSync] = useState<SyncState>({ syncing: false, progress: null, logs: [], result: null });
  const [manualState, setManualState] = useState({ generating: false, progress: null as SyncProgress | null, logs: [] as string[] });
  const [cleanupState, setCleanupState] = useState({ scanning: false, deleting: false, items: [] as MediaWithRef[], totalMedia: 0, orphanCount: 0, logs: [] as string[] });
  const [showTokenInput, setShowTokenInput] = useState(false);

  useEffect(() => {
    get().then(setDash).catch(() => { });
    getArticleList().then(d => {
      const total = d.rows.reduce((sum, t) => sum + t.articles.length, 0);
      setLiteratureCount(total);
    }).catch(() => { });
    fetch(`https://${siteConfig.workerApi}/api/comment/stats`)
      .then(r => r.json())
      .then(json => { if (json.code === 1) setWorkerCommentCount(json.data.totalComments); })
      .catch(() => {});
    const stored = localStorage.getItem(STORAGE_KEY) || "";
    setSavedToken(stored);
    const storedAdmin = localStorage.getItem("admin_token") || "";
    setSavedAdminToken(storedAdmin);
  }, []);

  const handleSaveToken = () => {
    localStorage.setItem(STORAGE_KEY, token);
    setSavedToken(token);
    setToken("");
    setShowTokenInput(false);
  };

  const handleClearToken = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedToken("");
  };

  const handleSaveAdminToken = () => {
    localStorage.setItem("admin_token", adminToken);
    setSavedAdminToken(adminToken);
    setAdminToken("");
    setShowAdminTokenInput(false);
  };

  const handleClearAdminToken = () => {
    localStorage.removeItem("admin_token");
    setSavedAdminToken("");
  };

  const adminMasked = savedAdminToken.length > 8
    ? savedAdminToken.slice(0, 4) + "****" + savedAdminToken.slice(-4)
    : "";

  const handleJsonSync = async () => {
    if (!savedToken) return;
    setJsonSync({ syncing: true, progress: null, logs: [], result: null });
    const res = await syncJson(savedToken, (p) => {
      setJsonSync((prev) => ({
        ...prev,
        progress: p,
        logs: p.log ? [...prev.logs, p.log] : prev.logs,
      }));
    });
    setJsonSync((prev) => ({
      ...prev,
      syncing: false,
      result: res.success ? "success" : "error",
      logs: [...prev.logs, res.success ? "✓ Sync complete!" : "✗ Sync failed!"],
    }));
  };

  const handleMediaSync = async () => {
    if (!savedToken) return;
    setMediaSync({ syncing: true, progress: null, logs: [], result: null });
    const res = await syncMedia(savedToken, (p) => {
      setMediaSync((prev) => ({
        ...prev,
        progress: p,
        logs: p.log ? [...prev.logs, p.log] : prev.logs,
      }));
    });
    setMediaSync((prev) => ({
      ...prev,
      syncing: false,
      result: res.success ? "success" : "error",
      logs: [...prev.logs, res.success ? "✓ Sync complete!" : "✗ Sync failed!"],
    }));
  };

  const handleMusicSync = async () => {
    if (!savedToken) return;
    setMusicSync({ syncing: true, progress: null, logs: [], result: null });
    const res = await syncMusic(savedToken, (p) => {
      setMusicSync((prev) => ({
        ...prev,
        progress: p,
        logs: p.log ? [...prev.logs, p.log] : prev.logs,
      }));
    });
    setMusicSync((prev) => ({
      ...prev,
      syncing: false,
      result: res.success ? "success" : "error",
      logs: [...prev.logs, res.success ? "✓ Sync complete!" : "✗ Sync failed!"],
    }));
  };

  const handleManualSync = async () => {
    setManualState({ generating: true, progress: null, logs: [] });
    try {
      const { blob, name, batContent } = await generateSyncZip((p) => {
        setManualState((prev) => ({
          ...prev,
          progress: p,
          logs: p.log ? [...prev.logs, p.log] : prev.logs,
        }));
      }, savedToken);

      // Download ZIP
      const zipUrl = URL.createObjectURL(blob);
      const zipLink = document.createElement("a");
      zipLink.href = zipUrl;
      zipLink.download = name;
      zipLink.click();
      URL.revokeObjectURL(zipUrl);

      // Download BAT
      const batBlob = new Blob([batContent], { type: "text/plain;charset=utf-8" });
      const batUrl = URL.createObjectURL(batBlob);
      const batLink = document.createElement("a");
      batLink.href = batUrl;
      batLink.download = "sync.bat";
      batLink.click();
      URL.revokeObjectURL(batUrl);

      setManualState((prev) => ({
        ...prev,
        generating: false,
        logs: [...prev.logs, `✓ ${name} 已下载`],
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setManualState((prev) => ({
        ...prev,
        generating: false,
        progress: { stage: "error", message: msg },
        logs: [...prev.logs, `✗ ${msg}`],
      }));
    }
  };

  const handleScanOrphans = async () => {
    setCleanupState((prev) => ({ ...prev, scanning: true, logs: ["Scanning for orphan media..."], items: [], totalMedia: 0, orphanCount: 0 }));
    try {
      const { items, totalMedia, orphanCount } = await scanMediaWithRefs();
      const sorted = [...items].sort((a, b) => (a.refs.length === 0 ? -1 : 0) - (b.refs.length === 0 ? -1 : 0));
      setCleanupState((prev) => ({
        ...prev,
        scanning: false,
        items: sorted,
        totalMedia,
        orphanCount,
        logs: [
          ...prev.logs,
          `Total media: ${totalMedia}`,
          `Referenced: ${totalMedia - orphanCount}, Orphans: ${orphanCount}`,
        ],
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setCleanupState((prev) => ({ ...prev, scanning: false, logs: [...prev.logs, `✗ ${msg}`] }));
    }
  };

  const handleDeleteOrphans = async () => {
    const orphans = cleanupState.items.filter((i) => i.refs.length === 0);
    setCleanupState((prev) => ({ ...prev, deleting: true, logs: [...prev.logs, `Deleting ${orphans.length} orphans...`] }));
    let ok = 0, fail = 0;
    for (const item of orphans) {
      const m = item.media;
      try {
        await deleteMedia(m.id!);
        ok++;
        setCleanupState((prev) => ({ ...prev, logs: [...prev.logs, `✓ Deleted #${m.id} ${m.originalFilename || m.fileUrl}`] }));
      } catch {
        fail++;
        setCleanupState((prev) => ({ ...prev, logs: [...prev.logs, `✗ Failed #${m.id}`] }));
      }
    }
    setCleanupState((prev) => ({ ...prev, deleting: false, items: [], totalMedia: 0, orphanCount: 0, logs: [...prev.logs, ok > 0 ? `✓ Done: ${ok} deleted, ${fail} failed` : "✗ Nothing deleted"] }));
  };

  // Mask token for display
  const masked = savedToken.length > 8
    ? savedToken.slice(0, 4) + "****" + savedToken.slice(-4)
    : "";

  if (!dash) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {[
          { label: "Articles", value: dash.articleCount, href: "/admin/article", color: "text-indigo-500" },
          { label: "Literature", value: literatureCount ?? 0, href: "/literature", color: "text-emerald-500" },
          { label: "Projects", value: dash.projectCount, href: "/admin/project", color: "text-purple-500" },
          { label: "Skills", value: dash.skillCount, href: "/admin/skill", color: "text-pink-500" },
          { label: "Comments", value: workerCommentCount ?? dash.commentCount, href: "#", color: "text-emerald-500" },
          { label: "Total Views", value: dash.totalViews, href: "#", color: "text-amber-500" },
          { label: "Timeline", value: dash.timelineCount, href: "/admin/timeline", color: "text-cyan-500" },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="glass-card p-4 hover:scale-[1.02] transition-transform">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{s.label}</div>
          </Link>
        ))}
      </div>

      <h2 className="text-lg font-bold mt-10 mb-4 text-slate-700 dark:text-slate-300">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "New Article", href: "/admin/article/new" },
          { label: "New Project", href: "/admin/project/new" },
          { label: "Upload Media", href: "/admin/media" },
          { label: "Edit About", href: "/admin/about" },
        ].map((a) => (
          <Link key={a.label} href={a.href} className="glass-card p-4 text-center text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-500 transition-colors">
            {a.label}
          </Link>
        ))}
      </div>

      {/* Admin Token */}
      <h2 className="text-lg font-bold mt-10 mb-4 text-slate-700 dark:text-slate-300">
        Admin Token
      </h2>
      <div className="glass-card p-5">
        {!savedAdminToken || showAdminTokenInput ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter the Worker ADMIN_TOKEN to access management APIs (email, purge, etc.).
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                placeholder="ADMIN_TOKEN..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleSaveAdminToken}
                disabled={!adminToken}
                className="px-4 py-2 text-sm font-bold rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 transition-colors"
              >
                Save
              </button>
            </div>
            {savedAdminToken && (
              <button onClick={() => setShowAdminTokenInput(false)} className="text-xs text-slate-400 hover:text-slate-600 self-start">
                Cancel
              </button>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-500 dark:text-slate-400">Admin Token:</span>
              <code className="text-xs text-slate-600 dark:text-slate-300">{adminMasked}</code>
              <button
                onClick={() => setShowAdminTokenInput(true)}
                className="text-xs text-indigo-500 hover:text-indigo-600"
              >
                修改
              </button>
              <button
                onClick={handleClearAdminToken}
                className="text-xs text-red-400 hover:text-red-500"
              >
                移除
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { label: "邮件列表", path: "GET /api/email/list" },
                { label: "邮件详情", path: "GET /api/email/detail" },
                { label: "删除邮件", path: "DELETE /api/email/delete" },
                { label: "发送邮件", path: "POST /api/email/send" },
                { label: "转发地址", path: "GET /api/email/forward" },
                { label: "数据同步", path: "GET /api/sync/*" },
              ].map((api) => (
                <span key={api.path} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="text-emerald-500">✓</span>
                  {api.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sync to GitHub */}
      <h2 className="text-lg font-bold mt-10 mb-4 text-slate-700 dark:text-slate-300">
        Sync to GitHub
      </h2>
      <div className="glass-card p-5">
        {!savedToken || showTokenInput ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter a GitHub Personal Access Token with <code className="text-indigo-500">Contents: write</code> scope for <code className="text-indigo-500">{siteConfig.repo}</code>.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleSaveToken}
                disabled={!token}
                className="px-4 py-2 text-sm font-bold rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 transition-colors"
              >
                Save
              </button>
            </div>
            {savedToken && (
              <button onClick={() => setShowTokenInput(false)} className="text-xs text-slate-400 hover:text-slate-600 self-start">
                Cancel
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-500 dark:text-slate-400">Token:</span>
              <code className="text-xs text-slate-600 dark:text-slate-300">{masked}</code>
              <button
                onClick={() => setShowTokenInput(true)}
                className="text-xs text-indigo-500 hover:text-indigo-600"
              >
                Change
              </button>
              <button
                onClick={handleClearToken}
                className="text-xs text-red-400 hover:text-red-500"
              >
                Remove
              </button>
            </div>

            <div className="flex flex-col gap-4 mt-2">
              <SyncPanel label="JSON Data" onSync={handleJsonSync} syncing={jsonSync.syncing} progress={jsonSync.progress} logs={jsonSync.logs} result={jsonSync.result} />
              <SyncPanel label="Media" onSync={handleMediaSync} syncing={mediaSync.syncing} progress={mediaSync.progress} logs={mediaSync.logs} result={mediaSync.result} />
              <SyncPanel label="Music" onSync={handleMusicSync} syncing={musicSync.syncing} progress={musicSync.progress} logs={musicSync.logs} result={musicSync.result} />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
              <div className="flex items-center gap-3">
                <button onClick={handleManualSync} disabled={manualState.generating}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white disabled:opacity-50 transition-all"
                >
                  {manualState.generating ? "Generating..." : "Manual Sync"}
                </button>
                {manualState.progress && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">{manualState.progress.message}</span>
                )}
              </div>
              {manualState.logs.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto bg-slate-900/80 rounded-lg p-2 text-[10px] font-mono leading-relaxed">
                  {manualState.logs.map((line, i) => (
                    <div key={i} className={`${line.startsWith("✓") ? "text-emerald-400" : line.startsWith("✗") ? "text-red-400" : "text-slate-300"}`}>{line}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Orphan Media Cleanup */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
              <div className="flex items-center gap-3">
                <button onClick={handleScanOrphans} disabled={cleanupState.scanning || cleanupState.deleting}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white disabled:opacity-50 transition-all"
                >
                  {cleanupState.scanning ? "Scanning..." : "Scan Orphan Media"}
                </button>
                {cleanupState.orphanCount > 0 && (
                  <button onClick={handleDeleteOrphans} disabled={cleanupState.deleting}
                    className="px-4 py-2 text-sm font-bold rounded-lg bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 transition-all"
                  >
                    {cleanupState.deleting ? "Deleting..." : `Delete ${cleanupState.orphanCount} Files`}
                  </button>
                )}
                {cleanupState.scanning && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">Scanning...</span>
                )}
              </div>
              {cleanupState.logs.length > 0 && (
                <div className="mt-3 space-y-3">
                  {/* Summary bar */}
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>Total: <strong>{cleanupState.totalMedia}</strong></span>
                    <span className="text-emerald-500">Referenced: <strong>{cleanupState.totalMedia - cleanupState.orphanCount}</strong></span>
                    <span className="text-red-400">Orphans: <strong>{cleanupState.orphanCount}</strong></span>
                  </div>

                  {/* Media list */}
                  {cleanupState.items.length > 0 && (
                    <div className="max-h-80 overflow-y-auto space-y-1.5">
                      {cleanupState.items.map((item) => {
                        const m = item.media;
                        const isOrphan = item.refs.length === 0;
                        return (
                          <div key={m.id} className="flex items-start gap-3 p-2 rounded-lg bg-slate-900/60 text-[11px]">
                            {/* Thumbnail */}
                            <div className="w-10 h-10 shrink-0 rounded overflow-hidden bg-slate-800">
                              {m.fileUrl?.match(/\.(png|jpe?g|gif|webp|svg)$/i) ? (
                                <img src={m.fileUrl} alt={`${m.originalFilename || '媒体'} 缩略图`} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-600 text-[10px]">FILE</div>
                              )}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="truncate text-slate-300">{m.originalFilename || m.fileUrl?.split("/").pop()}</div>
                              <div className="truncate text-slate-500">{m.fileUrl}</div>
                              {m.fileSize && <div className="text-slate-500">{(m.fileSize / 1024).toFixed(1)} KB</div>}
                              {/* Reference tags */}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {isOrphan ? (
                                  <span className="inline-block px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">Unreferenced</span>
                                ) : (
                                  item.refs.map((ref, ri) => (
                                    <span key={ri} className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                                      {ref.type === "article" ? "📄" : ref.type === "project" ? "🚀" : "ℹ️"} {ref.title}
                                      {ref.field === "coverImage" ? " (cover)" : ""}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Log console */}
                  <div className="max-h-32 overflow-y-auto bg-slate-900/80 rounded-lg p-2 text-[10px] font-mono leading-relaxed">
                    {cleanupState.logs.map((line, i) => (
                      <div key={i} className={`${line.startsWith("✓") ? "text-emerald-400" : line.startsWith("✗") ? "text-red-400" : "text-slate-300"}`}>{line}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
