"use client";

import type { Tag } from "@/lib/types";

interface Props {
  tags: Tag[];
  activeId?: number;
  onSelect: (id: number | undefined) => void;
}

export default function TagCloud({ tags, activeId, onSelect }: Props) {
  const perRow = Math.ceil(tags.length / 3);
  const rows = [
    [{ id: undefined, name: "All" } as Tag, ...tags.slice(0, perRow)],
    tags.slice(perRow, perRow * 2),
    tags.slice(perRow * 2),
  ].filter((r) => r.length > 0);

  return (
    <div className="overflow-x-auto hide-scrollbar">
      <div className="flex flex-col gap-y-1">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-x-1.5">
            {row.map((tag) => (
              <button
                key={tag.id ?? "all"}
                onClick={() => onSelect(tag.id)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold transition-all duration-300 whitespace-nowrap ${
                  (tag.id === undefined ? !activeId : activeId === tag.id)
                    ? "bg-indigo-500 text-white"
                    : "glass-btn"
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
