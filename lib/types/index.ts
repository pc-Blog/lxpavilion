// ========== Unified response ==========

export interface Result<T> {
  code: number;
  message: string;
  data: T;
}

export interface PageVO<T> {
  total: number;
  rows: T[];
}

export interface SortField {
  field: string;
  direction: "ASC" | "DESC";
}

export interface PageDTO<T> {
  pageNum: number;
  pageSize: number;
  sortFields?: SortField[];
  query?: T;
}

// ========== Auth ==========

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  nickname?: string;
  email?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// ========== User ==========

export interface User {
  id: number;
  username: string;
  password?: string;
  nickname?: string;
  avatar?: string;
  email?: string;
  githubId?: string;
  deleted?: number;
  createTime?: string;
  updateTime?: string;
  loginTime?: string;
}

// ========== Tag ==========

export interface Tag {
  id?: number;
  name: string;
  deleted?: number;
  createTime?: string;
  updateTime?: string;
}

export interface TagBrief {
  id: number;
  name: string;
}

// ========== Category ==========

export type CategoryType = "ARTICLE" | "LITERATURE";

export interface Category {
  id?: number;
  name: string;
  type: CategoryType;
  sortOrder?: number;
  deleted?: number;
  createTime?: string;
  updateTime?: string;
}

// ========== Article ==========

export interface ArticleQueryDTO {
  categoryId?: number;
  tagId?: number;
  keyword?: string;
  series?: string;
  isPublished?: boolean;
}

export interface ArticleVO {
  id: number;
  title: string;
  summary: string;
  coverImage?: string;
  categoryId: number;
  categoryName: string;
  tags: TagBrief[];
  isPinned: number;
  isPublished: number;
  viewCount: number;
  series?: string;
  createdAt: string;
  updateTime?: string;
}

export interface SeriesGroup {
  series: string;
  count: number;
  coverImage?: string;
  summary?: string;
}

export interface SeriesBrief {
  series: string;
  coverImage?: string;
}

export interface GroupedPageVO<T> {
  total: number;
  articleTotal: number;
  rows: T[];
}

export interface GroupedItem {
  type: "article" | "series";
  // type = "article" 时
  article?: ArticleVO;
  // type = "series" 时
  series?: string;
  seriesArticleCount?: number;
  seriesArticles?: ArticleVO[];
}

export interface ArticleNav {
  id: number;
  title: string;
}

export interface ArticleDetailVO extends ArticleVO {
  content: string;
  prev: ArticleNav | null;
  next: ArticleNav | null;
}

export interface Article {
  id?: number;
  title: string;
  summary?: string;
  content: string;
  coverImage?: string;
  categoryId: number;
  isPinned?: number;
  isPublished?: number;
  viewCount?: number;
  createdAt?: string;
  deleted?: number;
  createTime?: string;
  updateTime?: string;
}

export interface ArticleSaveRequest extends Article {
  tagIds: number[];
}

// ========== Project ==========

export interface GitHubRepoInfo {
  name: string;
  description: string;
  stargazersCount: number;
  forksCount: number;
  language: string | null;
  pushedAt: string | null;
  createdAt: string | null;
  topics: string[];
  license: string | null;
  homepage: string | null;
  archived: boolean;
}

export interface Project {
  id?: number;
  githubUrl: string;
  deleted?: number;
  createTime?: string;
  updateTime?: string;
}

export interface ProjectVO {
  id: number;
  githubUrl: string;
  createTime?: string;
  updateTime?: string;
}

// ========== Comment ==========

export interface Comment {
  id?: number;
  articleId: number;
  authorName?: string;
  authorEmail?: string;
  content: string;
  createTime?: string;
}

// ========== Timeline ==========

export interface Timeline {
  id?: number;
  title: string;
  description?: string;
  eventDate: string;
  sortOrder?: number;
  deleted?: number;
  createTime?: string;
  updateTime?: string;
}

// ========== Skill ==========

export interface Skill {
  id?: number;
  name: string;
  category?: string;
  proficiency: number;
  sortOrder?: number;
  deleted?: number;
  createTime?: string;
  updateTime?: string;
}

// ========== About ==========

export interface SocialLink {
  name: string;
  url: string;
}


// ========== Friend Link ==========

export interface FriendLink {
  id?: number;
  name: string;
  url: string;
  description?: string;
  avatar?: string;
  rss?: string;
  email?: string;
  themeColor?: string;
  sortOrder?: number;
  isPublished?: number;
  deleted?: number;
  createTime?: string;
  updateTime?: string;
}

// ========== Media ==========

export interface Media {
  id?: number;
  filename: string;
  originalFilename?: string;
  filePath?: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  relationType?: string;
  deleted?: number;
  createTime?: string;
  updateTime?: string;
}

// ========== Dashboard ==========

export interface TopArticle {
  id: number;
  title: string;
  viewCount: number;
}

