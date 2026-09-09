import type { ProjectVO } from "@/lib/types";

const THEMES = [
  {
    bg: "from-white/80 to-indigo-50/80 dark:from-indigo-950/40 dark:to-purple-950/40",
    accent: "from-indigo-400 to-purple-400 dark:from-indigo-500/20 dark:to-purple-500/20",
    glow: "bg-indigo-100/60 dark:bg-indigo-500/20",
    text: "bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-indigo-300 dark:to-purple-300",
    border: "border-indigo-200 dark:border-indigo-500/15",
  },
  {
    bg: "from-white/80 to-emerald-50/80 dark:from-emerald-950/40 dark:to-teal-950/40",
    accent: "from-emerald-400 to-teal-400 dark:from-emerald-500/20 dark:to-teal-500/20",
    glow: "bg-emerald-100/60 dark:bg-emerald-500/20",
    text: "bg-gradient-to-br from-emerald-600 to-teal-600 dark:from-emerald-300 dark:to-teal-300",
    border: "border-emerald-200 dark:border-emerald-500/15",
  },
  {
    bg: "from-white/80 to-amber-50/80 dark:from-amber-950/40 dark:to-orange-950/40",
    accent: "from-amber-400 to-orange-400 dark:from-amber-500/20 dark:to-orange-500/20",
    glow: "bg-amber-100/60 dark:bg-amber-500/20",
    text: "bg-gradient-to-br from-amber-600 to-orange-600 dark:from-amber-300 dark:to-orange-300",
    border: "border-amber-200 dark:border-amber-500/15",
  },
  {
    bg: "from-white/80 to-sky-50/80 dark:from-sky-950/40 dark:to-blue-950/40",
    accent: "from-sky-400 to-blue-400 dark:from-sky-500/20 dark:to-blue-500/20",
    glow: "bg-sky-100/60 dark:bg-sky-500/20",
    text: "bg-gradient-to-br from-sky-600 to-blue-600 dark:from-sky-300 dark:to-blue-300",
    border: "border-sky-200 dark:border-sky-500/15",
  },
  {
    bg: "from-white/80 to-rose-50/80 dark:from-rose-950/40 dark:to-pink-950/40",
    accent: "from-rose-400 to-pink-400 dark:from-rose-500/20 dark:to-pink-500/20",
    glow: "bg-rose-100/60 dark:bg-rose-500/20",
    text: "bg-gradient-to-br from-rose-600 to-pink-600 dark:from-rose-300 dark:to-pink-300",
    border: "border-rose-200 dark:border-rose-500/15",
  },
  {
    bg: "from-white/80 to-violet-50/80 dark:from-violet-950/40 dark:to-fuchsia-950/40",
    accent: "from-violet-400 to-fuchsia-400 dark:from-violet-500/20 dark:to-fuchsia-500/20",
    glow: "bg-violet-100/60 dark:bg-violet-500/20",
    text: "bg-gradient-to-br from-violet-600 to-fuchsia-600 dark:from-violet-300 dark:to-fuchsia-300",
    border: "border-violet-200 dark:border-violet-500/15",
  },
];

function getTheme(id: number) {
  return THEMES[id % THEMES.length];
}

export default function ProjectCard({ project }: { project: ProjectVO }) {
  const theme = getTheme(project.id);
  const href = project.githubUrl || "#";

  return (
    <a href={href} target="_blank" rel="noreferrer" className="block group">
      <article className="glass-card overflow-hidden h-full flex flex-col">
        {/* 渐变头部：展示项目名称 */}
        <div className={`relative h-44 overflow-hidden bg-gradient-to-br ${theme.bg}`}>
          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.accent}`} />
          <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl ${theme.glow}`} />
          <div className={`absolute -bottom-6 -left-6 w-28 h-28 rounded-full blur-2xl ${theme.glow}`} />
          <div className={`absolute inset-3 border rounded-xl ${theme.border}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-white/60 via-white/10 to-transparent dark:from-black/60 dark:via-black/20 dark:to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`${theme.text} text-2xl font-black tracking-wide bg-clip-text text-transparent drop-shadow-sm dark:drop-shadow-lg`}>
              {project.name}
            </span>
          </div>
        </div>
        {/* 卡片正文 */}
        <div className="flex-1 p-5 flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {project.name}
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 flex-1">
            {project.summary}
          </p>
          {project.tags && project.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.tags.map((tag) => (
                <span key={tag.id} className="px-2 py-0.5 text-[10px] rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            查看 GitHub 仓库
          </div>
        </div>
      </article>
    </a>
  );
}