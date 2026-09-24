"use client";

/**
 * 相册照片批量下载：把相册内所有照片拉下来打成一个 zip
 */

import { assetUrl } from "@/lib/asset-url";

export interface GalleryDownloadResult {
  total: number;
  success: number;
  failed: number;
}

const MAX_CONCURRENCY = 6;

/** 从 url 里取扩展名（含点），取不到就按 jpg 处理 */
function extOf(url: string): string {
  const clean = url.split("?")[0].split("#")[0];
  const name = clean.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return ".jpg";
  const ext = name.slice(dot);
  return /^\.[A-Za-z0-9]{1,5}$/.test(ext) ? ext.toLowerCase() : ".jpg";
}

/** 文件名去掉扩展名，并清掉文件系统不接受的字符 */
function stemOf(url: string): string {
  const name = (url.split("?")[0].split("#")[0].split("/").pop() ?? "").replace(/\.[^.]+$/, "");
  const safe = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").trim();
  return safe.slice(0, 80);
}

/** 并发受限地跑任务，保持结果顺序与输入一致 */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * 把照片打包成 zip 下载。
 * 单张失败只跳过、不中断整体；返回下载统计供调用方提示。
 */
export async function downloadPhotosAsZip(params: {
  albumTitle: string;
  urls: string[];
}): Promise<GalleryDownloadResult> {
  const { albumTitle, urls } = params;
  const zipName = albumTitle.replace(/[<>:"/\\|?*]/g, "_") || "album";

  // 下载照片，失败的留 null
  const blobs = await mapLimit(urls, MAX_CONCURRENCY, async (url) => {
    try {
      const res = await fetch(assetUrl(url));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.blob();
    } catch {
      return null;
    }
  });

  // 装入 zip，文件名去重（同名照片后面加序号）
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const used = new Set<string>();
  let success = 0;

  urls.forEach((url, i) => {
    const blob = blobs[i];
    if (!blob) return;
    let filename = `${stemOf(url)}${extOf(url)}`;
    if (used.has(filename)) filename = `${stemOf(url)}-${i + 1}${extOf(url)}`;
    used.add(filename);
    zip.file(filename, blob);
    success++;
  });

  if (success === 0) {
    return { total: urls.length, success: 0, failed: urls.length };
  }

  const out = await zip.generateAsync({ type: "blob" });
  const blobUrl = URL.createObjectURL(out);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `${zipName}.zip`;
  link.click();

  // 等浏览器开始下载后再回收，过早 revoke 会中断下载
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

  return { total: urls.length, success, failed: urls.length - success };
}
