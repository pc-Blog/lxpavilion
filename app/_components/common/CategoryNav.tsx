"use client";

import type { Category } from "@/lib/types";

interface Props {
  categories: Category[];
  activeId?: number;
  onSelect: (id: number | undefined) => void;
}

export default function CategoryNav({ categories, activeId, onSelect }: Props) {
  return (
    <div className="overflow-x-auto hide-scrollbar">
      <div className="flex gap-2">
        <button
          onClick={() => onSelect(undefined)}
          className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
            !activeId ? "bg-indigo-500 text-white" : "glass-btn"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
              activeId === cat.id ? "bg-indigo-500 text-white" : "glass-btn"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}
