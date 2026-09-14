import api from "@/lib/axios";
import type { PageVO, Category, CategoryType, PageDTO } from "@/lib/types";
import { detectMode, ensureData } from "@/lib/static-data";

export async function getList(
  keyword?: string,
  pageNum = 1,
  pageSize = 100,
  type?: CategoryType,
) {
  if ((await detectMode()) === "static") {
    // 静态模式下 categories.json 含全部类型，在客户端按 type 过滤
    const data = (await ensureData<PageVO<Category>>("categories")) ?? { rows: [], total: 0 };
    if (!type) return data;
    const rows = data.rows.filter((c) => c.type === type);
    return { rows, total: rows.length };
  }
  const query: Partial<Category> = {};
  if (keyword) query.name = keyword;
  if (type) query.type = type;
  return api.post<PageVO<Category>, PageVO<Category>>("/category/page", {
    pageNum,
    pageSize,
    query: Object.keys(query).length > 0 ? (query as Category) : undefined,
  } satisfies PageDTO<Category>);
}

export async function create(data: Category) { return api.post("/category", data); }
export async function update(data: Category) { return api.put("/category", data); }
export async function remove(id: number) { return api.delete(`/category/${id}`); }
