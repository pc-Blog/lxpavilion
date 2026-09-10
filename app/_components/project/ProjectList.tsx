"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GitHubRepoInfo, ProjectVO } from "@/lib/types";
import { getPublicList } from "@/lib/api/project";
import { fetchRepoInfo, fetchRepoLanguages } from "@/lib/github-repo";
import ProjectCard from "./ProjectCard";
import Loading from "../common/Loading";

export interface ProjectRepoInfo extends GitHubRepoInfo {
  languages: Record<string, number> | null;
}

export default function ProjectList() {
  const [projects, setProjects] = useState<ProjectVO[]>([]);
  const [infos, setInfos] = useState<Record<number, ProjectRepoInfo | null>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // 一次性加载：后端列表 + 全部仓库信息（含语言占比），全部就绪后才渲染
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getPublicList({ pageNum: 1, pageSize: 999 });
        if (cancelled) return;
        const rows = data.rows;
        setProjects(rows);

        const settled = await Promise.allSettled(
          rows.map(async (p) => {
            const [info, languages] = await Promise.all([
              fetchRepoInfo(p.githubUrl),
              fetchRepoLanguages(p.githubUrl),
            ]);
            return { id: p.id, info: info ? { ...info, languages } : null };
          })
        );
        if (cancelled) return;

        const map: Record<number, ProjectRepoInfo | null> = {};
        rows.forEach((p, i) => {
          const r = settled[i];
          map[p.id] = r.status === "fulfilled" ? r.value.info : null;
        });
        setInfos(map);
      } catch {
        if (!cancelled) {
          setProjects([]);
          setInfos({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 内存筛选：仓库名称 / 描述 / 官方 Topics / GitHub 地址
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const info = infos[p.id];
      const haystacks = [
        p.githubUrl,
        info?.name,
        info?.description,
        ...(info?.topics || []),
      ].filter((s): s is string => Boolean(s)).map((s) => s.toLowerCase());
      return haystacks.some((s) => s.includes(q));
    });
  }, [search, projects, infos]);

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
            placeholder="搜索仓库名称、描述或标签..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-full px-6 py-3 pl-12 text-slate-800 dark:text-white shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder-slate-400 dark:placeholder-slate-500"
          />
          <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500 dark:text-slate-400 font-serif">
          {searching ? `云端尚未建立代号为 [${search}] 的档案...` : "No projects yet"}
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
          <AnimatePresence mode="popLayout">
            {filtered.map((p) => (
              <motion.div
                layout
                key={p.id}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="h-full"
              >
                <ProjectCard project={p} info={infos[p.id] ?? null} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}