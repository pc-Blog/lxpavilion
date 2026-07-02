import api from "@/lib/axios";
import type { PageVO, Tag, PageDTO } from "@/lib/types";
import { detectMode, ensureData } from "@/lib/static-data";

export async function getList(keyword?: string, pageNum = 1, pageSize = 100) {
  if ((await detectMode()) === "static") {
    return (await ensureData<PageVO<Tag>>("tags")) ?? { rows: [], total: 0 };
  }
  return api.post<PageVO<Tag>, PageVO<Tag>>("/tag/page", {
    pageNum,
    pageSize,
    query: keyword ? { name: keyword } : undefined,
  } satisfies PageDTO<Tag>);
}

export async function create(data: Tag) {
  return api.post("/tag", data);
}

export async function update(data: Tag) {
  return api.put("/tag", data);
}

export async function remove(id: number) {
  return api.delete(`/tag/${id}`);
}
