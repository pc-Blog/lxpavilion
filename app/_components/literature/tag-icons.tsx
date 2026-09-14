import { type FC } from "react";
import { Feather, Music, BookOpen, PenLine, FileText, ScrollText, Sparkles, Hammer, Library } from "lucide-react";

export interface TagIconInfo {
  Icon: FC<{ className?: string; strokeWidth?: number }>;
  color: string;
}

/** 文学分类图标映射，键为 t_category 中 type='LITERATURE' 的分类名 */
export const tagIconMap: Record<string, TagIconInfo> = {
  "诗": { Icon: Feather, color: "text-pink-500" },
  "词": { Icon: Music, color: "text-violet-500" },
  "辞": { Icon: BookOpen, color: "text-indigo-500" },
  "文言": { Icon: ScrollText, color: "text-teal-500" },
  "散文": { Icon: PenLine, color: "text-sky-500" },
  "文散": { Icon: FileText, color: "text-amber-500" },
  "赋": { Icon: Sparkles, color: "text-rose-500" },
  "百艺精工": { Icon: Hammer, color: "text-orange-500" },
  "社会科学": { Icon: Library, color: "text-cyan-500" },
};
