"use client";

import { useState, useEffect } from "react";
import type { ProjectVO } from "@/lib/types";
import { getPublicList } from "@/lib/api/project";
import ProjectCard from "./ProjectCard";
import Pagination from "../common/Pagination";
import Loading from "../common/Loading";

export default function ProjectList() {
  const [projects, setProjects] = useState<ProjectVO[]>([]);
  const [total, setTotal] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 9;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getPublicList({ pageNum, pageSize });
        if (!cancelled) {
          setProjects(data.rows);
          setTotal(data.total);
        }
      } catch {
        if (!cancelled) {
          setProjects([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pageNum]);

  return (
    <div>
      <div className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">Projects</div>
      <p className="text-slate-500 dark:text-slate-400 mb-8">Code, experiments, and builds.</p>

      {loading ? (
        <Loading />
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <p className="text-lg">No projects yet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
          <Pagination pageNum={pageNum} pageSize={pageSize} total={total} onChange={setPageNum} />
        </>
      )}
    </div>
  );
}
