"use client";

import { useState, useEffect } from "react";
import type { Skill } from "@/lib/types";
import { getList } from "@/lib/api/skill";
import Loading from "@/app/_components/common/Loading";

export default function SkillBar() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getList(undefined, 1, 200)
      .then((data) => setSkills(data.rows.sort((a, b) => b.proficiency - a.proficiency)))
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (skills.length === 0) return <p className="text-slate-400 dark:text-slate-500 text-center py-10">No skills recorded yet.</p>;

  return (
    <div className="flex flex-col gap-4">
      {skills.map((skill) => (
        <div key={skill.id} className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{skill.name}</span>
            <span className="text-xs font-bold text-indigo-500">{skill.proficiency}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 transition-all duration-1000"
              style={{ width: `${skill.proficiency}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
