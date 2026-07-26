"use client";

import type { Media, OpMusic } from "@/lib/types";
import { siteConfig } from "./siteConfig";

const GH_API = "https://api.github.com";
const [OWNER, REPO] = siteConfig.repo.split("/");
const BRANCH = "data";

export interface SyncProgress {
  stage: "collecting" | "blobs" | "tree" | "done" | "error";
  message: string;
  log?: string;
}

type ProgressCb = (p: SyncProgress) => void;

/** Decode base64 to UTF-8 string (browser-safe) */
function base64DecodeUtf8(base64: string): string {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

// GitHub API helper
async function gh(url: string, token: string, method = "GET", body?: unknown) {
  const label = `${method} ${url.replace(/token=.*/, "token=***")}`;
  console.log(`[GH] → ${label}`);
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const elapsed = (performance.now() - start).toFixed(0);
    if (!res.ok) {
      const text = await res.text();
      console.error(`[GH] ✗ ${label} (${elapsed}ms) → ${res.status}: ${text.slice(0, 300)}`);
      throw new Error(`GitHub API ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = await res.json();
    console.log(`[GH] ✓ ${label} (${elapsed}ms)`);
    return json;
  } catch (e) {
    const elapsed = (performance.now() - start).toFixed(0);
    if (e instanceof TypeError) {
      console.error(`[GH] ✗ ${label} (${elapsed}ms) → NETWORK/CORS ERROR:`, e);
    }
    throw e;
  }
}

// Media sync helpers
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mime: string; sizeMb: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching image: ${url}`);
  const blob = await res.blob();
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",", 2)[1] || "");
    };
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
  const sizeMb = (blob.size / 1024 / 1024).toFixed(1);
  return { base64, mime: blob.type, sizeMb };
}

function mimeToExt(mime?: string): string {
  if (!mime) return ".bin";
  // image/jpeg → .jpeg, image/svg+xml → .svg
  const subtype = mime.split("/")[1] || "";
  return "." + subtype.split("+")[0];
}

function extFromFilename(name?: string): string {
  if (!name) return ".bin";
  const i = name.lastIndexOf(".");
  return i !== -1 ? name.slice(i) : ".bin";
}

function replaceMediaUrls(
  content: string,
  mediaMap: Map<number, { newPath: string; originalUrl: string }>
): string {
  let result = content;
  for (const [, { newPath, originalUrl }] of mediaMap) {
    if (!originalUrl) continue;
    result = result.replaceAll(originalUrl, newPath);
    if (originalUrl.startsWith("http:") || originalUrl.startsWith("https:")) {
      const protoRel = originalUrl.replace(/^https?:/, "");
      result = result.replaceAll(protoRel, newPath);
    }
    const pathOnly = originalUrl.replace(/^https?:\/\/[^/]+/, "");
    if (pathOnly !== originalUrl && !pathOnly.startsWith("/api/media/file/")) {
      result = result.replaceAll(pathOnly, newPath);
    }
  }
  return result;
}

interface MediaItem {
  id: number;
  filename: string;
  base64?: string;
  updateTime?: string;
}

/** 从 data 分支读取 media-manifest.json */
async function getExistingMediaManifest(
  token: string
): Promise<Map<number, MediaItem>> {
  const result = new Map<number, MediaItem>();
  try {
    const ref = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`, token);
    const commit = await gh(ref.object.url, token);
    const tree = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/trees/${commit.tree.sha}?recursive=1`, token);
    const entry = (tree.tree || []).find((e: any) => e.path === "media-manifest.json");
    if (!entry) return result;
    const blob = await gh(entry.url, token);
    const list = JSON.parse(base64DecodeUtf8(blob.content)) as MediaItem[];
    for (const item of list) {
      if (item.id != null) result.set(item.id, item);
    }
  } catch (e) {
    console.error("[SYNC] Failed to read manifest:", e);
    /* no manifest yet */
  }
  return result;
}

