import api from "@/lib/axios";
import type { Diary, DiaryRequest, DiaryStats } from "@/lib/types";

/**
 * 日记接口（仅本地）
 *
 * ⚠️ 刻意的设计约束：本模块**只用实时模式**，绝不调用 detectMode() / ensureData()。
 *
 * 原因是数据边界而非偷懒：
 *   - ensureData() 读的是 GitHub data 分支，而 **data 分支公开可读**；
 *   - 日记一旦被 syncJson 写进 data 分支，就等于公开发布，且有 git 历史删不干净；
 *   - 因此 github-sync.ts 的 collectAllData 白名单里永远不会有 diary。
 *
 * 线上静态站由页面层（DiaryClient）在 NEXT_PUBLIC_IS_STATIC 时直接短路，
 * 既不渲染内容，也不发起任何请求。
 */

/** 全量日记（后端按 recordDate 降序返回），活动条目内嵌 */
export async function listAll(): Promise<Diary[]> {
  return api.get<Diary[], Diary[]>("/diary");
}

/** 单天详情 */
export async function getById(id: number): Promise<Diary> {
  return api.get<Diary, Diary>(`/diary/${id}`);
}

/** 新建一天（方案乙：活动填好后再提交，不留空天） */
export async function create(data: DiaryRequest): Promise<number> {
  return api.post<number, number>("/diary", data);
}

/** 更新一天：活动整体替换，recordDate 不传（日期不可修改） */
export async function update(data: DiaryRequest): Promise<void> {
  return api.put<void, void>("/diary", data);
}

/** 删除一天及其全部活动条目（物理删除） */
export async function remove(id: number): Promise<void> {
  return api.delete<void, void>(`/diary/${id}`);
}

/** 统计：总数 / 每日条目数 / 分类分布 / 小分类分布 */
export async function getStats(): Promise<DiaryStats> {
  return api.get<DiaryStats, DiaryStats>("/diary/stats");
}

/** 指定分类下已使用过的小分类名称（去重、升序） */
export async function getSubcategories(category: number): Promise<string[]> {
  return api.get<string[], string[]>("/diary/subcategories", {
    params: { category },
  });
}
