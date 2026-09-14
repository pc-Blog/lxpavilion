import api from "@/lib/axios";
import type { Literature, LiteratureCategory, PageVO, PageDTO } from "@/lib/types";
import { detectMode, ensureData } from "@/lib/static-data";

/** 是否为静态导出构建（GitHub Pages）。本地 Docker / dev 为 false。 */
function isStaticBuild(): boolean {
  return process.env.NEXT_PUBLIC_IS_STATIC === "true";
}

/**
 * 作品列表（含完整正文）。
 *
 * 本地（live）返回**全部**作品，含未发布的草稿，便于本地预览与校对；
 * 线上静态站只返回**已发布**作品。
 *
 * 后端返回平铺列表，已按「分类 sort_order 升序 + 写作日期降序」预排：
 * - 按分类分组：直接保持顺序遍历即可，组顺序天然正确
 * - 按年月分组：自行按 writtenAt 重排后再分组
 *
 * 分类名（categoryName）不在列表中返回，需通过 getCategories() 自行映射。
 */
export async function getList(): Promise<PageVO<Literature>> {
  if ((await detectMode()) === "static") {
    const data = (await ensureData<PageVO<Literature>>("literature")) ?? { rows: [], total: 0 };
    // 静态数据文件含全部作品（本地预览需要），线上只展示已发布的
    const rows = isStaticBuild() ? data.rows.filter((a) => a.isPublished === 1) : data.rows;
    return { rows, total: rows.length };
  }
  // live：取全部作品（含未发布），本地预览用
  const all = await api.post<PageVO<Literature>, PageVO<Literature>>("/literature/admin/page", {
    pageNum: 1,
    pageSize: 1000,
  } satisfies PageDTO<LiteratureQuery>);
  return all;
}

/** 作品总数（与 getList 口径一致：本地含未发布，线上仅已发布） */
export async function getCount() {
  if ((await detectMode()) === "static") {
    return (await getList()).total;
  }
  // live：只取 total，避免为显示一个数字传输全部正文
  const res = await api.post<PageVO<Literature>, PageVO<Literature>>("/literature/admin/page", {
    pageNum: 1,
    pageSize: 1,
  } satisfies PageDTO<LiteratureQuery>);
  return res.total;
}

/** 文学分类下拉选项（按 sortOrder 升序），用于映射 categoryId -> 分类名 */
export async function getCategories() {
  if ((await detectMode()) === "static") {
    return (await ensureData<LiteratureCategory[]>("literatureCategories")) ?? [];
  }
  return api.get<LiteratureCategory[], LiteratureCategory[]>("/literature/public/categories");
}

/** 单篇详情（仅已发布） */
export async function getDetail(id: number) {
  if ((await detectMode()) === "static") {
    const data = await getList();
    return data.rows.find((a) => a.id === id) ?? null;
  }
  return api.get<Literature, Literature>(`/literature/public/${id}`);
}

// ==================== 管理端 ====================

export interface LiteratureQuery {
  title?: string;
  categoryId?: number;
  isPublished?: number;
  startDate?: string;
  endDate?: string;
}

/** 分页查询（含隐藏作品） */
export async function getAdminList(
  keyword?: string,
  pageNum = 1,
  pageSize = 20,
  categoryId?: number,
) {
  const query: LiteratureQuery = {};
  if (keyword) query.title = keyword;
  if (categoryId != null) query.categoryId = categoryId;
  return api.post<PageVO<Literature>, PageVO<Literature>>("/literature/admin/page", {
    pageNum,
    pageSize,
    query: Object.keys(query).length > 0 ? query : undefined,
  } satisfies PageDTO<LiteratureQuery>);
}

/** 单篇详情（含隐藏作品） */
export async function getAdminDetail(id: number) {
  return api.get<Literature, Literature>(`/literature/admin/${id}`);
}

export async function create(data: Literature) {
  return api.post("/literature/admin", data);
}

export async function update(data: Literature) {
  return api.put("/literature/admin", data);
}

export async function remove(id: number) {
  return api.delete(`/literature/admin/${id}`);
}

export async function publish(id: number) {
  return api.put(`/literature/admin/${id}/publish`);
}

export async function unpublish(id: number) {
  return api.put(`/literature/admin/${id}/unpublish`);
}
