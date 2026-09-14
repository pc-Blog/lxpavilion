"use client";

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  type LucideIcon,
} from "lucide-react";

/**
 * 天气图标映射
 *
 * 源项目用 bootstrap-icons（bi bi-sun 等），这里换成博客已有的 lucide-react。
 * 9=中雨 用 CloudDrizzle 表示中等降水（lucide 无 cloud-rain-medium）。
 */
const ICONS: Record<number, LucideIcon> = {
  1: Sun,
  2: CloudSun,
  3: Cloud,
  4: CloudRain,
  9: CloudDrizzle,
  5: CloudRain,
  6: CloudSnow,
  7: CloudFog,
  8: CloudLightning,
};

export function WeatherIcon({
  weather,
  size = 16,
  className,
}: {
  weather: number;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[weather] ?? Cloud;
  return <Icon size={size} className={className} />;
}
