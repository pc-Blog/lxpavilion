import api from "@/lib/axios";
import type { PageVO, Singer, PageDTO } from "@/lib/types";
import { detectMode, ensureData } from "@/lib/static-data";

/**
 * 歌手分页查询。
 *
 * <p>源项目的 {@code GET /music/singers/list}（返回 id→name 映射）在 Blog 后端
 * 并不存在，因此下拉框数据统一走分页接口取全量后在客户端组装。
 * 歌手数量很少（当前 11 位），一次取全量足够。</p>
 */
export async function getPage(
  pageNum = 1,
  pageSize = 1000,
  name?: string,
): Promise<PageVO<Singer>> {
  if ((await detectMode()) === "static") {
    const data = (await ensureData<PageVO<Singer>>("singers")) ?? { rows: [], total: 0 };
    const rows = name ? data.rows.filter((s) => s.name.includes(name)) : data.rows;
    return { rows, total: rows.length };
  }
  return api.post<PageVO<Singer>, PageVO<Singer>>("/singer/page", {
    pageNum,
    pageSize,
    query: name ? ({ name } as Singer) : undefined,
  } satisfies PageDTO<Singer>);
}

/** 取「全部歌手 / 分类」下拉所需的完整列表 */
export async function getAll(): Promise<Singer[]> {
  const data = await getPage(1, 1000);
  return data.rows ?? [];
}

export async function create(data: Singer) {
  return api.post("/singer", data);
}

export async function update(data: Singer) {
  return api.put("/singer", data);
}

export async function remove(id: number) {
  return api.delete(`/singer/${id}`);
}