async function collectMedia(
  apiBase: string,
  onProgress?: ProgressCb,
  existingManifest?: Map<number, MediaItem>
): Promise<{
  mediaItems: MediaItem[];
  mediaMap: Map<number, { newPath: string; originalUrl: string }>;
  deletedIds: number[];
}> {
  const mediaItems: MediaItem[] = [];
  const mediaMap = new Map<number, { newPath: string; originalUrl: string }>();
  const deletedIds: number[] = [];

  let mediaRows: Media[] = [];
  try {
    const res = await fetch(`${apiBase}/media/page`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageNum: 1, pageSize: 999 }),
    });
    const body = await res.json() as { code: number; data?: { rows?: Media[] } };
    mediaRows = body.data?.rows || [];
  } catch (e) {
    console.error("[SYNC] Failed to fetch media from API:", e);
    return { mediaItems, mediaMap, deletedIds };
  }

  // 检测已删除的文件
  if (existingManifest && existingManifest.size > 0) {
    const apiIds = new Set<number>();
    for (const m of mediaRows) { if (m.id != null) apiIds.add(m.id); }
    for (const [id] of existingManifest) {
      if (!apiIds.has(id)) deletedIds.push(id);
    }
  }

  // 只下载新增的文件（已有文件不变，因为没有更新功能）
  const toDownload = mediaRows.filter((media) => {
    if (media.id == null) return false;
    if (!existingManifest) return true;
    return !existingManifest.has(media.id);
  }).slice(0, 10);  // 每次最多同步 10 张

  onProgress?.({
    stage: "collecting",
    message: `API: ${mediaRows.length} files, need download: ${toDownload.length}${deletedIds.length > 0 ? `, delete: ${deletedIds.length}` : ""}`,
  });

  // 并行下载（5 个并发）
  const batchSize = 5;
  for (let i = 0; i < toDownload.length; i += batchSize) {
    const batch = toDownload.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(async (media) => {
        if (media.id == null) return;
        try {
          const url = media.fileUrl.startsWith("http")
            ? media.fileUrl
            : `${apiBase}${media.fileUrl}`;
          const { base64 } = await fetchImageAsBase64(url);
          const ext = extFromFilename(media.fileUrl) || ".bin";
          const filename = `${media.id}${ext}`;
          mediaItems.push({ id: media.id, filename, base64, updateTime: media.updateTime });
          mediaMap.set(media.id, { newPath: `/data/media/${filename}`, originalUrl: media.fileUrl });
        } catch (e) {
          console.error(`[SYNC] Failed to download media #${media.id}: ${media.fileUrl}`, e);
        }
      })
    );
    onProgress?.({ stage: "collecting", message: `Downloading... ${Math.min(i + batchSize, toDownload.length)}/${toDownload.length}` });
  }

  // 未变动的文件保留记录（不带 base64，不下载）
  if (existingManifest) {
    for (const media of mediaRows) {
      if (media.id == null) continue;
      if (mediaItems.some((m) => m.id === media.id)) continue;
      const prev = existingManifest.get(media.id);
      if (prev) {
        mediaItems.push({ id: media.id, filename: prev.filename, updateTime: media.updateTime });
      }
    }
  }

  return { mediaItems, mediaMap, deletedIds };
}

// ── Music sync ──────────────────────────────────────────────

interface MusicFile {
  path: string;
  content: string;
  originalUrl: string;
  newPath: string;
}

async function getExistingMusicManifest(token: string): Promise<Map<number, { id: number }>> {
  const result = new Map<number, { id: number }>();
  try {
    const ref = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`, token);
    const commit = await gh(ref.object.url, token);
    const tree = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/trees/${commit.tree.sha}?recursive=1`, token);
    const entry = (tree.tree || []).find((e: any) => e.path === "music-manifest.json");
    if (!entry) return result;
    const blob = await gh(entry.url, token);
    const list = JSON.parse(base64DecodeUtf8(blob.content)) as { id: number }[];
    for (const item of list) {
      if (item.id != null) result.set(item.id, item);
    }
  } catch (e) {
    console.error("[SYNC] Failed to read manifest:", e);
    /* no manifest yet */
  }
  return result;
}

async function collectMusic(
  apiBase: string,
  onProgress?: ProgressCb,
  existingManifest?: Map<number, { id: number }>
): Promise<{ musicData: unknown; audioFiles: MusicFile[]; deletedIds: number[] }> {
  const res = await fetch(`${apiBase}/op/music/page`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pageNum: 1, pageSize: 999 }),
  });
  const body = await res.json() as { code: number; data?: { total: number; rows: OpMusic[] } };
  const rows = body.data?.rows || [];

  // 检测已删除的曲目
  const deletedIds: number[] = [];
  if (existingManifest && existingManifest.size > 0) {
    const apiIds = new Set<number>();
    for (const t of rows) { if (t.id != null) apiIds.add(t.id); }
    for (const [id] of existingManifest) {
      if (!apiIds.has(id)) deletedIds.push(id);
    }
  }

  // 只下载新增的曲目，按文件大小从小到大排
  let toDownload = rows.filter((t) => {
    if (t.id == null) return false;
    if (!existingManifest) return true;
    return !existingManifest.has(t.id);
  });

  // 用 HEAD 请求获取文件大小
  if (toDownload.length > 0) {
    const sizes = await Promise.all(toDownload.map(async (t) => {
      try {
        const url = t.url?.startsWith("http") ? t.url : `${apiBase}${t.url}`;
        const resp = await fetch(url, { method: "HEAD" });
        return { id: t.id, size: Number(resp.headers.get("Content-Length") || 0) };
      } catch (e) { console.error("[SYNC] HEAD request failed for track size:", t.id, t.url, e); return { id: t.id, size: 0 }; }
    }));
    const sizeMap = new Map(sizes.map((s) => [s.id, s.size]));
    toDownload.sort((a, b) => (sizeMap.get(a.id) || 0) - (sizeMap.get(b.id) || 0));
    toDownload = toDownload.slice(0, 10); // 取最小的 10 首
  }

  if (toDownload.length === 0) {
    return { musicData: body.data, audioFiles: [], deletedIds };
  }

  onProgress?.({ stage: "collecting", message: `Found ${rows.length} tracks, new: ${toDownload.length}. Downloading...` });

  let dlCount = 0;
  const audioFiles: MusicFile[] = [];

  for (const track of toDownload) {
    if (track.id == null) continue;
    dlCount++;
    const trackNum = dlCount;

    if (track.url) {
      try {
        const url = track.url.startsWith("http") ? track.url : `${apiBase}${track.url}`;
        const { base64, sizeMb } = await fetchImageAsBase64(url);
        const audioExt = extFromFilename(track.url) || ".mp3";
        audioFiles.push({
          path: `music/${track.id}${audioExt}`,
          content: base64,
          originalUrl: track.url,
          newPath: `/data/music/${track.id}${audioExt}`,
        });
        onProgress?.({ stage: "collecting", message: "Downloading music...", log: `[audio #${trackNum}] ${track.title} (${sizeMb} MB)` });
      } catch (e) {
        console.error(`[SYNC] Failed to download audio #${track.id} ${track.title}:`, e);
      }
    }

    if (track.pictureUrl) {
      try {
        const url = track.pictureUrl.startsWith("http") ? track.pictureUrl : `${apiBase}${track.pictureUrl}`;
        const { base64, mime } = await fetchImageAsBase64(url);
        const ext = mimeToExt(mime) || ".png";
        const sizeKb = Math.round(base64.length * 3 / 4 / 1024);
        audioFiles.push({
          path: `music/${track.id}-cover${ext}`,
          content: base64,
          originalUrl: track.pictureUrl,
          newPath: `/data/music/${track.id}-cover${ext}`,
        });
        onProgress?.({ stage: "collecting", message: "Downloading music...", log: `[cover #${trackNum}] ${track.title} (${sizeKb} KB)` });
      } catch (e) {
        console.error(`[SYNC] Failed to download cover #${track.id} ${track.title}:`, e);
      }
    }
  }

  return { musicData: body.data, audioFiles, deletedIds };
}

