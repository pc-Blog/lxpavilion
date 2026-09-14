import api from "@/lib/axios";
import type { OpMusic, PageVO } from "@/lib/types";
import { detectMode, ensureData } from "@/lib/static-data";

export async function getMusic() {
  if ((await detectMode()) === "static") {
    const data = await ensureData<PageVO<OpMusic>>("music");
    if (!data || !data.rows || data.rows.length === 0) return null;
    return data.rows[Math.floor(Math.random() * data.rows.length)];
  }
  return api.get<OpMusic, OpMusic>("/op/music");
}
