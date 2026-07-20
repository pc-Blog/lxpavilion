import api from "@/lib/axios";
import type { Bookmark, BookmarkCategory, PageVO, PageDTO } from "@/lib/types";
import { detectMode, ensureData } from "@/lib/static-data";

export async function getPinnedList() {
  if ((await detectMode()) === "static") {
    const all = await ensureData<Bookmark[]>("bookmarks");
    return (all ?? []).filter((b) => b.isPin === 1).slice(0, 11);
  }
  return api.get<Bookmark[], Bookmark[]>("/bookmark/pinned");
}

export async function getFullList() {
  if ((await detectMode()) === "static") {
    return (await ensureData<Bookmark[]>("bookmarks")) ?? [];
  }
  return api.get<Bookmark[], Bookmark[]>("/bookmark/list");
}

export async function getPage(keyword?: string, pageNum = 1, pageSize = 20) {
  if ((await detectMode()) === "static") {
    return (await ensureData<PageVO<Bookmark>>("bookmarks")) ?? { rows: [], total: 0 };
  }
  return api.post<PageVO<Bookmark>, PageVO<Bookmark>>("/bookmark/page", {
    pageNum,
    pageSize,
    query: keyword ? ({ name: keyword } as Bookmark) : undefined,
  } satisfies PageDTO<Bookmark>);
}

export async function create(data: Bookmark) { return api.post("/bookmark", data); }
export async function update(data: Bookmark) { return api.put("/bookmark", data); }
export async function remove(id: number) { return api.delete(`/bookmark/${id}`); }

export async function getCategoryTree() {
  if ((await detectMode()) === "static") {
    return (await ensureData<BookmarkCategory[]>("bookmarkCategories")) ?? [];
  }
  return api.get<BookmarkCategory[], BookmarkCategory[]>("/bookmark/category/tree");
}

export async function createCategory(data: BookmarkCategory) { return api.post("/bookmark/category", data); }
export async function updateCategory(data: BookmarkCategory) { return api.put("/bookmark/category", data); }
export async function removeCategory(id: number) { return api.delete(`/bookmark/category/${id}`); }
