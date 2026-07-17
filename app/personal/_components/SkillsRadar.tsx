"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from "recharts";
import { getList } from "@/lib/api/skill";
import type { Skill } from "@/lib/types";

interface ChartData {
  skill: string;
  value: number;
}

export default function SkillsRadar() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getList(undefined, 1, 200)
      .then((data) => {
        const sorted = data.rows.sort((a, b) => b.proficiency - a.proficiency);
        setSkills(sorted.slice(0, 8));
      })
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  }, []);

  const data: ChartData[] = skills.map((s) => ({
    skill: s.name,
    value: s.proficiency,
  }));

  return (
    <div className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5">
      <Link href="/personal/timeline" className="group">
        <h2 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-4 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
          🛠️ 技能星空 →
        </h2>
      </Link>

      {loading ? (
        <div className="flex items-center justify-center h-[350px]">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-16">暂无技能数据</p>
      ) : (
        <ResponsiveContainer width="100%" height={360}>
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="rgba(129,140,248,0.3)" strokeDasharray="3 3" />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "rgba(129,140,248,0.5)", fontSize: 10 }}
              axisLine={false}
            />
            <PolarAngleAxis
              dataKey="skill"
              tick={{
                fill: "#818cf8",
                fontSize: 11,
                fontWeight: 600,
              }}
              axisLine={{ stroke: "rgba(129,140,248,0.2)" }}
            />
            <Tooltip
              contentStyle={{
                background: "#1e293b",
                border: "none",
                borderRadius: 8,
                fontSize: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
              itemStyle={{ color: "#f8fafc" }}
              labelStyle={{ color: "#94a3b8", fontWeight: "bold" }}
              formatter={(value) => [`${value ?? 0}%`, "熟练度"]}
            />
            <Radar
              dataKey="value"
              stroke="#818cf8"
              strokeWidth={2}
              fill="#818cf8"
              fillOpacity={0.25}
              animationDuration={1000}
            />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
