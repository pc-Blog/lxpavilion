"use client";

import type { Media, OpMusic } from "@/lib/types";
import { siteConfig } from "./siteConfig";
import { sha1 as jsSha1 } from "js-sha1";

const GH_API = "https://api.github.com";
const [OWNER, REPO] = siteConfig.repo.split("/");
const BRANCH = "data";

export interface SyncProgress {
  stage: "collecting" | "blobs" | "tree" | "done" | "error";
  message: string;
  log?: string;
}

type ProgressCb = (p: SyncProgress) => void;

/** Compute GitHub blob SHA locally: SHA1("blob " + len + "\0" + content) */
async function computeBlobSha(
  content: string,
  encoding: "utf-8" | "base64" = "utf-8"
): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoding === "utf-8"
    ? encoder.encode(content)
    : Uint8Array.from(atob(content), (c) => c.charCodeAt(0));
  const prefix = encoder.encode(`blob ${bytes.length}\0`);
  const combined = new Uint8Array(prefix.length + bytes.length);
  combined.set(prefix);
  combined.set(bytes, prefix.length);

  if (crypto.subtle) {
    const hash = await crypto.subtle.digest("SHA-1", combined);
    const result = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
    console.log(`[SYNC] computeBlobSha using Web Crypto: ${result.slice(0, 7)}`);
    return result;
  }

  const fallback = jsSha1.arrayBuffer(combined.buffer);
  const result = [...new Uint8Array(fallback)].map((b) => b.toString(16).padStart(2, "0")).join("");
  console.log(`[SYNC] computeBlobSha using JS fallback (no crypto.subtle): ${result.slice(0, 7)}`);
  return result;
}

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
      const truncated = res.status === 422 ? text : text.slice(0, 300);
      console.error(`[GH] ✗ ${label} (${elapsed}ms) → ${res.status}: ${truncated}`);
      throw new Error(`GitHub API ${res.status}: ${truncated}`);
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

