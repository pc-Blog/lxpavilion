"use client";

import { useState, useEffect } from "react";
import { getPublicList } from "@/lib/api/article";

export default function NotesStats() {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    getPublicList({ pageNum: 1, pageSize: 1, query: { isPublished: true } })
      .then((data) => setTotal(data.total))
      .catch(() => setTotal(0));
  }, []);

  return (
    <span className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
      {total !== null ? total : "—"}
    </span>
  );
}
