"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  fetchWorkflowRuns,
  fetchWorkflowJobs,
  formatDuration,
  truncateMessage,
  timeAgo,
  getToken,
  STATUS_LABEL,
  type WorkflowRun,
  type WorkflowJob,
} from "@/lib/github-pipeline";

export default function DeployPage() {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [jobsMap, setJobsMap] = useState<Record<number, WorkflowJob[]>>({});
  const [loadingJobs, setLoadingJobs] = useState<number | null>(null);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const t = getToken();
      setToken(t);
      const { runs: data, total: count } = await fetchWorkflowRuns(t ?? undefined);
      setRuns(data);
      setTotal(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Auto refresh every 30s when any run is in_progress
    autoRef.current = setInterval(() => {
      const hasRunning = runs.some((r) => r.status === "in_progress");
      if (hasRunning) load();
    }, 30000);
    return () => {
      if (autoRef.current) clearInterval(autoRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update auto-refresh when runs change
  useEffect(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(() => {
      const knownIds = new Set(runs.filter((r) => r.status === "in_progress" || r.status === "queued").map((r) => r.id));
      if (knownIds.size > 0) load();
    }, 30000);
    return () => {
      if (autoRef.current) clearInterval(autoRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs.length > 0]);

  const handleToggleJobs = async (runId: number) => {
    if (expandedId === runId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(runId);
    if (!jobsMap[runId]) {
      setLoadingJobs(runId);
      try {
        const t = getToken();
        const jobs = await fetchWorkflowJobs(runId, t ?? undefined);
        setJobsMap((prev) => ({ ...prev, [runId]: jobs }));
      } catch {
        // ignore
      } finally {
        setLoadingJobs(null);
      }
    }
  };

  const successCount = runs.filter((r) => r.conclusion === "success").length;
  const failCount = runs.filter((r) => r.conclusion === "failure").length;
  const runningCount = runs.filter((r) => r.status === "in_progress").length;
  const cancelledCount = runs.filter((r) => r.conclusion === "cancelled").length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Deploy Pipeline</h1>
        <div className="flex items-center gap-2">
          {!token && (
            <span className="text-[10px] text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-lg">
              匿名模式（限速 60次/h）
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 text-sm font-bold rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                刷新中…
              </span>
            ) : (
              "刷新"
            )}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "总部署", value: total, color: "text-slate-700 dark:text-slate-200" },
          { label: "成功", value: successCount, color: "text-emerald-500" },
          { label: "失败", value: failCount, color: "text-red-500" },
          { label: "进行中", value: runningCount, color: "text-amber-500" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4 text-center">
            <div className={`text-2xl font-black ${s.color}`}>
              {loading ? (
                <span className="inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                s.value
              )}
            </div>
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Token hint */}
      {!token && (
        <div className="glass-card p-3 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <span>⚠️ 未配置 GitHub Token，匿名访问 GitHub API（速率限制 60 次/小时）。</span>
          </div>
          <Link
            href="/admin"
            className="text-xs font-bold text-indigo-500 hover:text-indigo-600 transition-colors shrink-0"
          >
            去 Dashboard 配置 →
          </Link>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-card p-4 mb-6 text-sm text-red-500">
          ✗ {error}
          <button onClick={load} className="ml-3 text-indigo-500 hover:text-indigo-600 underline">
            重试
          </button>
        </div>
      )}

      {/* Run list */}
      {loading && runs.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : runs.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-slate-400">暂无部署记录</div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const open = expandedId === run.id;
            return (
            <div
              key={run.id}
              onClick={() => handleToggleJobs(run.id)}
              className="group relative rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.005] cursor-pointer"
            >
              {/* Run row */}
              <div className="p-4 flex items-center gap-4">
                <StatusIcon status={run.status} conclusion={run.conclusion} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{run.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-400 font-mono">
                      #{run.run_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                    <span className="font-mono text-indigo-500 dark:text-indigo-400">{run.head_branch}</span>
                    {run.head_commit && (
                      <span className="truncate">&mdash; {truncateMessage(run.head_commit.message)}</span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {run.run_started_at ? formatDuration(run.run_started_at, run.updated_at) : "-"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{timeAgo(run.created_at)}</div>
                </div>

                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Expanded jobs */}
              <div className={`grid transition-all duration-500 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="overflow-hidden min-h-0">
                  <div className="border-t border-slate-200/50 dark:border-slate-700/50 mx-4" />
                  <div className="p-4 pt-3 space-y-3">
                  {loadingJobs === run.id ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : jobsMap[run.id]?.length > 0 ? (
                    jobsMap[run.id].map((job) => (
                      <div key={job.id}>
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                          <JobStatusIcon status={job.status} conclusion={job.conclusion} />
                          {job.name}
                          <span className="text-xs font-normal text-slate-400 font-mono">
                            {job.started_at ? formatDuration(job.started_at, job.completed_at) : ""}
                          </span>
                        </div>
                        {job.steps.length > 0 && (
                          <div className="ml-5 mt-1.5 space-y-0.5">
                            {job.steps.map((step) => (
                              <div key={step.number} className="flex items-center gap-2 text-xs text-slate-400">
                                <StepStatusIcon status={step.status} conclusion={step.conclusion} />
                                <span>{step.name}</span>
                                {step.started_at && (
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {formatDuration(step.started_at, step.completed_at)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 text-center py-2">无 Job 详情</div>
                  )}

                  {/* Link to GitHub */}
                  <a
                    href={run.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    在 GitHub 上查看
                  </a>
                </div>
                </div>
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Status Icons ─── */

function StatusIcon({ status, conclusion }: { status: string; conclusion: string | null }) {
  if (status === "in_progress") return <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse shrink-0" title="进行中" />;
  if (status === "queued") return <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" title="排队中" />;
  if (conclusion === "success") return <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" title="成功" />;
  if (conclusion === "failure") return <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" title="失败" />;
  if (conclusion === "cancelled") return <div className="w-3 h-3 rounded-full bg-slate-400 shrink-0" title="已取消" />;
  return <div className="w-3 h-3 rounded-full bg-slate-300 shrink-0" title={conclusion ?? status} />;
}

function JobStatusIcon({ status, conclusion }: { status: string; conclusion: string | null }) {
  if (status === "in_progress") return <span className="text-amber-400">⟳</span>;
  if (conclusion === "success") return <span className="text-emerald-500">✓</span>;
  if (conclusion === "failure") return <span className="text-red-500">✗</span>;
  if (conclusion === "cancelled") return <span className="text-slate-400">—</span>;
  return <span className="text-slate-300">○</span>;
}

function StepStatusIcon({ status, conclusion }: { status: string; conclusion: string | null }) {
  if (status === "in_progress") return <span className="text-amber-400">⟳</span>;
  if (conclusion === "success") return <span className="text-emerald-500">✓</span>;
  if (conclusion === "failure") return <span className="text-red-500">✗</span>;
  if (conclusion === "cancelled") return <span className="text-slate-400">—</span>;
  if (status === "queued") return <span className="text-slate-300">○</span>;
  return <span className="text-slate-300">○</span>;
}
