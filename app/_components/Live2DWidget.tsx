"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "./layout/ThemeProvider";
import { useContentStore } from "@/stores/contentStore";
import { get as getAbout } from "@/lib/api/about";
import { siteConfig, loadConfig } from "@/lib/config";
import { assetUrl } from "@/lib/asset-url";

declare global {
  interface Window {
    Paul_Pio: new (config: Record<string, unknown>) => Record<string, any>;
    pio_reference?: Record<string, any>;
    pio_alignment?: string;
    pio_onHitArea?: (hitAreas: string[], model: any) => void;
    TweenLite: { to: (target: any, duration: number, props: Record<string, any>) => void };
  }
}

const PAGE_MESSAGES: Record<string, string[]> = {
  home: [
    "欢迎回来呀～", "今天想看点什么？", "到处逛逛吧～", "有什么感兴趣的吗？",
    "首页又更新啦～", "好久不见呀！", "今天心情不错呢～", "来看看有什么新东西吧～",
    "欢迎来到栏轩阁！", "随便看看，别客气～",
  ],
  article: [
    "又在看文章啦～", "认真学习呢！", "这篇文章不错吧～", "又学到新知识了呢～",
    "读得好认真呀", "技术文看起来～", "慢慢看，不着急～", "今天也要进步一点点～",
    "又在充电啦！", "好文章值得细读～",
  ],
  project: [
    "在看博主的项目呀～", "这个项目挺酷的！", "代码写得不错吧～", "想试试自己做一个吗？",
    "项目很有意思呢～", "又在研究项目啦～", "要不要自己也写一个？", "看项目可长见识了～",
    "开源精神真好呀～", "这个项目看起来好好玩～",
  ],
  about: [
    "想了解博主呀～", "来看看博主的介绍吧～", "了解一下背后的人～", "博主是个有趣的人哦～",
    "想多知道一些吗？", "关于页面有彩蛋哦～", "看完就会更了解这里啦～", "博主的故事都在这里～",
    "悄悄告诉你，博主很厉害的！", "来看看这个博客的故事～",
  ],
  friends: [
    "在交新朋友吗？", "大家都好厉害呀～", "去串串门吧～", "友链都是宝藏呢～",
    "交朋友最开心了～", "又认识了新伙伴！", "去别人家逛逛～", "友谊链接起来～",
    "认识了好多有趣的人～", "友链圈越来越大啦～",
  ],
  tools: [
    "在玩小游戏呢～", "要不要试试其他的？", "玩得开心吗～", "这关过了没？",
    "小游戏好好玩呀～", "放松一下挺好的～", "玩累了就看看文章吧～", "又菜又爱玩～",
    "这个游戏挺有意思的！", "偷偷玩一下不会被发现～",
  ],
  gallery: [
    "照片真好看呀～", "在欣赏美图呢～", "每一张都很精彩！", "摄影技术越来越好了～",
    "图片好美呀～", "看照片心情都会变好～", "记录生活的点滴～", "每一张都有故事呢～",
    "风景真不错～", "发现好看的照片了！",
  ],
  chatter: [
    "在看说说呢～", "碎碎念时间～", "博主的日常很有趣吧～", "又在刷动态了～",
    "每一条都很有意思呢！", "看看最近发生了什么～", "碎碎念收集者～", "日常碎片好有趣～",
    "又更新了说说呢～", "来看看今天说了什么～",
  ],
  timeline: [
    "回顾成长之路呢～", "一路走来不容易呀～", "每一步都算数！", "看着这些很有感触吧～",
    "成长轨迹好清晰～", "博主的进步好大！", "见证成长的时刻～", "回头看真的很棒呢～",
    "一路坚持下来好厉害！", "时间看得见成长～",
  ],
  literature: [
    "在看文学创作呢～", "好有文艺气息呀～", "博主的文笔不错吧～", "在欣赏美文呢～",
    "文字好美呀～", "读诗的感觉真棒～", "文学时间到～", "静静品味文字的美好～",
    "每一篇都很有意境呢～", "在感受文字的力量呢～",
  ],
  growth: [
    "在看成长记录呢～", "见证了博客的成长呢～", "每一步都记录在这里～", "好有纪念意义呀～",
    "从零到一的过程真棒～", "时间线满满的都是回忆～", "看着博客一点点长大呢～", "每个里程碑都值得纪念～",
    "记录了所有的努力呢～", "成长的故事最动人了～",
  ],
  analytics: [
    "在看统计数据呢～", "数据控上线了～", "流量分析中～", "看看今天有多少访客～",
    "数据可视化真好看～", "博客热度不错哦～", "又来看数据啦～", "每一个访问都很珍贵呢～",
    "数据背后都是真实的读者呢～", "分析页面最有意思了～",
  ],
  personal: [
    "欢迎来到你的个人空间～", "这里记录了你的成长呢～", "属于自己的小天地～", "偷偷努力的地方～",
    "每次进步都看得见！", "今天也要加油呀～", "这里只有你知道～", "默默变强的感觉真好～",
    "积累的力量最强大～", "在看不见的地方悄悄成长～",
  ],
};

