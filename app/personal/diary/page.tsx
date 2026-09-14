import type { Metadata } from "next";
import DiaryClient from "./_components/DiaryClient";

export const metadata: Metadata = {
  title: "日记",
  description: "按天记录的活动日志 —— 仅本地可见。",
  // 私人记录页，不参与搜索引擎收录
  robots: { index: false, follow: false },
};

export default function DiaryPage() {
  return (
    <div className="flex-1 w-full min-h-screen py-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-10">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">
          📔 日记
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          按天记录的活动日志 · 仅本地可见
        </p>
      </div>

      <DiaryClient />
    </div>
  );
}
