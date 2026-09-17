import api from "@/lib/axios";
import type { PageVO, Media, PageDTO } from "@/lib/types";

export async function getList(params: PageDTO<Media>) {
  return api.post<PageVO<Media>, PageVO<Media>>("/media/page", params);
}

export async function upload(file: File, relationType?: string) {
  const form = new FormData();
  form.append("file", file);
  if (relationType) form.append("relationType", relationType);
  return api.post<Media, Media>("/media/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function remove(id: number) {
  return api.delete(`/media/${id}`);
}

/** 批量删除，返回成功条数与逐条错误信息 */
export async function batchRemove(ids: number[]) {
  return api.delete<{ success: number; errors: string[] }, { success: number; errors: string[] }>(
    "/media/batch",
    { data: ids },
  );
}

export interface MediaRef {
  type:
    | "article"
    | "project"
    | "about"
    | "album"
    | "chatter"
    | "music"
    | "singer"
    | "user"
    | "friendLink";
  title: string;
  id?: number;
  field: "coverImage" | "content" | "fileUrl" | "avatar" | "pictureUrl";
}

/**
 * 后端 `MediaScanVO`：媒体字段**平铺**在 item 上，`refs` 为空即为孤儿。
 *
 * 注意不是 `{ media, refs }` 嵌套结构，后端就是这么返回的。
 */
export interface MediaScanItem extends Media {
  /** 引用来源列表；为空表示孤儿 */
  refs: MediaRef[];
}

export interface MediaWithRef {
  media: Media;
  refs: MediaRef[];
}

/**
 * 扫描全部媒体文件及其引用来源，`refs` 为空即为孤儿。
 *
 * 判定规则完全由后端 `MediaRefResolver` 提供（单一来源），前端只负责展示。
 */
export async function scanMediaWithRefs(): Promise<{
  items: MediaScanItem[];
  totalMedia: number;
  orphanCount: number;
}> {
  return api.post("/media/orphan-scan", {});
}
