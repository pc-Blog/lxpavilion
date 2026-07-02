import api from "@/lib/axios";
import type { PageVO, Category, PageDTO } from "@/lib/types";
import { detectMode, ensureData } from "@/lib/static-data";

export async function getList(keyword?: string, pageNum = 1, pageSize = 100) {
  if ((await detectMode()) === "static") {
    return (await ensureData<PageVO<Category>>("categories")) ?? { rows: [], total: 0 };
  }
  return api.post<PageVO<Category>, PageVO<Category>>("/category/page", {
    pageNum,
    pageSize,
    query: keyword ? ({ name: keyword } as Category) : undefined,
  } satisfies PageDTO<Category>);
}

export async function create(data: Category) { return api.post("/category", data); }
export async function update(data: Category) { return api.put("/category", data); }
export async function remove(id: number) { return api.delete(`/category/${id}`); }