// Collect data from Java backend (incremental — skips unchanged details)
async function collectAllData(ghToken?: string, existing?: Map<string, string>, onProgress?: ProgressCb): Promise<{ path: string; content: string }[]> {
  const base = `http://${siteConfig.backUrl}/api`;

  async function apiGet<T>(ep: string): Promise<T> {
    const res = await fetch(`${base}${ep}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} GET ${ep}`);
    const body = await res.json();
    if (body.code !== 1) throw new Error(body.message || `API error GET ${ep}`);
    return body.data as T;
  }

  async function apiPost<T, B>(ep: string, body: B): Promise<T> {
    const res = await fetch(`${base}${ep}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} POST ${ep}`);
    const json = await res.json();
    if (json.code !== 1) throw new Error(json.message || `API error POST ${ep}`);
    return json.data as T;
  }

  const PAGE = { pageNum: 1, pageSize: 100 };
  const files: { path: string; content: string }[] = [];

  const dash = await apiGet<Record<string, any>>("/dashboard");
  // 如果有 GitHub token，获取 GitHub 评论数覆盖 commentCount
  if (ghToken) {
    try {
      const res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ghToken}` },
        body: JSON.stringify({
          query: `query{repository(owner:"${OWNER}",name:"${REPO}"){discussions(first:50,categoryId:"${siteConfig.giscusCategoryId}"){nodes{comments{totalCount}}}}}`,
        }),
      });
      const json: any = await res.json();
      const nodes = json?.data?.repository?.discussions?.nodes;
      if (nodes) {
        dash.commentCount = nodes.reduce((s: number, n: any) => s + n.comments.totalCount, 0);
      }
    } catch (e) {
      console.error("[SYNC] GraphQL comment count failed:", e);
    }
  }
  files.push({ path: "dashboard.json", content: JSON.stringify(dash, null, 2) });

  const about = await apiGet<unknown>("/about");
  files.push({ path: "about.json", content: JSON.stringify(about, null, 2) });

  const cats = await apiPost<unknown, unknown>("/category/page", PAGE);
  files.push({ path: "categories.json", content: JSON.stringify(cats, null, 2) });

  const tags = await apiPost<unknown, unknown>("/tag/page", PAGE);
  files.push({ path: "tags.json", content: JSON.stringify(tags, null, 2) });

  const tl = await apiPost<unknown, unknown>("/timeline/page", PAGE);
  files.push({ path: "timeline.json", content: JSON.stringify(tl, null, 2) });

  const skills = await apiPost<unknown, unknown>("/skill/page", PAGE);
  files.push({ path: "skills.json", content: JSON.stringify(skills, null, 2) });

  const articleList = await apiPost<{ total: number; rows: { id: number }[] }, unknown>(
    "/article/public/page", PAGE
  );
  files.push({ path: "articles.json", content: JSON.stringify(articleList, null, 2) });
  for (const a of articleList.rows as { id: number; updateTime?: string }[]) {
    if (a.updateTime && existing) {
      const existingContent = existing.get(`articles/${a.id}.json`);
      if (existingContent) {
        try {
          const existingTime = JSON.parse(existingContent)?.updateTime;
          if (existingTime === a.updateTime) {
            files.push({ path: `articles/${a.id}.json`, content: existingContent });
            // 跳过，不输出日志
            continue;
          }
        } catch (e) {
          console.warn("[SYNC] Article incremental check failed, re-fetching:", e);
        }
      }
    }
    try {
      const detail = await apiGet<unknown>(`/article/public/${a.id}`);
      files.push({ path: `articles/${a.id}.json`, content: JSON.stringify(detail, null, 2) });
    } catch (e) {
      console.error(`[SYNC] Failed to fetch article #${a.id}:`, e);
    }
  }

  // 系列分组（从文章列表推算）
  {
    const parsed = JSON.parse(files.find(f => f.path === "articles.json")?.content || "{}");
    const rows = (parsed?.rows || []) as { series?: string; coverImage?: string; summary?: string }[];
    const seriesMap = new Map<string, { count: number; coverImage?: string; summary?: string }>();
    for (const a of rows) {
      if (a.series) {
        const existing = seriesMap.get(a.series);
        if (existing) {
          existing.count++;
          existing.coverImage = existing.coverImage || a.coverImage;
        } else {
          seriesMap.set(a.series, { count: 1, coverImage: a.coverImage, summary: a.summary });
        }
      }
    }
    const groups = Array.from(seriesMap.entries()).map(([series, info]) => ({
      series,
      count: info.count,
      coverImage: info.coverImage,
      summary: info.summary,
    }));
    if (groups.length > 0) {
      files.push({ path: "series-groups.json", content: JSON.stringify(groups, null, 2) });
    }
  }

  const projectList = await apiPost<{ total: number; rows: { id: number }[] }, unknown>(
    "/project/public/page", PAGE
  );
  files.push({ path: "projects.json", content: JSON.stringify(projectList, null, 2) });
  for (const p of projectList.rows as { id: number; updateTime?: string }[]) {
    if (p.updateTime && existing) {
      const existingContent = existing.get(`projects/${p.id}.json`);
      if (existingContent) {
        try {
          const existingTime = JSON.parse(existingContent)?.updateTime;
          if (existingTime === p.updateTime) {
            files.push({ path: `projects/${p.id}.json`, content: existingContent });
            // 跳过，不输出日志
            continue;
          }
        } catch (e) {
          console.warn("[SYNC] Project incremental check failed:", e);
        }
      }
    }
    try {
      const detail = await apiGet<unknown>(`/project/public/${p.id}`);
      files.push({ path: `projects/${p.id}.json`, content: JSON.stringify(detail, null, 2) });
    } catch (e) {
      console.error(`[SYNC] Failed to fetch project #${p.id}:`, e);
    }
  }

  try {
    const media = await apiPost<unknown, unknown>("/media/page", { pageNum: 1, pageSize: 999 });
    files.push({ path: "media.json", content: JSON.stringify(media, null, 2) });
  } catch (e) {
    console.error("[SYNC] Failed to fetch media.json:", e);
  }

  // 评论区已迁移至 GitHub Discussions (Giscus)，不再从 Java 后端同步

  // Album / Gallery data
  try {
    const albums = await apiGet<any[]>("/album/list");
    files.push({ path: "albums.json", content: JSON.stringify(albums, null, 2) });
    // Collect photos for each album
    for (const a of albums || []) {
      try {
        const photos = await apiGet<unknown>(`/photo/by-album/${a.id}`);
        files.push({ path: `albums/${a.id}.json`, content: JSON.stringify(photos, null, 2) });
      } catch (e) {
        console.error("[SYNC] Failed to fetch album photos:", e);
      }
    }
  } catch (e) {
    console.error("[SYNC] Failed to fetch albums:", e);
  }

  // Chatter / Moments data
  try {
    const chatters = await apiGet<unknown>("/chatter/list");
    files.push({ path: "chatters.json", content: JSON.stringify(chatters, null, 2) });
  } catch (e) {
    console.error("[SYNC] Failed to fetch chatters:", e);
  }

  // Friend links
  try {
    const friendLinks = await apiGet<unknown>("/friend-link/list");
    files.push({ path: "friendLinks.json", content: JSON.stringify(friendLinks, null, 2) });
  } catch (e) {
    console.error("[SYNC] Failed to fetch friend links:", e);
  }

  // Bookmarks
  try {
    const bookmarks = await apiGet<unknown>("/bookmark/list");
    files.push({ path: "bookmarks.json", content: JSON.stringify(bookmarks, null, 2) });
    const bookmarkCats = await apiGet<unknown>("/bookmark/category/tree");
    files.push({ path: "bookmarkCategories.json", content: JSON.stringify(bookmarkCats, null, 2) });
  } catch (e) {
    console.error("[SYNC] Failed to fetch bookmarks:", e);
  }

  // Op / Literature data
  try {
    const opArticles = await apiPost<unknown, unknown>("/op/article", {});
    files.push({ path: "op-articles.json", content: JSON.stringify(opArticles, null, 2) });
  } catch (e) {
    console.error("[SYNC] Failed to fetch op-articles:", e);
  }

  files.push({
    path: "index.json",
    content: JSON.stringify(
      ["dashboard", "about", "articles", "projects", "categories", "tags", "timeline", "skills", "media", "comments", "music", "op-articles", "albums", "friendLinks", "chatters", "bookmarks", "bookmarkCategories"],
      null, 2
    ),
  });

  // ── 替换所有 JSON 中的媒体 URL 为本地路径 ──
  try {
    const mediaRes = await apiPost<{ rows: { id: number; fileUrl: string; originalFilename?: string }[] }, unknown>(
      "/media/page", { pageNum: 1, pageSize: 999 }
    );
    const mediaMap = new Map<number, { newPath: string; originalUrl: string }>();
    for (const m of mediaRes.rows || []) {
      const ext = m.originalFilename?.includes(".") ? m.originalFilename.slice(m.originalFilename.lastIndexOf(".")) : ".bin";
      mediaMap.set(m.id, {
        newPath: `/data/media/${m.id}${ext}`,
        originalUrl: m.fileUrl,
      });
    }
    if (mediaMap.size > 0) {
      for (const f of files) {
        if (f.path.endsWith(".json")) {
          f.content = replaceMediaUrls(f.content, mediaMap);
        }
      }
    }
  } catch (e) {
    console.error("[SYNC] Failed to replace media URLs:", e);
  }

  return files;
}

