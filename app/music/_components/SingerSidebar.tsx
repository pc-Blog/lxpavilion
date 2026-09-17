"use client";

import { assetUrl } from "@/lib/asset-url";
import { siteConfig } from "@/lib/siteConfig";
import { Picture } from "./icons";
import type { Singer } from "@/lib/types";

interface Props {
  singers: Singer[];
  activeSingerId: number | null;
  onSelect: (id: number | null) => void;
  /** 仅本地展示管理按钮 */
  isLive: boolean;
  onManageSingers: () => void;
  onManageCategories: () => void;
}

/**
 * 左侧歌手列表。
 *
 * <p>复刻源项目 {@code views/singerSide/}：点击歌手即按 {@code singerId} 过滤曲目，
 * 高亮当前选中项。源项目的「设置」按钮已移除（其检查文件接口在后端不存在）。</p>
 *
 * <p>样式取自 {@code SingerSideList.vue} 与 {@code SingerSideCard.vue}：
 * 列表头带下分隔线、头像 30×30 圆角 10%、选中态左侧 3px 霓虹竖条。</p>
 */
export default function SingerSidebar({
  singers,
  activeSingerId,
  onSelect,
  isLive,
  onManageSingers,
  onManageCategories,
}: Props) {
  return (
    <div className="flex flex-col h-full p-3">
      {/* 列表头部（源 .list-header） */}
      <div
        className="flex justify-between items-center mb-4 pb-2"
        style={{ borderBottom: "1px solid rgba(120,230,255,0.15)" }}
      >
        <h3
          className="m-0 text-lg font-semibold"
          style={{
            color: "rgba(220,230,240,0.9)",
            textShadow: "0 0 4px rgba(120,230,255,0.2)",
          }}
        >
          歌手列表
        </h3>
        <span className="text-xs" style={{ color: "rgba(180,200,220,0.7)" }}>
          共 {singers.length} 位歌手
        </span>
      </div>

      {/* 列表（源 el-scrollbar） */}
      <div className="flex-1 overflow-y-auto pr-1">
        <SideRow
          label="全部"
          active={activeSingerId === null}
          onClick={() => onSelect(null)}
        />
        {singers.map((s) => (
          <SideRow
            key={s.id}
            label={s.name}
            pictureUrl={s.pictureUrl}
            active={activeSingerId === s.id}
            onClick={() => onSelect(s.id)}
          />
        ))}
      </div>

      {/* 管理入口：仅本地可见 */}
      {isLive && (
        <div
          className="flex flex-col gap-2 pt-3 mt-2"
          style={{ borderTop: "1px solid rgba(120,230,255,0.15)" }}
        >
          <button onClick={onManageSingers} className="mt-btn">
            管理歌手
          </button>
          <button onClick={onManageCategories} className="mt-btn">
            管理分类
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 单个歌手条目（源 SingerSideCard.vue）。
 *
 * <p>选中态：背景 rgba(70,165,255,0.25) + 左侧 3px 霓虹竖条 + 内外双层辉光；
 * 悬浮态：右移 4px，名字变霓虹色。</p>
 */
function SideRow({
  label,
  pictureUrl,
  active,
  onClick,
}: {
  label: string;
  pictureUrl?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`mt-side-item flex items-center w-full px-1.5 py-0.5 mb-2.5 text-left${
        active ? " active" : ""
      }`}
      style={{
        backgroundColor: active ? "rgba(70,165,255,0.25)" : "transparent",
        borderLeft: active
          ? "3px solid rgba(120,230,255,0.6)"
          : "3px solid transparent",
      }}
    >
      {/* 头像 30×30，源 .singer-image-container */}
      <span
        className="mt-avatar flex-shrink-0 w-[30px] h-[30px] mr-4 rounded-[10%] overflow-hidden"
        style={{ backgroundColor: "rgba(45,45,55,0.5)" }}
      >
        <img
          src={assetUrl(pictureUrl || siteConfig.defaultSingerCover)}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => {
            // 兜底再兜底：默认图也加载失败时，退化为图标占位
            e.currentTarget.style.display = "none";
            e.currentTarget.nextElementSibling?.classList.remove("hidden");
          }}
        />
        <span
          className="hidden w-full h-full items-center justify-center"
          style={{ color: "rgba(120,230,255,0.5)" }}
        >
          <Picture size={16} />
        </span>
      </span>

      <span
        className="mt-side-name flex-1 min-w-0 text-base font-medium truncate"
        style={{
          color: active ? "rgba(120,230,255,0.9)" : "rgba(220,230,240,0.9)",
          textShadow: active ? "0 0 6px rgba(120,230,255,0.35)" : "none",
        }}
      >
        {label}
      </span>
    </button>
  );
}
