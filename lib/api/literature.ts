import api from "@/lib/axios";
import type { Literature, LiteratureCategory, PageVO } from "@/lib/types";
import { detectMode, ensureData } from "@/lib/static-data";

/**
 * 全部已发布作品（含完整正文）。
 *
 * 后端返回平铺列表，已按「分类 sort_order 升序 + 写作日期降序」预排：
 * - 按分类分组：直接保持顺序遍历即可，组顺序天然正确
 * - 按年月分组：自行按 writtenAt 重排后再分组
 *
 * 分类名（categoryName）不在列表中返回，需通过 getCategories() 自行映射。
 */
export async function getList() {
  if ((await detectMode()) === "static") {
    return (await ensureData<PageVO<Literature>>("literature")) ?? { rows: [], total: 0 };
  }
  return api.post<PageVO<Literature>, PageVO<Literature>>("/literature/public/list");
}

/** 已发布作品总数 */
export async function getCount() {
  if ((await detectMode()) === "static") {
    return (await getList()).total;
  }
  return api.get<number, number>("/literature/public/count");
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