/** 从 data 分支读取 media-manifest.json（Contents API，1 请求） */
async function getExistingMediaManifest(
  token: string
): Promise<Map<number, MediaItem>> {
  const result = new Map<number, MediaItem>();
  try {
    const data: any = await gh(`${GH_API}/repos/${OWNER}/${REPO}/contents/media-manifest.json?ref=${BRANCH}`, token);
    const content = (data.content as string).replace(/\n/g, '');
    const list = JSON.parse(base64DecodeUtf8(content)) as MediaItem[];
    for (const item of list) {
      if (item.id != null) result.set(item.id, item);
    }
  } catch (e: any) {
    if (!e?.message?.includes("404")) {
      console.error("[SYNC] Failed to read manifest:", e);
    }
    /* 404 = first sync, no manifest yet */
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

interface MusicManifestEntry {
  id: number;
  ext?: string;      // ".mp3", ".ogg", etc.
  coverExt?: string; // ".png", ".jpg", etc.
}

async function getExistingMusicManifest(token: string): Promise<Map<number, MusicManifestEntry>> {
  const result = new Map<number, MusicManifestEntry>();
  try {
    const data: any = await gh(`${GH_API}/repos/${OWNER}/${REPO}/contents/music-manifest.json?ref=${BRANCH}`, token);
    const content = (data.content as string).replace(/\n/g, '');
    const list = JSON.parse(base64DecodeUtf8(content)) as MusicManifestEntry[];
    for (const item of list) {
      if (item.id != null) result.set(item.id, item);
    }
  } catch (e: any) {
    if (!e?.message?.includes("404")) {
      console.error("[SYNC] Failed to read manifest:", e);
    }
    /* 404 = first sync, no manifest yet */
  }
  return result;
}

async function collectMusic(
  apiBase: string,
  onProgress?: ProgressCb,
  existingManifest?: Map<number, MusicManifestEntry>
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

// Collect data from Java backend
async function collectAllData(ghToken?: string, onProgress?: ProgressCb): Promise<{ path: string; content: string }[]> {
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
  for (const a of articleList.rows as { id: number }[]) {
    try {
      const detail = await apiGet<Record<string, any>>(`/article/public/${a.id}`);
      const { viewCount, ...rest } = detail; // 剥离动态 viewCount，避免每次同步都判定为变更
      files.push({ path: `articles/${a.id}.json`, content: JSON.stringify(rest, null, 2) });
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
  for (const p of projectList.rows as { id: number }[]) {
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
  deletePaths?: string[],
  existingCommitSha?: string,
  existingTreeSha?: string
): Promise<SyncResult> {
  onProgress?.({ stage: "blobs", message: "Connecting to GitHub..." });
  let baseTreeSha: string;
  let parentCommitSha: string;
  if (existingCommitSha && existingTreeSha) {
    baseTreeSha = existingTreeSha;
    parentCommitSha = existingCommitSha;
    console.log(`[SYNC] syncFiles received existing: commit=${existingCommitSha.slice(0, 7)} tree=${existingTreeSha.slice(0, 7)}`);
  } else {
    console.log(`[SYNC] syncFiles fetching ref/commit (no existing params provided)`);
    const ref = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`, token);
    parentCommitSha = ref.object.sha as string;
    const currentCommit = await gh(ref.object.url, token);
    baseTreeSha = currentCommit.tree.sha as string;
  }

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

  onProgress?.({ stage: "tree", message: "Building tree..." });

  // 扁平 tree：所有路径放在一次请求中，GitHub 自动处理嵌套目录
  const treeItems: { path: string; mode?: string; type?: string; sha: string | null }[] = [];
  for (const b of blobResults) {
    treeItems.push({ path: b.path, mode: "100644", type: "blob", sha: b.sha });
  }
  for (const dp of deletePaths || []) {
    treeItems.push({ path: dp, mode: "100644", type: "blob", sha: null });
  }

  const deletes = deletePaths?.length || 0;
  const adds = blobResults.length;
  const bodySize = JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }).length;
  console.log(`[SYNC] Tree POST: base_tree=${baseTreeSha.slice(0, 7)} items=${treeItems.length} (${adds} add + ${deletes} del) bodySize=${bodySize}B`);
  for (const ti of treeItems) {
    const shaStr = ti.sha ? ti.sha.slice(0, 7) : "null";
    console.log(`[SYNC]   tree item: ${ti.path} (type=${ti.type} sha=${shaStr})`);
  }
  let newTree: any;
  try {
    newTree = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/trees`, token, "POST", {
      base_tree: baseTreeSha,
      tree: treeItems,
    });
    console.log(`[SYNC] Tree POST succeeded: ${(newTree.sha as string).slice(0, 7)}`);
  } catch (e) {
    console.error(`[SYNC] Tree POST FAILED. base_tree=${baseTreeSha.slice(0, 7)} items=${treeItems.length}`);
    // 原样抛出，上层处理
    throw e;
  }

  onProgress?.({ stage: "tree", message: "Creating commit..." });
  const newCommit = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/commits`, token, "POST", {
    message,
    tree: newTree.sha,
    parents: [parentCommitSha],
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

// ── Public sync functions ──

export async function syncJson(
  token: string,
  onProgress?: ProgressCb
): Promise<SyncResult> {
  console.log(`[SYNC JSON] Starting... repo=${OWNER}/${REPO} branch=${BRANCH}`);
  try {
    onProgress?.({ stage: "collecting", message: "Fetching existing tree from GitHub..." });
    let existingShas = new Map<string, string>();
    let commitSha = "";
    let rootTreeSha = "";
    try {
      const ref = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`, token);
      commitSha = ref.object.sha as string;
      // 直接用分支名，跳过 GET /git/commits
      const tree = await gh(`${GH_API}/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`, token);
      rootTreeSha = tree.sha as string;
      for (const e of (tree.tree || []).filter((x: any) => x.type === "blob" && x.path.endsWith(".json"))) {
        existingShas.set(e.path, e.sha as string);
      }
    } catch (e) {
      console.log("[SYNC] No existing data branch yet (first sync or empty):", e);
    }
    onProgress?.({ stage: "collecting", message: `Existing tree: ${existingShas.size} files. Fetching new data...` });

    const files = await collectAllData(token, onProgress);
    onProgress?.({ stage: "collecting", message: `Collected ${files.length} files.` });

    // 计算 SHA 比对变更
    const changed: { path: string; content: string }[] = [];
    for (const f of files) {
      const sha = await computeBlobSha(f.content);
      if (existingShas.get(f.path) !== sha) {
        changed.push(f);
      }
    }
    onProgress?.({ stage: "collecting", message: `Changed: ${changed.length}, unchanged: ${files.length - changed.length}.` });

    // 检测已删除的详情文件（路径在 tree 中但不在新采集的 files 中）
    const deletePaths: string[] = [];
    const newPaths = new Set(files.map(f => f.path));
    for (const path of existingShas.keys()) {
      const isManagedSubFile = path.includes("/") && !path.startsWith("media/") && !path.startsWith("music/");
      if (isManagedSubFile && !newPaths.has(path)) {
        deletePaths.push(path);
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
      deletePaths,
      commitSha,
      rootTreeSha
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[SYNC JSON] Error:", err);
    onProgress?.({ stage: "error", message: msg });
    return { success: false, filesCount: 0, error: msg };
  }
}

/** 获取 data 分支最新的 commit SHA 和根 tree SHA（1 请求替代 2 请求） */
async function getBranchCommitAndTreeSha(token: string): Promise<{ commitSha: string; treeSha: string }> {
  const data: any = await gh(`${GH_API}/repos/${OWNER}/${REPO}/commits/${BRANCH}`, token);
  const commitSha = data.sha as string;
  const treeSha = data.commit.tree.sha as string;
  console.log(`[SYNC] getBranchCommitAndTreeSha: commit=${commitSha.slice(0, 7)} tree=${treeSha.slice(0, 7)}`);
  return { commitSha, treeSha };
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
    const { commitSha: mediaCommit, treeSha: mediaTree } = await getBranchCommitAndTreeSha(token);

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
    return await syncFiles(token, files, commitMsg, onProgress, staleMediaPaths, mediaCommit, mediaTree);
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
    const { commitSha, treeSha } = await getBranchCommitAndTreeSha(token);

    onProgress?.({ stage: "collecting", message: "Fetching music from API..." });
    const { musicData, audioFiles, deletedIds } = await collectMusic(apiBase, onProgress, existingManifest);

    if (audioFiles.length === 0 && deletedIds.length === 0) {
      onProgress?.({ stage: "done", message: "No music changes to sync." });
      return { success: true, filesCount: 0 };
    }

    // 删除的曲目路径（使用 manifest 记录的扩展名，兼容旧数据）
    const stalePaths: string[] = [];
    for (const id of deletedIds) {
      const entry = existingManifest?.get(id);
      stalePaths.push(`music/${id}${entry?.ext || ".mp3"}`);
      if (entry?.coverExt) {
        stalePaths.push(`music/${id}-cover${entry.coverExt}`);
      }
    }

    // 从新下载的 audioFiles 中提取扩展名
    const newExts = new Map<number, { ext?: string; coverExt?: string }>();
    for (const f of audioFiles) {
      const fileName = f.path.split("/").pop() || "";
      const dotIdx = fileName.lastIndexOf(".");
      if (dotIdx === -1) continue;
      const ext = fileName.slice(dotIdx);
      const idMatch = fileName.match(/^(\d+)/);
      if (!idMatch) continue;
      const id = Number(idMatch[1]);
      if (!newExts.has(id)) newExts.set(id, {});
      const entry = newExts.get(id)!;
      if (fileName.includes("-cover")) entry.coverExt = ext;
      else entry.ext = ext;
    }

    // 构建最新 manifest（合并已有记录的扩展名 + 新下载的）
    const manifestIds = new Set((existingManifest?.keys() || []));
    for (const f of audioFiles) {
      const id = Number(f.path.split("/")[1].split(".")[0]);
      if (id) manifestIds.add(id);
    }
    const manifestEntries = [...manifestIds].map((id) => {
      const prev = existingManifest?.get(id);
      const update = newExts.get(id);
      return { id, ext: update?.ext || prev?.ext, coverExt: update?.coverExt || prev?.coverExt };
    });
    const manifestContent = JSON.stringify(manifestEntries, null, 2);

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
    return await syncFiles(token, files, `${ts} sync music (${audioFiles.length} files)`, onProgress, stalePaths, commitSha, treeSha);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[SYNC MUSIC] Error:", err);
    onProgress?.({ stage: "error", message: msg });
    return { success: false, filesCount: 0, error: msg };
  }
}

