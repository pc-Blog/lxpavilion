"use client";

import Timeline from "./Timeline";
import SkillBar from "./SkillBar";

export default function TimelineClient() {
  return (
    <>
      <div className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">Timeline</div>
      <p className="text-slate-500 dark:text-slate-400 mb-8">Learning milestones &amp; skill set.</p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7">
          <h2 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-4">Milestones</h2>
          <Timeline />
        </div>
        <div className="lg:col-span-5">
          <h2 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-4">Skills</h2>
          <SkillBar />
        </div>
      </div>
    </>
  );
}
