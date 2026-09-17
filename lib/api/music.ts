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

/**
 * 选曲 + 计数合并接口。
 *
 * @param currentMusicId 当前播放的曲目 id；首次播放传 undefined
 * @param addPlay true=自动切歌（计入播放次数与时长），false=手动切歌（只更新 last_played）
 */
export async function play(
  currentMusicId?: number,
  addPlay = false,
): Promise<PlayResult | null> {
  if ((await detectMode()) === "static") return null;
  return api.post<PlayResult, PlayResult>("/music/play", {
    currentMusicId,
    playMode: "random",
    addPlay,
    pageSize: PAGE_SIZE,
    query: FAVORITE_ONLY,
  });
}

export async function getPage(params: PageDTO<Music>) {
  return api.post<PageVO<Music>, PageVO<Music>>("/music/page", params);
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