export interface SyncResult {
  success: boolean;
  commitSha?: string;
  filesCount: number;
  error?: string;
}

// ── Generic partial sync (merges with existing tree) ──

interface SyncFile {
  path: string;
  content: string;
  encoding?: "utf-8" | "base64";
}

async function syncFiles(
  token: string,
  files: SyncFile[],
  message: string,
  onProgress?: ProgressCb,
  deletePaths?: string[]
): Promise<SyncResult> {
  onProgress?.({ stage: "blobs", message: "Connecting to GitHub..." });
  const ref = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`, token);
  const currentCommit = await gh(ref.object.url, token);
  const baseTreeSha: string = currentCommit.tree.sha;

  onProgress?.({ stage: "blobs", message: `Creating ${files.length} blobs...` });
  console.log(`[SYNC] syncFiles start: ${files.length} files, ${deletePaths?.length || 0} delete paths`);
  console.log(`[SYNC] Files to upload:`, files.map(f => ({ path: f.path, encoding: f.encoding, size: f.content.length })));
  const blobResults: { path: string; sha: string }[] = [];
  let failCount = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    try {
      const blob = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/blobs`, token, "POST", {
        content: f.content,
        encoding: f.encoding || "utf-8",
      });
      blobResults.push({ path: f.path, sha: blob.sha as string });
      onProgress?.({
        stage: "blobs",
        message: `Creating blobs (${i + 1}/${files.length})...`,
        log: `[${i + 1}/${files.length}] ${f.path} OK`,
      });
    } catch (e) {
      failCount++;
      const errMsg = e instanceof Error ? e.message.slice(0, 120) : "Unknown error";
      console.error(`[SYNC] Blob FAILED (${i + 1}/${files.length}): ${f.path}`, e);
      onProgress?.({
        stage: "blobs",
        message: `Creating blobs (${i + 1}/${files.length})...`,
        log: `[${i + 1}/${files.length}] ${f.path} FAILED (${errMsg})`,
      });
    }
  }

  console.log(`[SYNC] Blobs created: ${blobResults.length} OK, ${failCount} FAILED (out of ${files.length})`);

  if (blobResults.length === 0) {
    onProgress?.({ stage: "error", message: "All files failed to upload." });
    return { success: false, filesCount: 0, error: "All files failed to upload" };
  }

  const rootFiles = blobResults.filter((b) => !b.path.includes("/"));
  const dirFiles = new Map<string, { path: string; sha: string }[]>();
  for (const b of blobResults) {
    const idx = b.path.indexOf("/");
    if (idx !== -1) {
      const dir = b.path.slice(0, idx);
      if (!dirFiles.has(dir)) dirFiles.set(dir, []);
      dirFiles.get(dir)!.push({ path: b.path.slice(idx + 1), sha: b.sha });
    }
  }

  onProgress?.({ stage: "tree", message: "Building tree..." });
  const baseTree = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/trees/${baseTreeSha}`, token);

  const treeChanges: { path: string; mode?: string; type?: string; sha: string | null }[] = [];

  // 新增/替换的根级文件
  for (const b of rootFiles) {
    treeChanges.push({ path: b.path, mode: "100644", type: "blob", sha: b.sha });
  }

  // 处理各个子目录（只传增量，依赖 base_tree 合并）
  for (const [dir, entries] of dirFiles) {
    if (entries.length === 0) continue;
    const baseDir = baseTree.tree.find((e: any) => e.path === dir);
    console.log(`[SYNC] Processing dir="${dir}": ${entries.length} new entries, baseDir=${!!baseDir}, baseTreeSha=${baseTreeSha.slice(0, 7)}`);

    // 只用增量构建：新增 + 删除
    const dirChanges: { path: string; mode?: string; type?: string; sha: string | null }[] = [];
    for (const e of entries) {
      dirChanges.push({ path: e.path, mode: "100644", type: "blob", sha: e.sha });
    }
    // 删除的文件（sha=null 表示从树中移除）
    for (const dp of deletePaths || []) {
      if (dp.startsWith(`${dir}/`)) {
        dirChanges.push({ path: dp.slice(dir.length + 1), mode: "100644", type: "blob", sha: null });
      }
    }

    console.log(`[SYNC]   dirChanges: ${dirChanges.length} entries (${entries.length} new + ${dirChanges.length - entries.length} deletes), bodySize≈${JSON.stringify({ base_tree: baseDir?.sha, tree: dirChanges }).length}B`);
    const mergedTree = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/trees`, token, "POST", {
      base_tree: baseDir?.sha,
      tree: dirChanges,
    });
    treeChanges.push({ path: dir, mode: "040000", type: "tree", sha: mergedTree.sha as string });
  }

  console.log(`[SYNC] Root tree changes: ${treeChanges.length} entries (${rootFiles.length} root + ${[...dirFiles.keys()].length} dirs), base_tree=${baseTreeSha.slice(0, 7)}`);
  const newTree = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/trees`, token, "POST", {
    base_tree: baseTreeSha,
    tree: treeChanges,
  });

  onProgress?.({ stage: "tree", message: "Creating commit..." });
  const newCommit = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/commits`, token, "POST", {
    message,
    tree: newTree.sha,
    parents: [ref.object.sha],
  });

  onProgress?.({ stage: "done", message: "Pushing to data branch..." });
  await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, token, "PATCH", {
    sha: newCommit.sha as string,
    force: true,
  });

  const okCount = blobResults.length;
  const suffix = failCount > 0 ? ` (${failCount} failed)` : "";
  const finalMsg = `Sync complete! ${okCount} files synced${suffix}.`;
  console.log(`[SYNC] ${finalMsg} commit=${(newCommit.sha as string).slice(0, 7)} message=${message}`);
  onProgress?.({ stage: "done", message: finalMsg });
  return { success: failCount === 0, commitSha: newCommit.sha as string, filesCount: okCount };
}

