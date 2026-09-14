"use client";

import type { Literature } from "@/lib/types";
import { create } from "@/lib/api/literature";
import LiteratureForm from "@/app/_components/admin/LiteratureForm";

export default function NewLiteraturePage() {
  return (
    <LiteratureForm
      onSubmit={async (payload: Literature) => { await create(payload); }}
    />
  );
}
