// GitHub Commit 数据获取层
import { siteConfig } from "./siteConfig";

const GITHUB_API = `https://api.github.com/repos/${siteConfig.repo}`;

export interface CommitAuthor {
  name: string;
  date: string;
}

export interface CommitData {
  sha: string;
  html_url: string;
  author: CommitAuthor;
  message: string;
}

export interface CommitStats {
  additions: number;
  deletions: number;
  total: number;
}

export interface ApiResponse {
  commits: CommitData[];
  total: number;
  hasMore: boolean;
}

export async function fetchCommitStats(sha: string): Promise<CommitStats | null> {
  try {
    const res = await fetch(`${GITHUB_API}/commits/${sha}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.stats ?? null;
  } catch {
    return null;
  }
}

export function parseCommitMessage(message: string): {
  subject: string;
  body: string;
} {
  const idx = message.indexOf("\n");
  if (idx === -1) return { subject: message.trim(), body: "" };
  return {
    subject: message.slice(0, idx).trim(),
    body: message.slice(idx + 1).trim(),
  };
}

export function getTypeInfo(
  subject: string
): { type: string; color: string; bg: string } {
  const typeMap: Record<string, { color: string; bg: string }> = {
    feat: { color: "#3b82f6", bg: "bg-blue-500/10" },
    fix: { color: "#f59e0b", bg: "bg-amber-500/10" },
    refactor: { color: "#8b5cf6", bg: "bg-purple-500/10" },
    perf: { color: "#10b981", bg: "bg-emerald-500/10" },
    style: { color: "#ec4899", bg: "bg-pink-500/10" },
    docs: { color: "#14b8a6", bg: "bg-teal-500/10" },
    chore: { color: "#64748b", bg: "bg-slate-500/10" },
    revert: { color: "#ef4444", bg: "bg-red-500/10" },
  };
  const match = subject.match(/^(\w+)\(/);
  const t = match?.[1] || "feat";
  return { type: t, ...(typeMap[t] || typeMap.feat) };
}

export function getScope(subject: string): string {
  const match = subject.match(/\(([^)]+)\)/);
  return match?.[1] || "";
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
}

export function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${y} 年 ${parseInt(m)} 月`;
}

const PER_PAGE = 30;

/** 通过 ?per_page=1 的 Link header 获取总提交数 */
export async function fetchTotalCommits(): Promise<number> {
  try {
    const res = await fetch(`${GITHUB_API}/commits?sha=master&per_page=1`, {
      next: { revalidate: 3600 },
    });
    const link = res.headers.get("link") || "";
    const match = link.match(/page=(\d+)>; rel="last"/);
    return match ? Number(match[1]) : 0;
  } catch {
    return 0;
  }
}

export async function fetchCommits(
  page = 1
): Promise<ApiResponse> {
  const url = `${GITHUB_API}/commits?sha=master&per_page=${PER_PAGE}&page=${page}`;
  const res = await fetch(url, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json();
  const linkHeader = res.headers.get("link") || "";
  const hasMore = linkHeader.includes('rel="next"');
  const total = data.length;

  const commits: CommitData[] = data.map((item: any) => ({
    sha: item.sha,
    html_url: item.html_url,
    author: {
      name: item.commit.author.name,
      date: item.commit.author.date,
    },
    message: item.commit.message,
  }));

  return { commits, total, hasMore };
}