// ── Download existing JSON files from data branch (for media URL replacement) ──

async function getExistingJsonFiles(
  token: string,
  onProgress?: ProgressCb
): Promise<Map<string, string>> {
  const ref = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`, token);
  const commit = await gh(ref.object.url, token);

  const tree = await gh(
    `${GH_API}/repos/${OWNER}/${REPO}/git/trees/${commit.tree.sha}?recursive=1`,
    token
  );

  const result = new Map<string, string>();
  const entries: any[] = tree.tree || [];
  const jsonEntries = entries.filter((e: any) => e.type === "blob" && e.path.endsWith(".json"));

  onProgress?.({ stage: "collecting", message: `Downloading ${jsonEntries.length} JSON files from GitHub...` });

  for (const entry of jsonEntries) {
    try {
      const blob = await gh(entry.url, token);
      result.set(entry.path, base64DecodeUtf8(blob.content));
    } catch (e) {
      console.error("[SYNC] Failed to read blob for entry:", entry?.path, e);
    }
  }

  return result;
}

// ── Public sync functions ──

export async function syncJson(
  token: string,
  onProgress?: ProgressCb
): Promise<SyncResult> {
  console.log(`[SYNC JSON] Starting... repo=${OWNER}/${REPO} branch=${BRANCH}`);
  try {
    onProgress?.({ stage: "collecting", message: "Fetching existing data from GitHub..." });
    let existing = new Map<string, string>();
    try {
      const ref = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`, token);
      const commit = await gh(ref.object.url, token);
      const tree = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/trees/${commit.tree.sha}?recursive=1`, token);
      for (const e of (tree.tree || []).filter((x: any) => x.type === "blob" && x.path.endsWith(".json"))) {
        try {
          const blob = await gh(e.url, token);
          existing.set(e.path, base64DecodeUtf8(blob.content));
        } catch (e) {
          console.error("[SYNC] Failed to read existing blob:", e);
        }
      }
    } catch (e) {
      console.log("[SYNC] No existing data branch yet (first sync or empty):", e);
    }
    onProgress?.({ stage: "collecting", message: `Downloaded ${existing.size} existing files. Fetching new data...` });

    const files = await collectAllData(token, existing, onProgress);
    onProgress?.({ stage: "collecting", message: `Collected ${files.length} files.` });

    // 只上传变更的文件（内容没变的跳过）
    const changed = files.filter((f) => {
      const prev = existing.get(f.path);
      return prev === undefined || prev !== f.content;
    });
    onProgress?.({ stage: "collecting", message: `Changed: ${changed.length}, unchanged: ${files.length - changed.length}.` });

    // 检测已删除的详情文件（列表里不再有该 ID）
    const deletePaths: string[] = [];
    const newIds = new Map<string, Set<string>>();
    for (const f of files) {
      if (f.path.endsWith(".json") && f.path.includes("/")) {
        const parts = f.path.split("/");
        if (!newIds.has(parts[0])) newIds.set(parts[0], new Set());
        newIds.get(parts[0])!.add(parts[1].replace(/\.json$/, ""));
      }
    }
    for (const [dir, ids] of newIds) {
      for (const [path] of existing) {
        const m = path.match(new RegExp(`^${dir}/(\\d+)\\.json$`));
        if (m && !ids.has(m[1])) {
          deletePaths.push(path);
        }
      }
    }
    if (deletePaths.length > 0) {
      onProgress?.({ stage: "collecting", message: `Removed: ${deletePaths.length} files.` });
    }

    if (changed.length === 0 && deletePaths.length === 0) {
      onProgress?.({ stage: "done", message: "No changes to sync." });
      return { success: true, filesCount: 0 };
    }

    const ts = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    return await syncFiles(
      token,
      changed.map((f) => ({ ...f, encoding: "utf-8" as const })),
      `${ts} sync json data`,
      onProgress,
      deletePaths
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[SYNC JSON] Error:", err);
    onProgress?.({ stage: "error", message: msg });
    return { success: false, filesCount: 0, error: msg };
  }
}

export async function syncMedia(
  token: string,
  onProgress?: ProgressCb
): Promise<SyncResult> {
  console.log(`[SYNC MEDIA] Starting... repo=${OWNER}/${REPO} branch=${BRANCH}`);
  try {
    const apiBase = `http://${siteConfig.backUrl}/api`;

    onProgress?.({ stage: "collecting", message: "Fetching existing manifest from GitHub..." });
    const existingManifest = await getExistingMediaManifest(token);

    onProgress?.({ stage: "collecting", message: "Fetching media from API..." });
    const { mediaItems, mediaMap, deletedIds } = await collectMedia(apiBase, onProgress, existingManifest);

    if (mediaItems.length === 0 && deletedIds.length === 0) {
      onProgress?.({ stage: "done", message: "No media changes to sync." });
      return { success: true, filesCount: 0 };
    }

    // 需要删除的 media 文件路径
    const staleMediaPaths = deletedIds.map((id) => {
      const prev = existingManifest.get(id);
      return prev ? `media/${prev.filename}` : "";
    }).filter(Boolean);

    // 构建最新的 manifest
    const manifestContent = JSON.stringify(
      mediaItems.map((m) => ({ id: m.id, filename: m.filename })),
      null,
      2
    );

    const files: SyncFile[] = [];

    // manifest
    files.push({ path: "media-manifest.json", content: manifestContent, encoding: "utf-8" });

    for (const m of mediaItems) {
      if (m.base64) {
        files.push({ path: `media/${m.filename}`, content: m.base64, encoding: "base64" });
      }
    }

    const downloadCount = mediaItems.filter((m) => m.base64).length;
    const ts = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    const commitMsg = `${ts} sync media (${downloadCount} downloaded, ${staleMediaPaths.length} deleted)`;
    return await syncFiles(token, files, commitMsg, onProgress, staleMediaPaths);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[SYNC MEDIA] Error:", err);
    onProgress?.({ stage: "error", message: msg });
    return { success: false, filesCount: 0, error: msg };
  }
}

