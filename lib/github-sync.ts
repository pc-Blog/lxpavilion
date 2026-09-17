"use client";

import type { Media } from "@/lib/types";
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

/** 浅拷贝并剔除指定字段（用于剥离每次都变的动态字段，避免 SHA 比对永远判定为变更） */
function omitKey<T extends Record<string, unknown>>(obj: T, key: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k !== key) out[k] = v;
  }
  return out;
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
  existingManifest?: Map<number, MediaItem>,
  limit = 100
): Promise<{
  mediaItems: MediaItem[];
  deletedIds: number[];
}> {
  const mediaItems: MediaItem[] = [];
  const deletedIds: number[] = [];

  let mediaRows: Media[] = [];
  try {
    // 必须一次取全：媒体表按 id 倒序，音乐 id 比图文大、排在前面，
    // 单页取不全时图文媒体会缺失，进而被误判为「已删除」而删除线上文件。
    const res = await fetch(`${apiBase}/media/page`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageNum: 1, pageSize: 1000000 }),
    });
    const body = await res.json() as { code: number; data?: { rows?: Media[] } };
    mediaRows = body.data?.rows || [];
  } catch (e) {
    console.error("[SYNC] Failed to fetch media from API:", e);
    return { mediaItems, deletedIds };
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
  // 按文件体积升序：先搬小的，避免大音频占满本次配额导致图文永远轮不到
  const toDownload = mediaRows.filter((media) => {
    if (media.id == null) return false;
    if (!existingManifest) return true;
    return !existingManifest.has(media.id);
  }).sort((a, b) => (a.fileSize || 0) - (b.fileSize || 0))
    .slice(0, limit);

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

  return { mediaItems, deletedIds };
}

