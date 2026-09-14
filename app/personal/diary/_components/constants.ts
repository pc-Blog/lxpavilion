/**
 * 日记模块常量
 *
 * 天气与分类都是「受控枚举」——取值固定在代码里，数据库只存数字，
 * 因此没有对应的枚举表，改文案也不需要迁移数据。
 *
 * 天气的中文措辞沿用源项目（OmniPavilion diary 模块）；
 * 9=中雨 为后补档位，刻意不插位，避免与已有数据冲突（5=大雨、6=雪）。
 */

export interface Option {
  value: number;
  label: string;
}

/** 天气枚举 —— 与后端 DiaryServiceImpl.checkWeather 的允许范围一致 */
export const WEATHER = {
  SUNNY: 1,
  CLOUDY: 2,
  OVERCAST: 3,
  LIGHT_RAIN: 4,
  HEAVY_RAIN: 5,
  SNOW: 6,
  FOG: 7,
  LIGHTNING: 8,
  MODERATE_RAIN: 9,
} as const;

export const WEATHER_LABELS: Record<number, string> = {
  1: "晴天",
  2: "多云",
  3: "阴天",
  4: "小雨",
  5: "大雨",
  6: "下雪",
  7: "雾天",
  8: "雷雨",
  9: "中雨",
};

/** 天气下拉选项，顺序按「常用优先」，中雨紧挨雨量档 */
export const WEATHER_OPTIONS: Option[] = [
  { value: 1, label: "晴天" },
  { value: 2, label: "多云" },
  { value: 3, label: "阴天" },
  { value: 4, label: "小雨" },
  { value: 9, label: "中雨" },
  { value: 5, label: "大雨" },
  { value: 6, label: "下雪" },
  { value: 7, label: "雾天" },
  { value: 8, label: "雷雨" },
];

/** 活动分类枚举 —— 与后端 DiaryServiceImpl 的 CATEGORY_MIN/MAX 一致 */
export const CATEGORY_LABELS: Record<number, string> = {
  1: "学习",
  2: "工作",
  3: "生活",
  4: "运动",
  5: "娱乐",
  6: "社交",
};

/** 分类色板，用于活动条目的色块与统计图表 */
export const CATEGORY_COLORS: Record<number, string> = {
  1: "#6BCB77",
  2: "#FF9F43",
  3: "#4D96FF",
  4: "#9B59B6",
  5: "#FF6B8A",
  6: "#FFD93D",
};

export const CATEGORY_OPTIONS: Option[] = [1, 2, 3, 4, 5, 6].map((v) => ({
  value: v,
  label: CATEGORY_LABELS[v],
}));

export function weatherLabel(weather: number): string {
  return WEATHER_LABELS[weather] ?? "未知";
}

export function categoryLabel(category: number): string {
  return CATEGORY_LABELS[category] ?? "其他";
}

export function categoryColor(category: number): string {
  return CATEGORY_COLORS[category] ?? "#94a3b8";
}

/** 把 YYYY-MM-DD 格式化为「2026年9月11日 星期五」 */
export function formatDiaryDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

/** 取日期中的「天」，用于卡片上的大号数字 */
export function dayOfMonth(dateStr: string): number {
  return Number(dateStr.slice(8, 10));
}

/** 今天的 YYYY-MM-DD（本地时区，不能用 toISOString 会偏到 UTC） */
export function todayString(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