export async function syncMusic(
  token: string,
  onProgress?: ProgressCb
): Promise<SyncResult> {
  console.log(`[SYNC MUSIC] Starting... repo=${OWNER}/${REPO} branch=${BRANCH}`);
  try {
    const apiBase = `http://${siteConfig.backUrl}/api`;

    onProgress?.({ stage: "collecting", message: "Fetching existing manifest from GitHub..." });
    const existingManifest = await getExistingMusicManifest(token);

    onProgress?.({ stage: "collecting", message: "Fetching music from API..." });
    const { musicData, audioFiles, deletedIds } = await collectMusic(apiBase, onProgress, existingManifest);

    if (audioFiles.length === 0 && deletedIds.length === 0) {
      onProgress?.({ stage: "done", message: "No music changes to sync." });
      return { success: true, filesCount: 0 };
    }

    // 删除的曲目路径
    const stalePaths = deletedIds.map((id) => `music/${id}.mp3`);

    // 构建最新 manifest（已有 ID + 新下载的 ID）
    const manifestIds = new Set((existingManifest?.keys() || []));
    for (const f of audioFiles) {
      const id = Number(f.path.split("/")[1].split(".")[0]);
      if (id) manifestIds.add(id);
    }
    const manifestContent = JSON.stringify([...manifestIds].map((id) => ({ id })), null, 2);

    // 先解析对象，再逐条修改属性（避免 replaceAll 字符串替换污染其他曲目）
    const parsed = JSON.parse(JSON.stringify(musicData)) as { total: number; rows: OpMusic[] };
    for (const track of parsed.rows) {
      if (track.id == null) continue;
      if (track.url) {
        const audioExt = extFromFilename(track.url) || ".mp3";
        track.url = `/data/music/${track.id}${audioExt}`;
      }
      if (track.pictureUrl) {
        const ext = extFromFilename(track.pictureUrl) || ".png";
        track.pictureUrl = `/data/music/${track.id}-cover${ext}`;
      }
    }

    // 仅保留已同步的曲目（有音频文件的），其余剔除
    parsed.rows = parsed.rows.filter(t => t.id != null && manifestIds.has(t.id));
    parsed.total = parsed.rows.length;

    const files: SyncFile[] = [
      { path: "music.json", content: JSON.stringify(parsed, null, 2), encoding: "utf-8" },
      { path: "music-manifest.json", content: manifestContent, encoding: "utf-8" },
    ];
    for (const af of audioFiles) {
      files.push({ path: af.path, content: af.content, encoding: "base64" });
    }

    const ts = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    return await syncFiles(token, files, `${ts} sync music (${audioFiles.length} files)`, onProgress, stalePaths);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[SYNC MUSIC] Error:", err);
    onProgress?.({ stage: "error", message: msg });
    return { success: false, filesCount: 0, error: msg };
  }
}

