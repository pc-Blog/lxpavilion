"use client";

import TrackCard from "./TrackCard";
import type { Music } from "@/lib/types";

interface Props {
  rows: Music[];
  loading: boolean;
  isLive: boolean;
  onEdit: (m: Music) => void;
  onToggleFavorite: (m: Music) => void;
}

/** 曲目滚动列表，对应源项目 views/song/com/SongList.vue */
export default function TrackList({ rows, loading, isLive, onEdit, onToggleFavorite }: Props) {
  return (
    <div className="overflow-hidden rounded-lg" style={{ maxHeight: "60%" }}>
      <div
        className="h-full overflow-y-auto p-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: "transparent transparent" }}
      >
        {rows.map((m) => (
          <TrackCard
            key={m.id}
            music={m}
            isLive={isLive}
            onEdit={() => onEdit(m)}
            onToggleFavorite={() => onToggleFavorite(m)}
          />
        ))}

        {!loading && rows.length === 0 && (
          <div
            className="py-12 text-center text-sm"
            style={{ color: "rgba(180,200,220,0.7)" }}
          >
            暂无曲目
          </div>
        )}
      </div>
    </div>
  );
}
