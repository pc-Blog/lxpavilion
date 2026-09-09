import api from "@/lib/axios";
import type { PageVO, Project, ProjectVO, Technology, PageDTO } from "@/lib/types";
import { detectMode, ensureData } from "@/lib/static-data";

export async function getPublicList(params: PageDTO<Record<string, unknown>>) {
  if ((await detectMode()) === "static") {
    return (await ensureData<PageVO<ProjectVO>>("projects")) ?? { rows: [], total: 0 };
  }
  return api.post<PageVO<ProjectVO>, PageVO<ProjectVO>>("/project/public/page", params);
}

// Admin CRUD
export async function getList(params: PageDTO<Project>) {
  return api.post<PageVO<ProjectVO>, PageVO<ProjectVO>>("/project/page", params);
}

export async function create(data: Project) { return api.post("/project", data); }
export async function update(data: Project) { return api.put("/project", data); }
export async function remove(id: number) { return api.delete(`/project/${id}`); }

// Tech CRUD
export async function getTechList() {
  return api.get<Technology[], Technology[]>("/project/tech/list");
}

export async function createTech(data: Technology) {
  return api.post("/project/tech", data);
}

export async function removeTech(id: number) {
  return api.delete(`/project/tech/${id}`);
}