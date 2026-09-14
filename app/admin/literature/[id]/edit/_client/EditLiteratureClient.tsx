"use client";

import { useState, useEffect, use } from "react";
import type { Literature } from "@/lib/types";
import { getAdminDetail, update } from "@/lib/api/literature";
import LiteratureForm from "@/app/_components/admin/LiteratureForm";

export default function EditLiteratureClient(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const [item, setItem] = useState<Literature | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminDetail(Number(id))
      .then(setItem)
      .catch(() => setItem(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mt-10" />;
  }

  if (!item) {
    return <div className="text-center py-24 text-sm text-slate-400">作品不存在。</div>;
  }

  return (
    <LiteratureForm
      initial={item}
      onSubmit={async (payload: Literature) => {
        await update({ ...payload, id: Number(id) });
      }}
    />
  );
}
