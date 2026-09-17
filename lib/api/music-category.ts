import api from "@/lib/axios";
import type { PageVO, MusicCategory, PageDTO } from "@/lib/types";
import { detectMode, ensureData } from "@/lib/static-data";

/**
 * 音乐分类分页查询。
 *
 * <p>与 {@link ./singer} 同理：源项目的 {@code GET /music/categories/list}
 * 在 Blog 后端不存在，改为取分页全量后在客户端组装下拉数据。</p>
 */
export async function getPage(
  pageNum = 1,
  pageSize = 1000,
  name?: string,
): Promise<PageVO<MusicCategory>> {
  if ((await detectMode()) === "static") {
    const data = (await ensureData<PageVO<MusicCategory>>("musicCategories")) ?? {
      rows: [],
      total: 0,
    };
    const rows = name ? data.rows.filter((c) => c.name.includes(name)) : data.rows;
    return { rows, total: rows.length };
  }
  return api.post<PageVO<MusicCategory>, PageVO<MusicCategory>>("/music-category/page", {
    pageNum,
    pageSize,
    query: name ? ({ name } as MusicCategory) : undefined,
  } satisfies PageDTO<MusicCategory>);
}

/** 取「全部歌手 / 分类」下拉所需的完整列表 */
export async function getAll(): Promise<MusicCategory[]> {
  const data = await getPage(1, 1000);
  return data.rows ?? [];
}

export async function create(data: MusicCategory) {
  return api.post("/music-category", data);
}

export async function update(data: MusicCategory) {
  return api.put("/music-category", data);
}

export async function remove(id: number) {
  return api.delete(`/music-category/${id}`);
}
