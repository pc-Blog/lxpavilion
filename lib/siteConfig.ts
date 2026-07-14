export const siteConfig = {
  /** 站点标题*/
  title: "栏轩阁 - 个人技术博客与作品集",
  /** 作者名称*/
  authorName: "ppc",
  /** 个人简介 — 首页展示、侧边栏、友链 */
  bio: "A personal space for code, science, and thoughts.",
  /** SEO 描述 — meta description、OG、Twitter Card、RSS 使用此字段 */
  seoDescription: "栏轩阁 - 个人技术博客，记录后端开发、云原生架构与全栈工程实践，分享从 Spring Boot 微服务到 Vue 3 前端的技术探索与项目心得。",
  /** 导航栏品牌名 */
  navTitle: "栏轩·阁",
  /** 头像路径，相对 public/ */
  avatarUrl: "/bg/1.jpg",
  /** 背景轮播图列表，相对 public/ */
  bgImages: [
    "/bg/1.jpg", "/bg/2.jpg", "/bg/3.jpg",
    "/bg/4.jpg", "/bg/5.PNG", "/bg/6.png",
    "/bg/7.JPG", "/bg/8.JPG", "/bg/9.jpg",
    "/bg/10.jpg"
  ],

  /** 社交链接 */
  github: "github.com/PC2005-cloud",
  email: "mail@lxpavilion.top",
  gitee: "gitee.com/peng-chao2005",
  qq: "2194844980",
  juejin: "juejin.cn/user/3154917256866522",
  csdn: "blog.csdn.net/2604_96186443",
  cnblogs: "home.cnblogs.com/u/pc2005",

  /** 关于页 markdown 正文 */
  content: "个人简介",

  /** 站点域名 */
  blog: "www.lxpavilion.top",
  /** 是否有域名 */
  hasDomain: true,

  /** 建站日期 */
  buildDate: "2026-05-21T00:00:00",

  /** Worker API 基础地址 */
  workerApi: "api.lxpavilion.top",

  /** 热点报告页面 */
  hotspot: "hotspot.lxpavilion.top",

  /** 仓库信息 */
  repo: "pc-Blog/next",
  repoId: "R_kgDOSk99gw",
  /** Giscus 评论分类 */
  giscusCategory: "Announcements",
  giscusCategoryId: "DIC_kwDOSk99g84C9uoJ",

  /** cloudeflare 相关 */
  ZoneID: "5bf4f5d460e2073282b6ff62d01f2ca4",

  /** 后端地址 */
  backUrl: "localhost:18016",

  /**
   * ───────────────────────────────────────────────
   *  功能开关（Feature Flags）
   *  用于第三方服务未配置时的功能降级处理。
   *
   *  适用场景：
   *  - fork 项目后不想配置所有第三方服务，关掉对应的功能即可
   *  - 某个第三方服务不稳定或到期，临时关闭对应功能
   *  - 按需精简博客功能，只保留需要的模块
   *
   *  使用方式：
   *  将对应项设为 false 后，该功能会从前端隐藏（导航栏/首页/浮动菜单等入口消失），
   *  直接访问页面也会显示友好提示而非报错。
   *
   *  注意：
   *  - featureAuth（登录系统）关闭时，文章/项目详情页的评论输入框也会隐藏
   *  - featureComments（评论区）关闭时，tools/心愿 页面也会一并隐藏
   * ───────────────────────────────────────────────
   */
  /** 浏览分析（流量统计页面，依赖 Cloudflare Worker + Cloudflare Analytics API）*/
  featureAnalytics: true,

  /** 第三方博客统计（CSDN/掘金/博客园数据抓取，依赖 Cloudflare Worker）*/
  featurePlatformData: true,

  /** 友链页 RSS 文章预览（依赖 Cloudflare Worker 代理抓取）*/
  featureFriendsRss: true,

  /** AI 看板娘聊天（依赖 Cloudflare Worker + Workers AI）*/
  featureAiChat: true,

  /** 评论区（依赖 Cloudflare Worker + GitHub Discussions API）*/
  featureComments: true,

  /** 登录系统（账号密码登录 + GitHub OAuth，依赖 Cloudflare Worker）*/
  featureAuth: true,

  /** RSS 邮件推送（技术速递订阅表单，依赖 Cloudflare Worker + MailerLite）*/
  featureRssPush: true,

  /** 每日热点（首页热点按钮 + 看板娘热点按钮 + 热点邮件订阅，依赖 hotspot 服务）*/
  featureHotTopics: true,

  /** 文学创作页面（依赖独立的 Java 后端接口）*/
  featureLiterature: true,

  /** 音乐播放器（独立组件，可关闭隐藏）*/
  featureMusic: true,

  /** 成长记录页面（GitHub Commits / Workflows 统计）*/
  featureGrowth: true,

  /** 浏览数（文章列表/详情/首页，依赖 Cloudflare Worker）*/
  featureViewCount: true,
};