const FALLBACK_MESSAGES = [
  "嗯…这里好像没什么人", "好无聊啊，有谁陪我玩~", "我是不是该做点什么？", "今天也要加油鸭！",
  "偷偷告诉你，其实我很厉害的！", "唔…想喝奶茶了", "这样站着好累哦", "我昨晚做了一个很有趣的梦~",
  "哼！不跟你玩了！", "你在看什么呢？", "其实我是会魔法的哦！", "好想出去玩啊…",
  "我是不是长胖了？", "你猜我现在在想什么？", "今天天气真好啊~", "人生就像一杯茶，慢慢品味…",
  "噗嗤，你刚才的样子好逗！", "我在想晚饭吃什么好呢？", "我是不是说话太多了？",
  "感觉好久没人跟我说活了", "偷偷瞄你一眼~", "唉…有点困了", "你专注的样子还挺好看的",
  "感觉今天很适合出去走走！", "偷偷告诉你，旁边的猫猫在看你呢~",
];

export default function Live2DWidget() {
  const { isDark } = useTheme();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  const getPageMessages = (): string[] => {
    const p = pathnameRef.current;
    if (!p) return FALLBACK_MESSAGES;
    if (p === "/") return PAGE_MESSAGES.home;
    if (p.startsWith("/analytics")) return PAGE_MESSAGES.analytics;
    if (p.startsWith("/article")) return PAGE_MESSAGES.article;
    if (p.startsWith("/project")) return PAGE_MESSAGES.project;
    if (p.startsWith("/about")) return PAGE_MESSAGES.about;
    if (p.startsWith("/friends")) return PAGE_MESSAGES.friends;
    if (p.startsWith("/tools")) return PAGE_MESSAGES.tools;
    if (p.startsWith("/gallery")) return PAGE_MESSAGES.gallery;
    if (p.startsWith("/chatter")) return PAGE_MESSAGES.chatter;
    if (p === "/personal" || p.startsWith("/personal/")) {
      if (p.startsWith("/personal/timeline")) return PAGE_MESSAGES.timeline;
      if (p.startsWith("/personal/commits")) return PAGE_MESSAGES.growth;
      return PAGE_MESSAGES.personal;
    }
    if (p.startsWith("/literature")) return PAGE_MESSAGES.literature;
    return FALLBACK_MESSAGES;
  };
  /** 文学详情页循环朗读器 */
  const literatureReaderRef = useRef<{
    active: boolean;
    phase: 'greeting' | 'reading' | 'ending';
    sentences: string[];
    index: number;
    title: string;
    lastPath: string;
  }>({ active: false, phase: 'greeting', sentences: [], index: 0, title: '', lastPath: '' });

  const getLiteratureReaderMessage = (): string | null => {
    const p = pathnameRef.current;
    if (!p?.startsWith("/literature/") || p === "/literature") {
      literatureReaderRef.current.active = false;
      return null;
    }
    const reader = literatureReaderRef.current;
    // 首次、内容为空、或路径变化时重新初始化
    if (!reader.active || reader.sentences.length === 0 || reader.lastPath !== p) {
      const contentEl = document.querySelector('.whitespace-pre-wrap');
      if (!contentEl?.textContent?.trim()) return null;
      const text = contentEl.textContent.trim();
      const byPeriod = text.split('。').map(s => s.trim()).filter(s => s.length > 0);
      const byLine = text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      const titleEl = document.querySelector('h1');
      reader.active = true;
      reader.phase = 'greeting';
      reader.sentences = byPeriod.length >= byLine.length ? byPeriod : byLine;
      reader.index = 0;
      reader.title = titleEl?.textContent?.trim() || '';
      reader.lastPath = p;
    }
    const greetings = ["开始读啦~", "一起欣赏这篇美文吧~", "听听看，写得可好了~", "来读一篇美文~", "又到了文学时间~"];
    const endings = ["读完了~好有感觉！", "今天的文学时间到这就结束啦~", "写得真棒呀~", "每一句都很有味道呢~", "美文欣赏完毕~"];
    let msg: string;
    if (reader.phase === 'greeting') {
      msg = greetings[Math.floor(Math.random() * greetings.length)];
      reader.phase = 'reading';
      reader.index = 0;
    } else if (reader.phase === 'reading') {
      if (reader.index === 0) {
        msg = `「${reader.title}」`;
      } else {
        const sentence = reader.sentences[reader.index - 1];
        const last = sentence.slice(-1);
        msg = '！？…！？)'.includes(last) ? sentence : sentence + '。';
      }
      reader.index++;
      if (reader.index > reader.sentences.length) {
        reader.phase = 'ending';
      }
    } else {
      msg = endings[Math.floor(Math.random() * endings.length)];
      reader.phase = 'greeting';
    }
    return msg;
  };
  const githubRef = useRef(`https://github.com/${siteConfig.repo}`);
  const loaded = useRef(false);
  const currentModel = useRef<string | null>(null);
  const pioRef = useRef<any>(null);
  const live2dModel = useRef<any>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseoverRef = useRef<((e: MouseEvent) => void) | null>(null);

  // 文章/项目 AI 俏皮话缓存
  const commentaryCache = useRef<{ lines: string[]; loading: boolean }>({ lines: [], loading: false });
  const preloadCommentary = useCallback(async () => {
    if (commentaryCache.current.loading) return;
    const c = useContentStore.getState().content;
    if (!c) return;
    commentaryCache.current.loading = true;
    try {
      const res = await fetch(`https://${siteConfig.workerApi}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: currentModel.current || (isDark ? "Ava" : "Diana"),
          message: c.type === "about"
            ? `名字：${c.title}\n简介：${c.summary}\n介绍：${c.content}`
            : `标题：${c.title}\n简介：${c.summary}\n分类：${c.categoryName}\n标签：${c.tags.join("、")}`,
          mode: c.type,
        }),
      });
      const json = await res.json();
      const reply = json?.data?.reply || "";
      const lines = reply.split(/[。！？\n]/).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      if (lines.length > 0) commentaryCache.current.lines = lines;
    } catch { /* ignore */ }
    finally { commentaryCache.current.loading = false; }
  }, []);

  // 监听 contentStore，进入文章/项目详情页时预加载俏皮话
  useEffect(() => {
    const unsub = useContentStore.subscribe((state) => {
      if (state.content) {
        preloadCommentary();
      } else {
        commentaryCache.current.lines = [];
      }
    });
    return unsub;
  }, [preloadCommentary]);

  // AI 对话
  const [inputOpen, setInputOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [inputPos, setInputPos] = useState({ x: 0, y: 0 });
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const inputOpenRef = useRef(false);

  const closeInput = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setClosing(false); setInputOpen(false); }, 200);
  }, []);

  useEffect(() => {
    inputOpenRef.current = inputOpen;
    if (inputOpen) setTimeout(() => aiInputRef.current?.focus(), 100);
  }, [inputOpen]);

  // 点击输入框外部关闭（排除 AI 按钮本身）
  useEffect(() => {
    if (!inputOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target?.closest?.(".pio-ai")) return;
      if (inputContainerRef.current && !inputContainerRef.current.contains(target)) {
        closeInput();
      }
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [inputOpen]);

  const sendAiChat = async () => {
    const text = aiInput.trim();
    if (!text || aiLoading) return;
    const char = currentModel.current || (isDark ? "Ava" : "Diana");
    setAiInput("");
    setAiLoading(true);

    // 读历史
    const key = `chat_${char}`;
    let history: { role: string; content: string }[] = [];
    try { const h = localStorage.getItem(key); if (h) history = JSON.parse(h); } catch {}

    try {
      const res = await fetch(`https://${siteConfig.workerApi}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, character: char, history, mode: "chat" }),
      });
      const json = await res.json();
      const reply = json?.data?.reply || "(唔…不知道说什么了)";

      // 存历史（保留最近3组 = 6条）
      history.push({ role: "user", content: text }, { role: "assistant", content: reply });
      if (history.length > 6) history = history.slice(-6);
      try { localStorage.setItem(key, JSON.stringify(history)); } catch {}

      const pio = window.pio_reference;
      if (pio?.modules) pio.modules.render(reply);
      // 随机动作
      const model = live2dModel.current || pioRef.current?.model;
      if (model) {
        const name = model.internalModel?.settings?.name || char;
        const tapMotions: Record<string, string[]> = {
          Ava: ["Shake", "Tap右手", "Tap左手", "Tap嘴", "Tap胸口项链", "Tap中间刘海", "Tap右眼", "Tap左眼", "Tap腰", "Tap脖子", "Tap左马尾", "Tap右手臂"],
          Diana: ["Shake", "Tap抱阿草-左手", "Tap右头发", "Tap左头发", "Tap笑- 脸", "Tap生气 -领结", "Tap= =  左蝴蝶结", "Tap哭 -眼角", "Tap摇头- 身体", "Tap耳朵-发卡", "Tap打瞌睡- 呆毛"],
        };
        const list = tapMotions[name] || ["Shake"];
        if (list.length > 0) model.motion(list[Math.floor(Math.random() * list.length)]);
      }
    } catch {
      const pio = window.pio_reference;
      if (pio?.modules) pio.modules.render("哎呀，网络出问题了～(；′⌒`)");
    } finally {
      setAiLoading(false);
    }
  };

  const startIdleTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const p = pathnameRef.current;
    const isLitDetail = p?.startsWith("/literature/") && p !== "/literature";
    let delay: number;
    if (isLitDetail) {
      const reader = literatureReaderRef.current;
      if (reader.phase === 'reading') {
        // 根据句子长度动态计算朗读间隔
        let textLength: number;
        if (reader.index === 0) {
          textLength = reader.title.length + 2; // 「」
        } else {
          textLength = reader.sentences[reader.index - 1]?.length || 10;
        }
        delay = Math.max(2000, Math.min(15000, 2000 + textLength * 120)) + Math.random() * 1000;
      } else {
        delay = 6000 + Math.random() * 2000; // 寒暄 / 结尾 6-8s
      }
    } else {
      delay = 15000 + Math.random() * 30000;
    }
    idleTimer.current = setTimeout(() => {
      // 对话中不显示随机文本
      if (inputOpenRef.current) { startIdleTimer(); return; }
      const pio = window.pio_reference;
      const model = live2dModel.current;
      if (model) {
        const modelName = model.internalModel?.settings?.name || (isDark ? "Ava" : "Diana");
        if (Math.random() < 0.3) {
          const motions: Record<string, string[]> = { Diana: ["Shake", "Leave"], Ava: ["Shake"] };
          const list = motions[modelName] || [];
          if (list.length > 0) {
            model.motion(list[Math.floor(Math.random() * list.length)]);
          }
        }
      }
      if (pio?.modules) {
        let msg: string | null = null;
        const p = pathnameRef.current;
        // 文学详情页：90% AI 俏皮话，10% 朗读（朗读开始后不中断）
        if (p?.startsWith("/literature/") && p !== "/literature") {
          const readerPhase = literatureReaderRef.current.phase;
          if (readerPhase === 'reading') {
            msg = getLiteratureReaderMessage(); // 朗读中不打断
          } else if (Math.random() < 0.85 && commentaryCache.current.lines.length > 0) {
            msg = commentaryCache.current.lines.shift()!;
            if (commentaryCache.current.lines.length <= 2) {
              const c = useContentStore.getState().content;
              if (c) preloadCommentary();
            }
          } else {
            msg = getLiteratureReaderMessage();
          }
        }
        // 文章/项目/关于详情页 AI 俏皮话
        if (!msg && commentaryCache.current.lines.length > 0) {
          msg = commentaryCache.current.lines.shift()!;
          // 缓存将尽时静默续加载
          if (commentaryCache.current.lines.length <= 2) {
            const c = useContentStore.getState().content;
            if (c) preloadCommentary();
          }
        }
        if (!msg) {
          const msgArr = Math.random() < 0.8 ? getPageMessages() : FALLBACK_MESSAGES;
          msg = msgArr[Math.floor(Math.random() * msgArr.length)];
        }
        pio.modules.render(msg);
        // 说话时随机触发动作
        const m = live2dModel.current || pioRef.current?.model;
        if (m) {
          const name = m.internalModel?.settings?.name || (isDark ? "Ava" : "Diana");
          const tapMotions: Record<string, string[]> = {
            Ava: ["Shake", "Tap右手", "Tap左手", "Tap嘴", "Tap胸口项链", "Tap中间刘海", "Tap右眼", "Tap左眼", "Tap腰", "Tap脖子", "Tap左马尾", "Tap右手臂"],
            Diana: ["Shake", "Tap抱阿草-左手", "Tap右头发", "Tap左头发", "Tap笑- 脸", "Tap生气 -领结", "Tap= =  左蝴蝶结", "Tap哭 -眼角", "Tap摇头- 身体", "Tap耳朵-发卡", "Tap打瞌睡- 呆毛"],
          };
          const list = tapMotions[name] || ["Shake"];
          m.motion(list[Math.floor(Math.random() * list.length)]);
        }
      }
      startIdleTimer();
    }, delay);
  };

  const stopIdleTimer = () => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  };

  const isAdmin = pathname?.startsWith("/admin");

  // admin 时销毁，返回时重建
  const wasAdmin = useRef(false);
  useEffect(() => {
    if (isAdmin) {
      wasAdmin.current = true;
      stopIdleTimer();
      document.querySelector(".pio-container")?.remove();
      (document.getElementById("pio-container") as HTMLElement)?.remove();
      return;
    }
    if (wasAdmin.current) {
      wasAdmin.current = false;
      loaded.current = false;
      // 小延迟确保 DOM 已清理
      setTimeout(() => initPio(), 100);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    if (loaded.current) return;
    loaded.current = true;

    (window as any).pio_alignment = "left";

    // 获取已合并的 GitHub 链接
    getAbout().then((about) => {
      loadConfig(about);
      if (siteConfig.github) {
        githubRef.current = siteConfig.github;
        const pio = window.pio_reference as any;
        if (pio?.config?.content) pio.config.content.link = siteConfig.github;
      }
    }).catch(() => {});

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = assetUrl("/pio/pio.css");
    document.head.appendChild(link);

    const scripts = [
      assetUrl("/pio/TweenLite.js"),
      assetUrl("/pio/live2dcubismcore.min.js"),
      assetUrl("/pio/pixi.min.js"),
      assetUrl("/pio/cubism4.min.js"),
      assetUrl("/pio/pio.js"),
      assetUrl("/pio/pio_sdk4.js"),
    ];

    let idx = 0;
    const loadNext = () => {
      if (idx >= scripts.length) {
        initPio();
        return;
      }
      const s = document.createElement("script");
      s.src = scripts[idx];
      s.onload = () => { idx++; loadNext(); };
      document.body.appendChild(s);
    };
    loadNext();

    return () => { stopIdleTimer(); if (mouseoverRef.current) document.removeEventListener("mouseover", mouseoverRef.current); };
  }, []);

  const initPio = () => {
    if (!window.Paul_Pio) return;

    (window as any).pio_alignment = "left";
    if (typeof (window as any)._pio_initialize_pixi === "function") {
      (window as any)._pio_initialize_pixi();
    }

    const modelFile = isDark ? "Ava" : "Diana";
    currentModel.current = modelFile;

    window.pio_reference = new window.Paul_Pio({
      mode: "fixed",
      hidden: false,
      content: {
        link: githubRef.current,
        welcome: ["Hi~"],
        touch: ["你在干什么？", "再摸我就报警了！", "HENTAI!", "不可以这样欺负我啦！", "今天天气不错呢~", "要和我一起玩吗？", "盯——", "别戳了啦！", "好无聊啊，陪我聊聊天吧", "呜呜...你欺负我", "嘿！抓到你了！", "你是不是喜欢我呀？", "努力工作，加油！", "我可爱吗？", "喂喂，有人在吗？"],
        custom: [],
      },
      model: [assetUrl(`/live2d-models/${modelFile}/${modelFile}.model3.json`)],
      tips: true,
      onModelLoad: (model: any) => {
        const name = model.internalModel?.settings?.name;
        if (name === "Ava") {
          const coreModel = model.internalModel.coreModel;
          const hideParts = ["Part15", "Part5", "neko", "game", "Part21", "Part22", "Part", "Part16", "Part12"];
          setTimeout(() => {
            hideParts.forEach(id => {
              const idx = coreModel._partIds.indexOf(id);
              if (idx >= 0 && window.TweenLite) {
                window.TweenLite.to(coreModel._partOpacities, 3.6, { [idx]: 0 });
              } else if (idx >= 0) {
                coreModel._partOpacities[idx] = 0;
              }
            });
          }, 2400);
        }
      },
    });
    pioRef.current = window.pio_reference;

    // 添加 AI 对话按钮到 Pio 菜单
    const pioContainer = document.querySelector(".pio-container");
    const menu = pioContainer?.querySelector(".pio-action");
    if (menu && !document.querySelector(".pio-ai") && siteConfig.featureAiChat) {
      const btn = document.createElement("span");
      btn.className = "pio-ai";
      btn.title = "AI 聊天";
      btn.onmouseover = () => {
        const pio = window.pio_reference;
        if (pio?.modules) pio.modules.render("要和我聊聊天吗？(๑•̀ㅂ•́)و✧");
      };
      btn.onclick = (e) => {
        if (inputOpenRef.current) { closeInput(); return; }
        setInputPos({ x: e.clientX, y: e.clientY });
        setInputOpen(true);
      };
      menu.appendChild(btn);
    }

    // 动作测试按钮（顺序触发）
    const motionList: Record<string, string[]> = {
      Ava: ["Shake", "Tap右手", "Tap左手", "Tap嘴", "Tap胸口项链", "Tap中间刘海", "Tap右眼", "Tap左眼", "Tap腰", "Tap脖子", "Tap左马尾", "Tap右手臂"],
      Diana: ["Shake", "Tap抱阿草-左手", "Tap右头发", "Tap左头发", "Tap笑- 脸", "Tap生气 -领结", "Tap= =  左蝴蝶结", "Tap哭 -眼角", "Tap摇头- 身体", "Tap耳朵-发卡", "Tap打瞌睡- 呆毛"],
    };
    let motionIdx = 0;
    if (menu && !document.querySelector(".pio-motion")) {
      const mBtn = document.createElement("span");
      mBtn.className = "pio-motion";
      mBtn.title = "测试动作";
      mBtn.onmouseover = () => {
        const pio = window.pio_reference;
        if (pio?.modules) pio.modules.render("按顺序测试动作");
      };
      mBtn.onclick = () => {
        const model = live2dModel.current || pioRef.current?.model;
        if (!model) return;
        const name = model.internalModel?.settings?.name || (isDark ? "Ava" : "Diana");
        const list = motionList[name] || ["Shake"];
        const motion = list[motionIdx % list.length];
        motionIdx++;
        model.motion(motion);
        const pio = window.pio_reference;
        if (pio?.modules) pio.modules.render("▶ " + motion);
      };
      menu.appendChild(mBtn);
    }

    // 热点新闻按钮
    let hotLoading = false;
    const HOTSPOT_URL = `https://${siteConfig.hotspot}/report.json`;
    if (menu && !document.querySelector(".pio-hot") && siteConfig.featureHotTopics) {
      const hBtn = document.createElement("span");
      hBtn.className = "pio-hot";
      hBtn.title = "今日热点";
      hBtn.onmouseover = () => {
        const pio = window.pio_reference;
        if (pio?.modules) pio.modules.render("想知道今天有什么热点吗？🔥");
      };
      hBtn.onclick = async () => {
        if (hotLoading) return;
        hotLoading = true;
        stopIdleTimer();
        try {
          const res = await fetch(HOTSPOT_URL);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json() as {
            results: { keyword: string; hotspots: { rank: number; title: string; url: string; summary: string; source: string }[] }[];
          };
          if (!data.results || data.results.length === 0) {
            const pio = window.pio_reference;
            if (pio?.modules) pio.modules.render("今天好像没有热点新闻呢…");
            return;
          }
          // 展平所有热点
          const allItems: { title: string; url: string; keyword: string; source?: string }[] = [];
          for (const r of data.results) {
            for (const h of r.hotspots || []) {
              allItems.push({ title: h.title, url: h.url || "", keyword: r.keyword, source: h.source });
            }
          }
          if (allItems.length === 0) {
            const pio = window.pio_reference;
            if (pio?.modules) pio.modules.render("今天好像没有热点新闻呢…");
            return;
          }
          const item = allItems[Math.floor(Math.random() * allItems.length)];
          const msg = item.url
            ? `<a href="${item.url.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer" style="color:#FF6B35;text-decoration:none;">🔥</a> ${item.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}`
            : `🔥 ${item.title}`;
          const pio = window.pio_reference;
          if (pio?.modules) pio.modules.render(msg);
          startIdleTimer();
        } catch {
          const pio = window.pio_reference;
          if (pio?.modules) pio.modules.render("唔…热点没抓到(´;ω;`)");
        } finally {
          hotLoading = false;
        }
      };
      menu.appendChild(hBtn);
    }

    // 点击部位不同反应（多组对话，随机选取）
    const hitTexts: Record<string, Record<string, string[]>> = {
      Diana: {
        "生气 -领结": ["哼！我生气了！哄不好的那种！", "你惹到我了知道吗！", "气死我啦！", "不理你了！哼！"],
        "= =  左蝴蝶结": ["盯——你这样看着我干嘛", "你脸上有东西…骗你的！", "看什么看，没见过美女吗~"],
        "笑- 脸": ["嘿嘿~今天心情不错哦", "有什么开心的事吗？", "笑一笑，十年少~", "嘿嘿嘿~"],
        "哭 -眼角": ["呜呜...好难过", "你欺负我！", "眼角有泪花…", "呜哇——"],
        "害羞-中间刘海": ["哎呀！不要碰那里啦！", "好害羞…别碰我刘海", "脸都红啦！", "讨厌！"],
        "抱阿草-左手": ["阿草是我最好的朋友~", "阿草软软的，好舒服", "你想抱抱阿草吗？"],
        "打瞌睡- 呆毛": ["好困啊…让我睡一会", "哈欠~~~", "别碰呆毛，会变笨的！", "已经睁不开眼睛了…"],
        "耳朵-发卡": ["啊！好痒！不要碰耳朵！", "耳朵是很敏感的地方啦！", "再碰耳朵我就咬你！"],
        "摇头- 身体": ["不要不要——", "不行不行！", "摇头晃脑~", "再摇就要散架啦！"],
        "左头发": ["我的头发好看吗？嘿嘿", "左分也很美吧~", "你是不是想摸我的头发？"],
        "右头发": ["再摸头发要掉光啦！", "右分也很漂亮哦", "头发可是我的骄傲！"],
      },
      Ava: {
        "左手": ["嘿！接招！", "看我的左手攻击！", "嘿嘿，抓到你啦", "左手也很灵活的！"],
        "右手": ["干嘛呀~", "右手是用来写代码的！", "别碰我右手啦", "再摸我就弹你！"],
        "腰": ["哈哈…好痒！别碰我腰！", "痒痒痒！投降！", "腰是不能碰的！", "你再碰我就笑死了"],
        "中间刘海": ["发型都弄乱啦！", "我好不容易才弄好的刘海！", "别碰我刘海啦！"],
        "嘴": ["我唱歌可好听了，要听吗？", "啊——你有蛀牙吗？", "说话就说话，别动嘴！"],
        "胸口项链": ["这个项链好看吧~", "这是我最重要的项链！", "好看吗？我也觉得~"],
        "脖子": ["唔…好敏感的地方", "脖子不可以碰！", "痒—"],
        "右边头饰小花": ["小花可爱吗？", "她叫小可爱~", "别弄疼小花了！"],
        "右头饰": ["别碰歪了我的头饰", "头饰歪了就不好看了！", "这个可是限量版的！"],
        "右眼": ["你再戳我眼睛试试！", "眼睛很重要！！", "戳瞎了你负责吗？！"],
        "左眼": ["我的眼睛是不是很漂亮？", "左眼是心灵的窗户~", "再盯着看我会害羞的…"],
        "右马尾": ["我的双马尾可爱吧~", "右马尾晃呀晃~", "揪马尾会疼的啦！"],
        "左马尾": ["扎了很久才弄好的！", "左马尾可是我的得意之作！", "别弄乱了啦！"],
        "右手臂": ["揪你手臂！", "手臂肉肉的~", "你再揪我我就揪回去！"],
        "左中马尾": ["中间的马尾也很有精神！", "三马尾才是完全体！", "嘿嘿，被我发现了吧！"],
      },
    };

    // 额外随机动效配置
    const extraMotions: Record<string, { motion: string; chance: number }[]> = {
      Diana: [
        { motion: "Shake", chance: 0.3 },
        { motion: "Leave", chance: 0.15 },
      ],
      Ava: [
        { motion: "Shake", chance: 0.25 },
      ],
    };

    window.pio_onHitArea = (hitAreas: string[], model: any) => {
      live2dModel.current = model;
      const modelName = model.internalModel?.settings?.name || (isDark ? "Ava" : "Diana");
      const texts = hitTexts[modelName] || {};
      const extras = extraMotions[modelName] || [];
      const motionFix: Record<string, string> = {
        "右边头饰小花": "Tap 右边头饰小花",
        "右马尾": "Tap右马尾   ",
        "左马尾": "Tap左马尾",
        "左中马尾": "Tap左中马尾",
        "右头饰": "Tap右头饰",
      };
      const pio = window.pio_reference;
      for (const area of hitAreas) {
        const clean = area.trim();
        const textsArr = texts[clean];
        const text = textsArr ? textsArr[Math.floor(Math.random() * textsArr.length)] : "唔…";
        if (pio?.modules) pio.modules.render(text);
        model.motion(motionFix[clean] || `Tap${clean}`);
        // 随机触发额外动作
        for (const extra of extras) {
          if (Math.random() < extra.chance) {
            setTimeout(() => model.motion(extra.motion), 800);
          }
        }
        return;
      }
    };

    // 事件委托悬浮提示（用 closest 支持子元素触发）
    const tooltipRules: { test: (el: Element) => string | null }[] = [
      { test: (el) => { const c = el.closest(".giscus-wrapper"); return c ? "来聊聊你的想法吧~" : null; }},
      { test: (el) => { const a = el.closest("a"); if (!a) return null; const segs = (a.getAttribute("href") || "").split('/').filter(Boolean); if (segs[0] !== 'article' || segs.length < 2) return null; const msgs = ["要不要读读看？", "这篇写得可好了！", "点进来看看嘛~", "不点进去看看吗？", "偷偷告诉你，这篇超精彩！"]; return msgs[Math.floor(Math.random() * msgs.length)]; }},
      { test: (el) => { const a = el.closest("a"); if (!a) return null; const segs = (a.getAttribute("href") || "").split('/').filter(Boolean); if (segs[0] !== 'project' || segs.length < 2) return null; const msgs = ["这个项目很有意思哦！", "不看看博主的代码吗？", "点进去了解一下？", "源码写得可棒了！", "来看看这个项目吧~"]; return msgs[Math.floor(Math.random() * msgs.length)]; }},
      { test: (el) => { const a = el.closest("a"); if (!a) return null; const segs = (a.getAttribute("href") || "").split('/').filter(Boolean); if (segs[0] !== 'literature' || segs.length < 2) return null; if (a.querySelector('h3')) return null; const titleEl = a.querySelector("article p:last-of-type"); const title = titleEl ? titleEl.textContent?.replace(/^——\s*/, "").split("·")[0].trim().slice(0, 20) || "" : ""; const withTitle = [`「${title}」写得真美呀~`, `这篇「${title}」很有意境呢！`, `「${title}」读起来好有感觉~`, `进来看看「${title}」吧~`, `「${title}」文笔超棒的！`]; const withoutTitle = ["文笔超棒的，不进来看看吗？", "每一篇都很有意境哦！", "感受一下文字的魅力吧~", "写得很有感觉呢~", "美文时间到~"]; const all = [...withTitle, ...withoutTitle]; return all[Math.floor(Math.random() * all.length)]; }},
      { test: (el) => { const a = el.closest("a"); if (!a) return null; const segs = (a.getAttribute("href") || "").split('/').filter(Boolean); if (segs[0] !== 'gallery' || segs.length < 2) return null; const msgs = ["照片拍得可美了！", "点开看看嘛~", "每一张都很惊艳哦！", "画面超有感觉的！", "来欣赏一下美图吧~"]; return msgs[Math.floor(Math.random() * msgs.length)]; }},
      { test: (el) => { const a = el.closest("a"); const s = a?.getAttribute("href")?.split('/').filter(Boolean)[0]; return s === "timeline" ? "看看博主的学习历程~" : null; }},
      { test: (el) => { const a = el.closest("a"); const s = a?.getAttribute("href")?.split('/').filter(Boolean)[0]; return s === "about" ? "想了解博主是什么样的人吗？" : null; }},
      { test: (el) => { const a = el.closest("a"); const s = a?.getAttribute("href")?.split('/').filter(Boolean)[0]; return s === "friends" ? "去交个朋友吧~" : null; }},
      { test: (el) => { const a = el.closest("a"); return a?.getAttribute("href")?.startsWith("/admin") ? "管理员入口，闲人勿入！" : null; }},
      { test: (el) => { const a = el.closest("a"); return a?.getAttribute("href") === "/auth/login" || a?.getAttribute("href") === "/auth/register" ? "登录后可以管理博客哦~" : null; }},
      { test: (el) => { const a = el.closest("a"); const h = a?.getAttribute("href"); return h === "/" ? "回到首页看看有什么新鲜事~" : null; }},
      { test: (el) => { const a = el.closest("a"); const s = a?.getAttribute("href")?.split('/').filter(Boolean)[0]; return s === "article" ? "来看看最新的文章~" : null; }},
      { test: (el) => { const a = el.closest("a"); const s = a?.getAttribute("href")?.split('/').filter(Boolean)[0]; return s === "project" ? "博主的开源项目都在这里~" : null; }},
      { test: (el) => { const a = el.closest("a"); const s = a?.getAttribute("href")?.split('/').filter(Boolean)[0]; return s === "tools" ? "玩个小游戏放松一下吧~" : null; }},
      { test: (el) => { const a = el.closest("a"); const s = a?.getAttribute("href")?.split('/').filter(Boolean)[0]; return s === "gallery" ? "来欣赏美图吧~" : null; }},
      { test: (el) => { const a = el.closest("a"); const s = a?.getAttribute("href")?.split('/').filter(Boolean)[0]; return s === "analytics" ? "来看看博客的访问数据~" : null; }},
      { test: (el) => { const a = el.closest("a"); const s = a?.getAttribute("href")?.split('/').filter(Boolean)[0]; return s === "chatter" ? "看看博主最近说了什么~" : null; }},
      { test: (el) => { const a = el.closest("a"); const s = a?.getAttribute("href")?.split('/').filter(Boolean)[0]; return s === "growth" ? "见证博客的成长历程~" : null; }},
      { test: (el) => { const a = el.closest("a"); const s = a?.getAttribute("href")?.split('/').filter(Boolean)[0]; return s === "literature" ? "感受文字的力量~" : null; }},
      { test: (el) => el.closest("header")?.querySelector("a") && !el.closest("header")?.querySelector("[class*='glass-btn']") ? "想去哪里看看？" : null },
      { test: (el) => el.closest("footer") ? "到底部了呢，感谢阅读~" : null },
      { test: (el) => { const a = el.closest("a"); if (a && a.closest(".article-prose")) return "想了解一下 " + (a.textContent?.trim().slice(0, 20) || "") + " 吗？"; return null; }},
      { test: (el) => el.closest(".article-prose")?.querySelector("img") === el ? "这张图真好看~" : null },
    ];

    const mouseoverHandler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target || !window.pio_reference?.modules) return;
      // 用 closest("a") 去重，同一链接内的子元素只触发一次
      const link = target.closest("a");
      const key = link || target;
      if ((mouseoverHandler as any)._lastKey === key) return;
      (mouseoverHandler as any)._lastKey = key;
      setTimeout(() => { (mouseoverHandler as any)._lastKey = null; }, 300);
      for (const rule of tooltipRules) {
        const msg = rule.test(target);
        if (msg) {
          window.pio_reference.modules.render(msg);
          return;
        }
      }
    };
    document.addEventListener("mouseover", mouseoverHandler);
    mouseoverRef.current = mouseoverHandler;

    // 闲置自言自语 — 等模型加载完启动
    const waitForCanvas = setInterval(() => {
      const canvas = document.getElementById("pio") as HTMLCanvasElement;
      if (canvas && canvas.width > 50) {
        clearInterval(waitForCanvas);
        // 点击角色时重置闲置计时
        canvas.onclick = () => { startIdleTimer(); };
        startIdleTimer();
      }
    }, 500);
  };

  // Switch model on theme change
  useEffect(() => {
    const modelFile = isDark ? "Ava" : "Diana";
    if (currentModel.current === modelFile) return;
    currentModel.current = modelFile;
    stopIdleTimer();
    document.querySelector(".pio-container")?.remove();
    (document.getElementById("pio-container") as HTMLElement)?.remove();
    initPio();
  }, [isDark]);

  return (
    <>
      {siteConfig.featureAiChat && inputOpen && (
        <div
          ref={inputContainerRef}
          className={`fixed z-[9999] ${closing ? "animate-pio-chat-out" : "animate-pio-chat"}`}
          style={{ left: inputPos.x + 15, top: inputPos.y - 22 }}
        >
          <div className="relative">
            <input
              ref={aiInputRef}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendAiChat(); } }}
              placeholder="和看板娘聊天～"
                            className="w-40 sm:w-48 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl px-3 py-2 pr-8 text-sm outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 border border-white/40 dark:border-white/10 shadow-lg"
            />
            <button
              onClick={sendAiChat}
              disabled={aiLoading || !aiInput.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-indigo-500 disabled:opacity-30 transition-colors text-xs"
            >
              ↗
            </button>
          </div>
        </div>
      )}
    </>
  );
}
