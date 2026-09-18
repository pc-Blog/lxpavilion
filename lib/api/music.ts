import api from "@/lib/axios";
import type { Music, PageVO, PageDTO } from "@/lib/types";
import { detectMode, ensureData } from "@/lib/static-data";

/** 播放范围：首页播放器只播收藏曲目，与静态站同步范围保持一致 */
const FAVORITE_ONLY = { onlyFavorite: true } as const;

/** 随机取一首的范围大小，仅用于让后端计算 position */
const PAGE_SIZE = 20;

export interface PlayResult {
  /** 下一首待播放的歌曲 */
  nextMusic: Music | null;
  /** 该歌曲在当前过滤条件下的页码，从 1 开始 */
  position: number;
}

export type PlayMode = "loop" | "reverse" | "single" | "random";

/** 歌曲查询条件（对应后端 MusicQueryDTO） */
export interface MusicQuery {
  title?: string;
  singerId?: number | null;
  categoryId?: number | null;
  onlyFavorite?: boolean;
}

/**
 * 选曲 + 计数合并接口。
 *
 * @param currentMusicId 当前播放的曲目 id；首次播放传 undefined
 * @param addPlay true=自动切歌（计入播放次数与时长），false=手动切歌（只更新 last_played）
 */
export async function play(
  currentMusicId?: number,
  addPlay = false,
  query: MusicQuery = FAVORITE_ONLY,
  playMode: PlayMode = "random",
): Promise<PlayResult | null> {
  if ((await detectMode()) === "static") return null;
  return api.post<PlayResult, PlayResult>("/music/play", {
    currentMusicId,
    playMode,
    addPlay,
    pageSize: PAGE_SIZE,
    query,
  });
}

/**
 * 分页查询曲目。
 *
 * <p>静态模式下 {@code music.json} 只含收藏曲目（与同步范围一致），
 * 因此筛选、分页全部在客户端完成。</p>
 */
export async function getPage(
  pageNum = 1,
  pageSize = 10,
  query: MusicQuery = {},
): Promise<PageVO<Music>> {
  if ((await detectMode()) === "static") {
    const data = (await ensureData<PageVO<Music>>("music")) ?? { rows: [], total: 0 };
    const rows = (data.rows ?? []).filter((m) => {
      if (query.title && !m.title.includes(query.title)) return false;
      if (query.singerId != null && m.singerId !== query.singerId) return false;
      if (query.categoryId != null && m.categoryId !== query.categoryId) return false;
      if (query.onlyFavorite && !m.isFavorite) return false;
      return true;
    });
    const start = (pageNum - 1) * pageSize;
    return { rows: rows.slice(start, start + pageSize), total: rows.length };
  }
  return api.post<PageVO<Music>, PageVO<Music>>("/music/page", {
    pageNum,
    pageSize,
    query,
  } satisfies PageDTO<MusicQuery>);
}

/**
 * 曲目总数（首页统计用）。
 *
 * <p>口径与音乐页 {@code getPage} 一致：live 为全库曲目，静态站为
 * {@code music.json} 里已发布的曲目（同步脚本只导出收藏，
 * 见 {@code github-sync.ts} 的「音乐」段）。只取 total，避免为显示
 * 一个数字传输整页数据。</p>
 */
export async function getCount(): Promise<number> {
  const page = await getPage(1, 1);
  return page.total;
}

export async function getById(id: number): Promise<Music | null> {
  if ((await detectMode()) === "static") {
    const data = await ensureData<PageVO<Music>>("music");
    return data?.rows?.find((m) => m.id === id) ?? null;
  }
  return api.get<Music, Music>(`/music/${id}`);
}

/** 批量上传音频；后端会同步登记到 t_media */
export async function upload(files: File[], singerId?: number | null, categoryId?: number | null) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  if (singerId != null) form.append("singerId", String(singerId));
  if (categoryId != null) form.append("categoryId", String(categoryId));
  return api.post<number[], number[]>("/music/batch", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

/**
 * 更新曲目。
 *
 * <p>后端只接受业务字段：{@code title} / {@code singerId} / {@code categoryId} /
 * {@code isFavorite}；{@code fileUrl}、{@code duration}、{@code playCount} 不可改。</p>
 */
export async function update(data: Music) {
  return api.put("/music", {
    id: data.id,
    title: data.title,
    singerId: data.singerId ?? null,
    categoryId: data.categoryId ?? null,
    isFavorite: data.isFavorite ?? false,
  });
}

export async function remove(id: number) {
  return api.delete(`/music/${id}`);
}

/** 切换收藏，返回切换后的状态 */
export async function toggleFavorite(id: number): Promise<boolean | null> {
  if ((await detectMode()) === "static") return null;
  return api.post<boolean, boolean>(`/music/${id}/favorite`);
}

/** 累计播放时长（秒），用于展示「听歌时间」 */
export async function playDuration(): Promise<number> {
  if ((await detectMode()) === "static") return 0;
  return api.get<number, number>("/music/play-duration");
}

/** 静态模式下的随机取曲（无后端，不计入播放统计） */
async function randomFromStatic(): Promise<Music | null> {
  const data = await ensureData<PageVO<Music>>("music");
  if (!data?.rows?.length) return null;
  return data.rows[Math.floor(Math.random() * data.rows.length)];
}

/**
 * 取下一首随机曲目。
 *
 * 实时模式走 /music/play（会更新 last_played，addPlay 决定是否计入播放次数）；
 * 静态模式没有后端，退化为本地随机，不影响任何统计。
 */
export async function nextRandom(
  currentMusicId?: number,
  addPlay = false,
): Promise<Music | null> {
  if ((await detectMode()) === "static") return randomFromStatic();
  const res = await play(currentMusicId, addPlay);
  return res?.nextMusic ?? null;
}
