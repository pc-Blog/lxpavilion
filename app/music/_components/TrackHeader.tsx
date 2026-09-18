"use client";

import { useEffect, useState } from "react";
import { assetUrl } from "@/lib/asset-url";
import { siteConfig } from "@/lib/siteConfig";
import { useAudioPlayer } from "@/lib/useAudioPlayer";
import { VideoPlay, VideoPause, Search, Plus, Star, StarFilled, Location } from "./icons";
import Select from "./Select";
import type { MusicCategory } from "@/lib/types";

interface Props {
  /** 当前播放曲目 id，「定位歌曲」用 */
  currentMusicId: number | null;
  isLive: boolean;
  title: string;
  onTitleChange: (v: string) => void;
  categoryId: number | null;
  onCategoryChange: (v: number | null) => void;
  onlyFavorite: boolean;
  onToggleFavoriteFilter: () => void;
  categories: MusicCategory[];
  onAdd: () => void;
  onLocate: (id: number) => void;
}

/**
 * 曲目区头部。
 *
 * <p>复刻源项目 {@code views/song/com/SongHead.vue}：120px 大封面 + 歌手名 /
 * 歌名 + 圆形播放键 + 搜索框 + 分类下拉 + 收藏筛选 + 添加歌曲。
 * 源项目的「批量删除」已按要求整体移除。</p>
 *
 * <p>样式取自源文件：封面圆角 12px 带霓虹描边与悬浮放大；
 * 播放键 44×44 圆形；输入框/下拉用 {@code .mt-input}/{@code .mt-select}。</p>
 */
export default function TrackHeader({
  currentMusicId,
  isLive,
  title,
  onTitleChange,
  categoryId,
  onCategoryChange,
  onlyFavorite,
  onToggleFavoriteFilter,
  categories,
  onAdd,
  onLocate,
}: Props) {
  const { currentTrack, isPlaying, toggle } = useAudioPlayer();

  // 搜索防抖，对应源项目对搜索条件的 watch
  const [draft, setDraft] = useState(title);
  useEffect(() => {
    const t = setTimeout(() => onTitleChange(draft), 300);
    return () => clearTimeout(t);
  }, [draft, onTitleChange]);

  return (
    <div className="flex items-end gap-5 p-4" style={{ height: 140 }}>
      {/* 大封面：120×120，圆角 12px（源 .song-cover） */}
      <div className="mt-cover flex-shrink-0 w-[120px] h-[120px] rounded-xl">
        <img
          src={assetUrl(currentTrack?.singerPictureUrl || siteConfig.defaultSingerCover)}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex flex-col justify-between h-full flex-grow min-w-0">
        {/* 歌手名 + 定位按钮 + 歌名（源 .artist-info） */}
        <div className="mb-auto">
          <h1
            className="flex items-center gap-2 m-0 text-2xl font-bold leading-tight"
            style={{
              color: "rgba(220,230,240,0.95)",
              textShadow: "0 0 6px rgba(120,230,255,0.3)",
            }}
          >
            {currentTrack?.singerName || "佚名"}
            <button
              onClick={() => currentMusicId && onLocate(currentMusicId)}
              disabled={!currentMusicId}
              title="定位歌曲"
              className="mt-btn mt-btn-info mt-btn-circle"
              style={{ width: 28, height: 28, padding: 0, fontSize: 15 }}
            >
              <Location size={15} />
            </button>
          </h1>
          <h2
            className="mt-1 mb-0 text-lg font-normal leading-snug truncate"
            style={{ color: "rgba(200,220,240,0.85)" }}
          >
            {currentTrack?.title}
          </h2>
        </div>

        {/* 操作按钮组（源 .action-buttons） */}
        <div className="flex items-center flex-wrap gap-3 pt-2.5">
          {/* 播放键：44×44 圆形 */}
          <button
            onClick={toggle}
            className={`mt-btn mt-btn-circle ${
              isPlaying ? "mt-btn-success" : "mt-btn-primary"
            }`}
            style={{ width: 44, height: 44 }}
          >
            {isPlaying ? <VideoPause size={20} /> : <VideoPlay size={20} />}
          </button>

          {/* 搜索框 */}
          <div className="relative flex-1 min-w-[100px] max-w-[500px]">
            <Search
              size={16}
              className="mt-input-icon absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="搜索歌曲..."
              className="mt-input w-full"
              style={{ paddingLeft: 34 }}
            />
          </div>

          {/* 分类下拉：源 SongHead.vue:236-249 为 el-select（clearable + filterable）。
              clearable 保留「清空筛选」的入口，filterable 未实现（原生 select 也没有）。 */}
          <Select
            className="w-[100px]"
            placeholder="分类"
            ariaLabel="分类"
            clearable
            value={categoryId === null ? "" : String(categoryId)}
            options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
            onChange={(v) => onCategoryChange(v === "" ? null : Number(v))}
          />

          {/* 收藏筛选：源项目用 Star / StarFilled 切换 */}
          <button
            onClick={onToggleFavoriteFilter}
            className={`mt-btn ${onlyFavorite ? "mt-btn-danger" : ""}`}
            style={{ height: 35 }}
          >
            {onlyFavorite ? <StarFilled size={15} /> : <Star size={15} />}
            <span>收藏</span>
          </button>

          {/* 添加歌曲：仅本地 */}
          {isLive && (
            <button
              onClick={onAdd}
              className="mt-btn mt-btn-primary"
              style={{ height: 35 }}
            >
              <Plus size={15} />
              <span>添加歌曲</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
