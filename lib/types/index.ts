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

export interface Category {
  id?: number;
  name: string;
  type: "ARTICLE" | "PROJECT";
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
  commentCount: number;
  createdAt: string;
  updateTime?: string;
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

export interface TechnologyVO {
  id: number;
  name: string;
}

export interface Technology {
  id?: number;
  name: string;
}

export interface Project {
  id?: number;
  name: string;
  summary?: string;
  content?: string;
  coverImage?: string;
  categoryId: number;
  techIds?: number[];
  githubUrl?: string;
  demoUrl?: string;
  sortOrder?: number;
  isPublished?: number;
  deleted?: number;
  createTime?: string;
  updateTime?: string;
}

export interface ProjectVO {
  id: number;
  name: string;
  summary: string;
  content?: string;
  coverImage?: string;
  categoryId: number;
  categoryName: string;
  techs: TechnologyVO[];
  githubUrl?: string;
  demoUrl?: string;
  isPublished: number;
  createdAt: string;
}

export interface ProjectDetailVO extends ProjectVO {
  content: string;
  prev: ArticleNav | null;
  next: ArticleNav | null;
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

export interface LatestComment {
  id: number;
  authorName: string;
  content: string;
  createTime: string;
}

export interface DashboardVO {
  articleCount: number;
  projectCount: number;
  skillCount: number;
  timelineCount: number;
  commentCount: number;
  totalViews: number;
  topArticles: TopArticle[];
  latestComments: LatestComment[];
}

// ========== Op (Tomcat proxy) ==========

export interface OpArticle {
  id: number;
  title: string;
  content?: string;
  writtenAt?: string;
  tagIds: number[];
}

export interface OpTag {
  id: number;
  name: string;
  articles: OpArticle[];
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

export interface OpMusic {
  id: number;
  title: string;
  duration: number;
  url: string;
  pictureUrl: string;
}
