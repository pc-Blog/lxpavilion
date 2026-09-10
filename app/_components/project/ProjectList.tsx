"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [search, setSearch] = useState("");
  const [allProjects, setAllProjects] = useState<ProjectVO[] | null>(null);
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

  // 首次输入搜索词时拉取全量数据，客户端过滤（与 ProjectsMatrix 一致）
  useEffect(() => {
    if (search.trim() && allProjects === null) {
      getPublicList({ pageNum: 1, pageSize: 999 })
        .then((d) => setAllProjects(d.rows))
        .catch(() => setAllProjects([]));
    }
  }, [search, allProjects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return (allProjects ?? []).filter((p) =>
      p.githubUrl.toLowerCase().includes(q) ||
      (p.tags || []).some((t) => t.name.toLowerCase().includes(q))
    );
  }, [search, allProjects]);

  const display = filtered ?? projects;
  const searching = search.trim() !== "";

  return (
    <div className="w-full">
      {/* 标题区 */}
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-widest text-slate-900 dark:text-white mb-4">
          Projects
        </h1>
        <p className="text-slate-600 dark:text-slate-400 font-serif">
          Code, experiments, and builds.
        </p>
      </div>

      {/* 搜索框 */}
      <div className="mb-10 flex justify-center w-full">
        <div className="relative w-full max-w-lg">
          <input
            type="text"
            placeholder="搜索 GitHub 地址或标签..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-full px-6 py-3 pl-12 text-slate-800 dark:text-white shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder-slate-400 dark:placeholder-slate-500"
          />
          <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {loading || (searching && allProjects === null) ? (
        <Loading />
      ) : display.length === 0 ? (
        <div className="text-center py-20 text-slate-500 dark:text-slate-400 font-serif">
          {searching ? `云端尚未建立代号为 [${search}] 的档案...` : "No projects yet"}
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
          <AnimatePresence mode="popLayout">
            {display.map((p) => (
              <motion.div
                layout
                key={p.id}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="h-full"
              >
                <ProjectCard project={p} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {!searching && total > pageSize && (
        <Pagination pageNum={pageNum} pageSize={pageSize} total={total} onChange={setPageNum} />
      )}
    </div>
  );
}