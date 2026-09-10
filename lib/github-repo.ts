import type { GitHubRepoInfo } from "@/lib/types";

const CACHE_TTL = 60 * 60 * 1000; // 1 小时
const CACHE_PREFIX = "gh-repo:";

/** 解析 GitHub 仓库地址 → { owner, repo }；支持 https 与 git@ssh 形式 */
export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    if (url.startsWith("git@github.com:")) {
      const parts = url.slice("git@github.com:".length).replace(/\.git$/, "").split("/");
      if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
      return null;
    }
    const u = new URL(url);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

/** 从 URL 派生展示名（repoInfo 不可用时的降级） */
export function repoLabel(url: string): string {
  const parsed = parseRepoUrl(url);
  return parsed ? `${parsed.owner}/${parsed.repo}` : url || "";
}

const inflight = new Map<string, Promise<GitHubRepoInfo | null>>();

/**
 * 纯前端获取 GitHub 仓库信息（name / description / star / fork）。
 * 策略：localStorage 缓存（TTL 1h）→ 飞行中请求去重 → GitHub 公开 API（如已登录可带 PAT 提额）。
 */
export async function fetchRepoInfo(githubUrl: string): Promise<GitHubRepoInfo | null> {
  const parsed = parseRepoUrl(githubUrl);
  if (!parsed) return null;
  const key = `${CACHE_PREFIX}${parsed.owner}/${parsed.repo}`;

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const item = JSON.parse(raw) as { t: number; d: GitHubRepoInfo };
        if (Date.now() - item.t < CACHE_TTL) return item.d;
      }
    } catch { /* ignore */ }
  }

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async (): Promise<GitHubRepoInfo | null> => {
    try {
      const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("github_token") : null;
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch { /* ignore */ }
      const res = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, { headers });
      if (!res.ok) return null;
      const d = await res.json();
      const info: GitHubRepoInfo = {
        name: d.name ?? parsed.repo,
        description: d.description ?? "",
        stargazersCount: d.stargazers_count ?? 0,
        forksCount: d.forks_count ?? 0,
        language: d.language ?? null,
        pushedAt: d.pushed_at ?? null,
      };
      if (typeof window !== "undefined") {
        try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: info })); } catch { /* ignore */ }
      }
      return info;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}