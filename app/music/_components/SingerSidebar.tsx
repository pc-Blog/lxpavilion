"use client";

import { assetUrl } from "@/lib/asset-url";
import { siteConfig } from "@/lib/siteConfig";
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
      {/* 列表头部 */}
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

      {/* 歌手列表 */}
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
          <button onClick={onManageSingers} className="aside-manager-btn">
            管理歌手
          </button>
          <button onClick={onManageCategories} className="aside-manager-btn">
            管理分类
          </button>
        </div>
      )}

      <style jsx>{`
        .aside-manager-btn {
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          color: rgba(220, 230, 240, 0.9);
          background-color: rgba(65, 65, 75, 0.6);
          border: 0.5px solid rgba(120, 230, 255, 0.2);
          backdrop-filter: blur(8px);
          transition: all 0.25s ease;
        }
        .aside-manager-btn:hover {
          background-color: rgba(120, 230, 255, 0.18);
          border-color: rgba(120, 230, 255, 0.35);
          color: rgba(120, 230, 255, 1);
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}

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
      className="flex items-center w-full px-1.5 py-0.5 mb-2.5 rounded-lg transition-all duration-300"
      style={{
        backgroundColor: active ? "rgba(70,165,255,0.25)" : "transparent",
        borderLeft: active
          ? "3px solid rgba(120,230,255,0.6)"
          : "3px solid transparent",
        boxShadow: active
          ? "0 0 15px rgba(70,165,255,0.25), inset 0 0 10px rgba(120,230,255,0.15)"
          : "none",
      }}
    >
      <span
        className="flex-shrink-0 w-[30px] h-[30px] mr-4 rounded-[10%] overflow-hidden"
        style={{
          border: "0.5px solid rgba(120,230,255,0.2)",
          boxShadow:
            "0 0 8px rgba(120,230,255,0.1), inset 0 0 6px rgba(120,230,255,0.05)",
          backgroundColor: "rgba(45,45,55,0.5)",
        }}
      >
        <img
          src={assetUrl(pictureUrl || siteConfig.defaultSingerCover)}
          alt=""
          className="w-full h-full object-cover"
        />
      </span>
      <span
        className="flex-1 min-w-0 text-left text-base font-medium truncate transition-all duration-300"
        style={{
          color: active ? "rgba(120,230,255,0.95)" : "rgba(220,230,240,0.9)",
          textShadow: active ? "0 0 6px rgba(120,230,255,0.35)" : "none",
        }}
      >
        {label}
      </span>
    </button>
  );
}
