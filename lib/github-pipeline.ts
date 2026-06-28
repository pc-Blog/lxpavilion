const GH_API = "https://api.github.com";
const [OWNER, REPO] = ["pc-Blog", "next"] as const;

export interface WorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_commit: { message: string } | null;
  status: "queued" | "in_progress" | "completed";
  conclusion: "success" | "failure" | "cancelled" | "skipped" | null;
  created_at: string;
  updated_at: string;
  run_started_at: string | null;
  html_url: string;
  event: "push" | "pull_request" | "workflow_dispatch" | string;
  run_number: number;
  actor: { login: string; avatar_url: string } | null;
  workflow_id: number;
}

interface WorkflowRunsResponse {
  total_count: number;
  workflow_runs: WorkflowRun[];
}

export interface WorkflowJob {
  id: number;
  run_id: number;
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: string | null;
  started_at: string;
  completed_at: string | null;
  steps: {
    name: string;
    status: "queued" | "in_progress" | "completed";
    conclusion: string | null;
    number: number;
    started_at?: string;
    completed_at?: string;
  }[];
}

interface JobsResponse {
  total_count: number;
  jobs: WorkflowJob[];
}

async function gh<T>(url: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "blog-admin",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return res.json();
}

/** 获取最近 workflow runs */
export async function fetchWorkflowRuns(token?: string, perPage = 20): Promise<{
  runs: WorkflowRun[];
  total: number;
}> {
  const data = await gh<WorkflowRunsResponse>(
    `${GH_API}/repos/${OWNER}/${REPO}/actions/runs?per_page=${perPage}`,
    token,
  );
  return { runs: data.workflow_runs, total: data.total_count };
}

/** 获取指定 run 的 jobs */
export async function fetchWorkflowJobs(runId: number, token?: string): Promise<WorkflowJob[]> {
  const data = await gh<JobsResponse>(
    `${GH_API}/repos/${OWNER}/${REPO}/actions/runs/${runId}/jobs`,
    token,
  );
  return data.jobs;
}

/** 格式化持续时间 */
export function formatDuration(startStr: string, endStr?: string | null): string {
  const start = new Date(startStr).getTime();
  const end = endStr ? new Date(endStr).getTime() : Date.now();
  const diff = end - start;
  if (diff < 0) return "-";
  if (diff < 1000) return "<1s";
  if (diff < 60000) return `${Math.round(diff / 1000)}s`;
  const m = Math.floor(diff / 60000);
  const s = Math.round((diff % 60000) / 1000);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/** 截断提交信息 */
export function truncateMessage(msg: string, max = 60): string {
  return msg.length > max ? msg.slice(0, max) + "…" : msg;
}

/** 时间友好显示 */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

/** 获取 PAT（复用 GitHub Sync 的存储 key） */
export const STORAGE_KEY = "github_token";
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

/** 状态中文映射 */
export const STATUS_LABEL: Record<string, string> = {
  success: "成功",
  failure: "失败",
  cancelled: "已取消",
  skipped: "跳过",
  in_progress: "进行中",
  queued: "排队中",
};
