"use client";

import BackButton from "@/app/_components/article/BackButton";
import CommentSection from "@/app/_components/comment/CommentSection";

const exampleWishes = [
  { id: 1, title: "🔐 高级密码生成与管理工具", desc: "支持自定义规则、强度检测、批量生成，可导出为文本或 JSON", votes: 24 },
  { id: 2, title: "📑 PDF 批量水印工具", desc: "为多个 PDF 文件一键添加文字水印或图片水印，位置可调", votes: 17 },
  { id: 3, title: "🖼️ 图片背景移除", desc: "纯前端移除背景，支持透明背景或自定义颜色填充", votes: 9 },
];

export default function WishesPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <BackButton />
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">
          💭 请愿台
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          写下你想要的工具或功能，点赞投票，呼声高的优先实现
        </p>
      </div>

      {/* 示例心愿 */}
      <div className="mb-8">
        <h2 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-4">✨ 心愿示例</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {exampleWishes.map((w) => (
            <div key={w.id}
              className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5 transition-all duration-500 hover:scale-[1.02] group">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2">{w.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">{w.desc}</p>
              <div className="inline-flex items-center gap-1 text-xs font-bold text-indigo-500">
                👍 {w.votes} 票
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 规则卡片 */}
      <div className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5 mb-8">
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1">📌 如何参与</h3>
        <div className="grid gap-2">
          {[
            "在评论区发表新评论，即视为提交一个新请愿",
            "给已有评论点赞 👍，即为该请愿投票",
            "获得足够票数后会纳入重点开发区",
            "建议先浏览已有请愿再提交，避免重复",
          ].map((text, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="text-indigo-400 mt-0.5">◆</span>
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* 评论区 */}
      <div className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5">
        <CommentSection path="wishes" />
      </div>
    </div>
  );
}
