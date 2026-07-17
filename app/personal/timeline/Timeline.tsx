"use client";

import { useState, useEffect } from "react";
import type { Timeline as TimelineType } from "@/lib/types";
import { getList } from "@/lib/api/timeline";
import Loading from "@/app/_components/common/Loading";

export default function Timeline() {
  const [items, setItems] = useState<TimelineType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getList(undefined, 1, 200)
      .then((data) => setItems(data.rows.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (items.length === 0) return <p className="text-slate-400 dark:text-slate-500 text-center py-10">No timeline entries yet.</p>;

  return (
    <div className="relative pl-8 before:absolute before:left-[16px] before:top-[10px] before:bottom-0 before:w-0.5 before:bg-gradient-to-b before:from-indigo-400 before:to-purple-400 before:rounded-full">
      {items.map((item, i) => (
        <div key={item.id || i} className="relative pb-10 last:pb-0">
          <div className="absolute left-[-1.35rem] top-1 w-3 h-3 rounded-full bg-white dark:bg-slate-900 border-2 border-indigo-400 ring-2 ring-indigo-200/50 dark:ring-indigo-800/50" />
          <div className="glass-card p-5">
            <time className="text-xs font-bold text-indigo-500 dark:text-indigo-400">
              {item.eventDate}
            </time>
            <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
              {item.title}
            </h3>
            {item.description && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {item.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