// ── Manual sync — export data as a ZIP + standalone BAT ──

export async function generateSyncZip(
  onProgress?: ProgressCb,
  token?: string
): Promise<{ blob: Blob; name: string; batContent: string }> {
  const apiBase = `http://${siteConfig.backUrl}/api`;

  // 1. Collect JSON
  onProgress?.({ stage: "collecting", message: "Fetching JSON data..." });
  const jsonFiles = await collectAllData(token);
  onProgress?.({ stage: "collecting", message: `Collected ${jsonFiles.length} JSON files.` });

  // 2. Collect media
  onProgress?.({ stage: "collecting", message: "Downloading media files..." });
  const { mediaItems, mediaMap } = await collectMedia(apiBase, onProgress);

  // 3. Collect music
  onProgress?.({ stage: "collecting", message: "Downloading music files..." });
  const { musicData, audioFiles } = await collectMusic(apiBase, onProgress);

  // 4. Build ZIP
  onProgress?.({ stage: "collecting", message: "Creating ZIP..." });

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const folder = "sync-data";

  // JSON files with URL replacements
  for (const f of jsonFiles) {
    const content = mediaMap.size > 0 ? replaceMediaUrls(f.content, mediaMap) : f.content;
    zip.file(`${folder}/${f.path}`, content);
  }

  // Media files
  for (const m of mediaItems) {
    if (m.base64) zip.file(`${folder}/media/${m.filename}`, m.base64, { base64: true });
  }

  // Music
  const musicJson = buildMusicJson(musicData, audioFiles, apiBase);
  if (musicJson) {
    zip.file(`${folder}/music.json`, JSON.stringify(musicJson, null, 2));
  }
  for (const af of audioFiles) {
    zip.file(`${folder}/${af.path}`, af.content, { base64: true });
  }

  // ── Generate ZIP ──
  onProgress?.({ stage: "collecting", message: "Compressing..." });
  const blob = await zip.generateAsync({ type: "blob" });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const name = `sync-data-${timestamp}.zip`;

  // ── Standalone sync.bat (double-click, auto-extracts ZIP) ──
  // Strategy: split into 3 small commits+pushes to avoid 408 timeout
  const batContent = [
    '@echo off',
    'chcp 65001 >nul',
    'cd /d "%~dp0"',
    '',
    'echo [1/5] 解压数据文件...',
    `powershell -Command "Expand-Archive -Path '${name}' -DestinationPath '.' -Force" >nul 2>nul`,
    'cd sync-data',
    '',
    'echo [2/5] 初始化仓库...',
    'git init',
    `git remote add origin https://github.com/${siteConfig.repo}.git`,
    'git fetch origin data --depth=1 2>nul || echo 无已有 data 分支',
    'git checkout origin/data -- .github/ 2>nul || echo 无工作流文件需保留',
    'git checkout origin/data -- CNAME 2>nul || echo 无 CNAME 文件',
    'git checkout -b data',
    '',
    'echo [3/5] 提交 JSON 数据并推送...',
    'git add .github/',
    'for %%f in (*.json) do git add "%%f"',
    'git add articles/ projects/ 2>nul',
    'git commit -m "manual sync: json %date% %time%"',
    'git push origin data --force',
    'if %errorlevel% neq 0 (echo JSON 推送失败！ & pause & exit /b 1)',
    '',
    'echo [4/5] 提交媒体文件并推送...',
    'if exist media\\ (git add media/ & git commit -m "manual sync: media %date% %time%" & git push origin data --force)',
    'if %errorlevel% neq 0 (echo 媒体文件推送失败！ & pause & exit /b 1)',
    '',
    'echo [5/5] 提交音乐文件并推送...',
    'if exist music\\ (git add music.json music/ 2>nul & git commit -m "manual sync: music %date% %time%" & git push origin data --force)',
    'if %errorlevel% neq 0 (echo 音乐文件推送失败！ & pause & exit /b 1)',
    '',
    'echo.',
    'echo 同步完成!',
    'pause',
  ].join('\r\n');

  onProgress?.({ stage: "done", message: `ZIP ready: ${name}` });
  return { blob, name, batContent };
}

function buildMusicJson(
  musicData: unknown,
  audioFiles: MusicFile[],
  apiBase: string
): unknown | null {
  if (!musicData || !(musicData as any)?.rows?.length) return null;
  const parsed = JSON.parse(JSON.stringify(musicData)) as { rows: any[] };
  for (const track of parsed.rows) {
    if (track.id == null) continue;
    if (track.url) {
      const audioExt = extFromFilename(track.url) || ".mp3";
      track.url = `/data/music/${track.id}${audioExt}`;
    }
    if (track.pictureUrl) {
      const ext = extFromFilename(track.pictureUrl) || ".png";
      track.pictureUrl = `/data/music/${track.id}-cover${ext}`;
    }
  }
  return parsed;
}