export interface DashboardVO {
  articleCount: number;
  projectCount: number;
  skillCount: number;
  timelineCount: number;
  commentCount: number;
  totalViews: number;
  topArticles: TopArticle[];
}

// ========== Bookmark ==========

export interface BookmarkCategory {
  id?: number;
  name: string;
  parentId?: number | null;
  sortOrder?: number;
  deleted?: number;
  createTime?: string;
  updateTime?: string;
}

export interface Bookmark {
  id?: number;
  name: string;
  url: string;
  description?: string;
  icon?: string;
  categoryId?: number | null;
  isPin?: number;
  sortOrder?: number;
  deleted?: number;
  createTime?: string;
  updateTime?: string;
}

// ========== Literature（文学作品，本地库） ==========

export interface Literature {
  id?: number;
  title: string;
  /** 正文（纯文本，保留原始换行） */
  content: string;
  categoryId?: number | null;
  writtenAt?: string | null;
  weather?: string | null;
  isPublished?: number;
  createTime?: string;
  updateTime?: string;
}

/** 文学分类（t_category 中 type='LITERATURE' 的记录） */
export interface LiteratureCategory {
  id: number;
  name: string;
  type: "LITERATURE";
  sortOrder?: number;
}

// ========== Chatter / Moments ==========

export interface Chatter {
  id?: number;
  content: string;
  images?: string[];
  mood?: string;
  isPublished?: number;
  deleted?: number;
  createTime?: string;
  updateTime?: string;
}

// ========== Album / Gallery ==========

export interface Album {
  id?: number;
  title: string;
  description: string;
  sortOrder?: number;
  isPublished?: number;
  deleted?: number;
  createTime?: string;
  updateTime?: string;
  photos?: Photo[];
}

export interface Photo {
  id?: number;
  albumId: number;
  url: string;
  sortOrder?: number;
  deleted?: number;
  createTime?: string;
  updateTime?: string;
}

/** 音乐曲目（对应后端 MusicVO） */
export interface Music {
  id: number;
  title: string;
  /** 音频地址；静态模式下已被改写为 /data/media/... */
  fileUrl: string;
  /** 时长（秒） */
  duration: number;
  playCount?: number;
  isFavorite?: boolean;
  lastPlayed?: string | null;
  /** 歌手，可为空表示未指定 */
  singerId?: number | null;
  singerName?: string | null;
  /** 歌手封面；同一歌手的曲目共用一张图，当前多为空 */
  singerPictureUrl?: string | null;
  /** 分类，可为空表示未分类 */
  categoryId?: number | null;
  categoryName?: string | null;
  createTime?: string;
  updateTime?: string;
}

/** 歌手（对应后端 Singer 实体） */
export interface Singer {
  id: number;
  name: string;
  /** 歌手封面；为空时前端回落到默认图 */
  pictureUrl?: string | null;
  createTime?: string;
  updateTime?: string;
}

/** 音乐分类（对应后端 MusicCategory 实体） */
export interface MusicCategory {
  id: number;
  name: string;
  createTime?: string;
  updateTime?: string;
}

// ========== Diary（日记，仅本地） ==========

/** 单条活动条目 */
export interface DiaryActivity {
  id?: number;
  activity: string;
  /** 分类枚举值：1=学习 2=工作 3=生活 4=运动 5=娱乐 6=社交 */
  category: number;
  /** 小分类名称，可空 */
  subcategory?: string | null;
}

/** 一天 === 一篇日记 */
export interface Diary {
  id?: number;
  /** 记录日期，格式 YYYY-MM-DD */
  recordDate: string;
  /** 天气枚举值：1=晴 2=多云 3=阴 4=小雨 5=大雨 9=中雨 6=雪 7=雾 8=雷 */
  weather: number;
  createTime?: string;
  updateTime?: string;
  /** 当天的活动条目 */
  logs: DiaryActivity[];
}

/** 写入请求：新建带 recordDate，更新带 id（日期不可修改） */
export interface DiaryRequest {
  id?: number;
  recordDate?: string;
  weather: number;
  logs: { activity: string; category: number; subcategory?: string | null }[];
}

/** 统计 */
export interface DiaryStats {
  total: number;
  /** [["2025-06-20", 3], ...]，按日期升序 */
  dailyCount: [string, number][];
  /** 分类ID -> 条目数（JSON 对象键为字符串） */
  categoryCount: Record<string, number>;
  /** 分类ID -> (小分类名称 -> 条目数) */
  subcategoryCount: Record<string, Record<string, number>>;
}

// ========== Email (Worker API) ==========

export interface Email {
  id: number;
  message_id: string;
  from_addr: string;
  to_addr?: string;
  subject: string;
  text_body?: string;
  html_body?: string;
  forward_to?: string;
  created_at: string;
  from_name?: string;
  to_name?: string;
  direction?: "in" | "out";
}

export interface EmailListResult {
  list: Email[];
  total: number;
  page: number;
  pageSize: number;
}
