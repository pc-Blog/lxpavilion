import type { GitHubRepoInfo } from "@/lib/types";

const CACHE_TTL = 60 * 60 * 1000; // 1 小时
const INFO_PREFIX = "gh-repo:";
const LANG_PREFIX = "gh-lang:";

const inflight = new Map<string, Promise<unknown>>();

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

/** 主页地址规范化：无协议时补 https:// */
export function normalizeHomeUrl(homepage: string): string {
  return /^https?:\/\//i.test(homepage) ? homepage : `https://${homepage}`;
}

/** ISO 时间 → 相对时间（"3 分钟前 / 2 小时前 / 5 天前 / 4 个月前 / 1 年前"） */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} 个月前`;
  return `${Math.floor(mo / 12)} 年前`;
}

/** 常见语言配色（GitHub linguist 色板子集） */
export const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Java: "#b07219",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  PHP: "#4F5D95",
  Ruby: "#701516",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Vue: "#41b883",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Dart: "#00B4AB",
  SQL: "#e38c00",
  "Jupyter Notebook": "#DA5B0B",
  Markdown: "#083fa1",
  Dockerfile: "#384d54",
  "Objective-C": "#438eff",
  R: "#198CE7",
  Zig: "#ec915c",
  Lua: "#000080",
  Elixir: "#6e4a7e",
  Erlang: "#B83998",
  Haskell: "#5e5086",
  Perl: "#0298c3",
  Scala: "#c22d40",
  Julia: "#a270ba",
  Assembly: "#6E4C13",
  PowerShell: "#012456",
  YAML: "#cb171e",
  Makefile: "#427819",
  Fortran: "#4d41b1",
  Elm: "#60B5CC",
  Nix: "#7e7eff",
  Clojure: "#db5855",
  CoffeeScript: "#244776",
  Svelte: "#ff3e00",
  Solidity: "#AA6746",
  "Vue Component": "#41b883",
};
export const DEFAULT_LANGUAGE_COLOR = "#8b949e";

function readCache(key: string): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const item = JSON.parse(raw) as { t: number; d: unknown };
    if (Date.now() - item.t >= CACHE_TTL) return null;
    return item.d;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data }));
  } catch { /* ignore */ }
}

async function ghFetch(path: string): Promise<unknown | null> {
  try {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("github_token") : null;
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch { /* ignore */ }
    const res = await fetch(`https://api.github.com${path}`, { headers });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** 纯前端获取仓库信息（name/description/star/fork/topics/license/homepage…） */
export async function fetchRepoInfo(githubUrl: string): Promise<GitHubRepoInfo | null> {
  const parsed = parseRepoUrl(githubUrl);
  if (!parsed) return null;
  const key = `${INFO_PREFIX}${parsed.owner}/${parsed.repo}`;

  const cached = readCache(key) as GitHubRepoInfo | null;
  if (cached) return cached;

  const existing = inflight.get(key);
  if (existing) return existing as Promise<GitHubRepoInfo | null>;

  const p = (async (): Promise<GitHubRepoInfo | null> => {
    const d = await ghFetch(`/repos/${parsed.owner}/${parsed.repo}`);
    if (!d) return null;
    const r = d as Record<string, unknown>;
    const info: GitHubRepoInfo = {
      name: (r.name as string) ?? parsed.repo,
      description: (r.description as string) ?? "",
      stargazersCount: (r.stargazers_count as number) ?? 0,
      forksCount: (r.forks_count as number) ?? 0,
      language: (r.language as string | null) ?? null,
      pushedAt: (r.pushed_at as string | null) ?? null,
      createdAt: (r.created_at as string | null) ?? null,
      topics: Array.isArray(r.topics) ? (r.topics as string[]) : [],
      license: ((r.license as { spdx_id?: string } | null)?.spdx_id) || null,
      homepage: (r.homepage as string | null) || null,
      archived: !!r.archived,
    };
    writeCache(key, info);
    return info;
  })();

  inflight.set(key, p);
  try { return await p; } finally { inflight.delete(key); }
}

/** 纯前端获取仓库语言占比（字节数） */
export async function fetchRepoLanguages(githubUrl: string): Promise<Record<string, number> | null> {
  const parsed = parseRepoUrl(githubUrl);
  if (!parsed) return null;
  const key = `${LANG_PREFIX}${parsed.owner}/${parsed.repo}`;

  const cached = readCache(key) as Record<string, number> | null;
  if (cached) return cached;

  const existing = inflight.get(key);
  if (existing) return existing as Promise<Record<string, number> | null>;

  const p = (async (): Promise<Record<string, number> | null> => {
    const d = await ghFetch(`/repos/${parsed.owner}/${parsed.repo}/languages`);
    if (!d || typeof d !== "object") return null;
    const record = d as Record<string, number>;
    if (Object.keys(record).length === 0) return null;
    writeCache(key, record);
    return record;
  })();

  inflight.set(key, p);
  try { return await p; } finally { inflight.delete(key); }
}