// Collect data from Java backend
async function collectAllData(ghToken?: string, onProgress?: ProgressCb): Promise<{
  files: { path: string; content: string }[];
  failedPaths: Set<string>;
}> {
  const base = `http://${siteConfig.backUrl}/api`;

  /**
   * 采集失败、但路径可能已存在于 data 分支的文件。
   *
   * 这些路径不能进入 syncJson 的删除判定：拉取失败不等于数据被删除，
   * 否则一次网络抖动就会把线上文件删掉。syncJson 会显式跳过它们。
   */
  const failedPaths = new Set<string>();
  function markFailed(path: string, e: unknown) {
    console.error(`[SYNC] Failed to fetch ${path}:`, e);
    failedPaths.add(path);
  }

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

  // 一次取全：pageSize 过小会静默截断列表，而详情文件是跟着列表生成的，
  // 被截掉的文章不仅不会同步，其已有的 articles/{id}.json 还会被删除逻辑
  // 判定为「已删除」而从 data 分支移除。
  const PAGE = { pageNum: 1, pageSize: 1000000 };
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
  // 剥离动态 viewCount：它每次访问都在变，带上会导致每次同步都判定为变更而全量重传
  const articleListStripped = {
    ...articleList,
    rows: (articleList.rows as Record<string, unknown>[]).map((row) => omitKey(row, "viewCount")),
  };
  files.push({ path: "articles.json", content: JSON.stringify(articleListStripped, null, 2) });
  for (const a of articleList.rows as { id: number }[]) {
    try {
      const detail = await apiGet<Record<string, unknown>>(`/article/public/${a.id}`);
      // 剥离动态 viewCount，避免每次同步都判定为变更
      files.push({ path: `articles/${a.id}.json`, content: JSON.stringify(omitKey(detail, "viewCount"), null, 2) });
    } catch (e) {
      markFailed(`articles/${a.id}.json`, e);
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

  try {
    const media = await apiPost<unknown, unknown>("/media/page", { pageNum: 1, pageSize: 1000000 });
    files.push({ path: "media.json", content: JSON.stringify(media, null, 2) });
  } catch (e) {
    markFailed("media.json", e);
  }

  // ── 音乐 ──
  // 只同步收藏曲目：全库 1222 首约 4.8 GB，收藏 369 首约 1.6 GB，
  // 静态托管放不下全量。元数据走 JSON 同步，音频文件本体由媒体同步搬运。

  try {
    const music = await apiPost<unknown, unknown>("/music/page", {
      ...PAGE,
      query: { onlyFavorite: true },
    });
    files.push({ path: "music.json", content: JSON.stringify(music, null, 2) });
  } catch (e) {
    markFailed("music.json", e);
  }

  try {
    const singers = await apiPost<unknown, unknown>("/singer/page", PAGE);
    files.push({ path: "singers.json", content: JSON.stringify(singers, null, 2) });
  } catch (e) {
    markFailed("singers.json", e);
  }

  try {
    const musicCategories = await apiPost<unknown, unknown>("/music-category/page", PAGE);
    files.push({ path: "musicCategories.json", content: JSON.stringify(musicCategories, null, 2) });
  } catch (e) {
    markFailed("musicCategories.json", e);
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
        markFailed(`albums/${a.id}.json`, e);
      }
    }
  } catch (e) {
    markFailed("albums.json", e);
  }

  // Chatter / Moments data
  try {
    const chatters = await apiGet<unknown>("/chatter/list");
    files.push({ path: "chatters.json", content: JSON.stringify(chatters, null, 2) });
  } catch (e) {
    markFailed("chatters.json", e);
  }

  // Friend links
  try {
    const friendLinks = await apiGet<unknown>("/friend-link/list");
    files.push({ path: "friendLinks.json", content: JSON.stringify(friendLinks, null, 2) });
  } catch (e) {
    markFailed("friendLinks.json", e);
  }

  // Bookmarks
  try {
    const bookmarks = await apiGet<unknown>("/bookmark/list");
    files.push({ path: "bookmarks.json", content: JSON.stringify(bookmarks, null, 2) });
    const bookmarkCats = await apiGet<unknown>("/bookmark/category/tree");
    files.push({ path: "bookmarkCategories.json", content: JSON.stringify(bookmarkCats, null, 2) });
  } catch (e) {
    markFailed("bookmarks.json", e);
  }

  // Literature：取全部作品，但只把**已发布**的写入 data 分支。
  // data 分支是公开的，隐藏作品（草稿）的正文不得进入线上静态数据。
  try {
    const all = await apiPost<{ total: number; rows: { isPublished?: number }[] }, unknown>(
      "/literature/admin/page", { pageNum: 1, pageSize: 1000000 }
    );
    const publishedRows = (all.rows || []).filter((a) => a.isPublished === 1);
    files.push({
      path: "literature.json",
      content: JSON.stringify({ total: publishedRows.length, rows: publishedRows }, null, 2),
    });
  } catch (e) {
    markFailed("literature.json", e);
  }

  // 文学分类（供前端映射 categoryId -> 分类名）
  try {
    const literatureCategories = await apiGet<unknown>("/literature/public/categories");
    files.push({ path: "literatureCategories.json", content: JSON.stringify(literatureCategories, null, 2) });
  } catch (e) {
    markFailed("literatureCategories.json", e);
  }

  files.push({
    path: "index.json",
    content: JSON.stringify(
      // 仅用于 static-data 的 HEAD 探测，内容不参与逻辑
      ["dashboard", "about", "articles", "projects", "categories", "tags", "timeline", "skills", "media", "music", "singers", "musicCategories", "literature", "literatureCategories", "albums", "friendLinks", "chatters", "bookmarks", "bookmarkCategories"],
      null, 2
    ),
  });

  // 媒体 URL 替换失败是致命的：所有 JSON 会带着 localhost 的远程地址上线，
  // 线上图片/音频全部 404。这里不能吞掉，直接抛出中止整次同步。
  const mediaRes = await apiPost<{ rows: { id: number; fileUrl: string; originalFilename?: string }[] }, unknown>(
    "/media/page", { pageNum: 1, pageSize: 1000000 }
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

  return { files, failedPaths };
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

  // 只要有一个 blob 失败就整批中止，不建 tree、不提交。
  //
  // 此时分支尚未被改动：blob/tree/commit 都是悬空对象，只有最后 PATCH ref
  // 才移动分支指针。若带着失败继续提交，会出现「manifest 已记录该文件、
  // 但文件实际不在分支里」的永久 404，且下次同步因 manifest 命中而永不重试。
  if (failCount > 0) {
    const msg = `${failCount} of ${files.length} files failed to upload, aborted before commit.`;
    onProgress?.({ stage: "error", message: msg });
    return { success: false, filesCount: 0, error: msg };
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

    const { files, failedPaths } = await collectAllData(token, onProgress);
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
    //
    // 关键：failedPaths 必须排除。拉取失败不等于数据被删除，
    // 否则一次网络抖动就会把线上文章/相册文件删掉。
    const deletePaths: string[] = [];
    const newPaths = new Set(files.map(f => f.path));
    for (const path of existingShas.keys()) {
      const isManagedSubFile = path.includes("/") && !path.startsWith("media/") && !path.startsWith("music/");
      if (isManagedSubFile && !newPaths.has(path) && !failedPaths.has(path)) {
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
  onProgress?: ProgressCb,
  limit = 100
): Promise<SyncResult> {
  console.log(`[SYNC MEDIA] Starting... repo=${OWNER}/${REPO} branch=${BRANCH} limit=${limit}`);
  try {
    const apiBase = `http://${siteConfig.backUrl}/api`;

    onProgress?.({ stage: "collecting", message: "Fetching existing manifest from GitHub..." });
    const existingManifest = await getExistingMediaManifest(token);
    const { commitSha: mediaCommit, treeSha: mediaTree } = await getBranchCommitAndTreeSha(token);

    onProgress?.({ stage: "collecting", message: "Fetching media from API..." });
    const { mediaItems, deletedIds } = await collectMedia(apiBase, onProgress, existingManifest, limit);

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
